export type ReducingFunction<Accumulated, Next> = (
  accumulated: Accumulated,
  next: Next,
) => Accumulated;

export type TransducingFunction<
  AccumulatedIn,
  NextIn,
  AccumulatedOut,
  NextOut,
  InputRf extends ReducingFunction<AccumulatedIn, NextIn> = ReducingFunction<
    AccumulatedIn,
    NextIn
  >,
  OutputRf extends ReducingFunction<AccumulatedOut, NextOut> = ReducingFunction<
    AccumulatedOut,
    NextOut
  >,
> = (step: InputRf) => OutputRf;

export const mapping = function <X, Y, ReducedY>(
  f: (x: X) => Y,
): TransducingFunction<
  ReducedY,
  Y,
  ReducedY,
  X,
  ReducingFunction<ReducedY, Y>,
  ReducingFunction<ReducedY, X>
> {
  return (
    step: ReducingFunction<ReducedY, Y>,
  ): ReducingFunction<ReducedY, X> => { // return reducer
    return (accumulated: ReducedY, nextX: X) => {
      const nextY: Y = f(nextX);
      return step(accumulated, nextY);
    };
  };
};
