import { assertEquals } from "./dev_deps.ts";
import { mapping, transduce } from "./transducers.ts";
import { testingReducer } from "./_testing.ts";

Deno.test("transduce() without initial value", () => {
  const state = transduce(mapping((x) => x + 1), testingReducer(), [0, 1, 2]);
  assertEquals(state, {
    values: [1, 2, 3],
    initCount: 1,
    completeCount: 1,
  });
});

Deno.test("transduce() with initial value", () => {
  const state = transduce(mapping((x) => x + 1), testingReducer(), [0, 1, 2], {
    values: [10, 11, 12],
    initCount: 0,
    completeCount: 0,
  });
  assertEquals(state, {
    values: [10, 11, 12, 1, 2, 3],
    initCount: 0, // init not called
    completeCount: 1,
  });
});
