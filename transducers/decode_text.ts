import { Reducer } from "../transducers.ts";

/**
 * A transducer that decodes to UTF8 to strings.
 */
export function decodeText<Accumulation>(
  step: Reducer<Accumulation, string>,
): Reducer<Accumulation, Uint8Array> {
  const decoder = new TextDecoder();
  return {
    init: () => step.init(),
    complete: (accumulation) => {
      const finalValue = decoder.decode();
      return finalValue
        ? step.complete(step.reduce(accumulation, finalValue))
        : step.complete(accumulation);
    },
    reduce: (accumulation, value) =>
      step.reduce(accumulation, decoder.decode(value, { stream: true })),
  };
}
