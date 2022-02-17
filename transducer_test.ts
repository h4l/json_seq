import { assert, assertEquals } from "./dev_deps.ts";
import { ReducingFunction, TransducingFunction } from "./transducers.ts";

const mapping = function <X, Y, ReducedY>(
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

const sum: ReducingFunction<number, number> = (accumulated, next) =>
  accumulated + next;

const incrementing: TransducingFunction<number, number, number, number> =
  mapping((x: number) => x + 1);

Deno.test("incrementedSum", () => {
  const incrementedSum = incrementing(sum);

  assertEquals(incrementedSum(0, 1), 2);
});

Deno.test("incrementedSum 2", () => {
  const numbers = [1, 2, 3];
  assertEquals(numbers.reduce(incrementing(sum), 0), 9);
});
