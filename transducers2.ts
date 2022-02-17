export interface Reducer<Accumulation, Value> {
  init?: () => Accumulation;
  complete: (accumulation: Accumulation) => Accumulation;
  // TODO: rename reduce to step?
  reduce: (accumulation: Accumulation, value: Value) => Accumulation;
}

export type Transducer<
  InputAccumulation,
  InputValue,
  OutputAccumulation,
  OutputValue,
> = (
  step: Reducer<OutputAccumulation, OutputValue>,
) => Reducer<InputAccumulation, InputValue>;

type PartialReducer<A, V> =
  & Pick<Reducer<A, V>, "reduce">
  & Partial<Reducer<A, V>>;
type PartialTransducer<IA, IV, OA, OV> = (
  step: Reducer<OA, OV>,
) => PartialReducer<IA, IV>;

export function transducer<A, IV, OV>(
  spec: PartialTransducer<A, IV, A, OV>,
): Transducer<A, IV, A, OV> {
  return (step: Reducer<A, OV>) => {
    const partial = spec(step);
    return {
      init: partial.init ?? (step.init && step.init.bind(step)),
      complete: partial.complete ?? step.complete.bind(step),
      reduce: partial.reduce.bind(partial),
    };
  };
}

export const mapping = function <X, Y, Accumulation>(
  f: (x: X) => Y,
): Transducer<Accumulation, X, Accumulation, Y> {
  return (
    step: Reducer<Accumulation, Y>,
  ): Reducer<Accumulation, X> => ({
    init: step.init && step.init.bind(step),
    complete: (accumulation) => step.complete(accumulation),
    reduce: (accumulation, value) => step.reduce(accumulation, f(value)),
  });
};

export const mapping2 = function <X, Y, Accumulation>(
  f: (x: X) => Y,
): Transducer<Accumulation, X, Accumulation, Y> {
  return transducer((
    step: Reducer<Accumulation, Y>,
  ) => ({
    reduce: (accumulation, value) => step.reduce(accumulation, f(value)),
  }));
};

export function compose<
  OuterInputAccumulation,
  OuterInputValue,
  CommonAccumulation,
  CommonValue,
  InnerOutputAccumulation,
  InnerOutputValue,
>(
  outer: Transducer<
    OuterInputAccumulation,
    OuterInputValue,
    CommonAccumulation,
    CommonValue
  >,
  inner: Transducer<
    CommonAccumulation,
    CommonValue,
    InnerOutputAccumulation,
    InnerOutputValue
  >,
): Transducer<
  OuterInputAccumulation,
  OuterInputValue,
  InnerOutputAccumulation,
  InnerOutputValue
> {
  return (
    step: Reducer<InnerOutputAccumulation, InnerOutputValue>,
  ): Reducer<OuterInputAccumulation, OuterInputValue> => outer(inner(step));
}
