import { decodeText } from "./decode_text.ts";
import { encode, testingReducer } from "../_testing.ts";
import { assertEquals } from "../dev_deps.ts";

Deno.test("decodeText(): init() calls init()", () => {
  const state = decodeText(testingReducer()).init();
  assertEquals(state, { initCount: 1, completeCount: 0, values: [] });
});

Deno.test("decodeText(): reduce() decodes input bytes", () => {
  const reducer = decodeText(testingReducer());
  const state = reducer.init();
  const state2 = reducer.reduce(state, encode("Hi! 👋"));
  assertEquals(state2, { initCount: 1, completeCount: 0, values: ["Hi! 👋"] });
  // must flush the transducer to close the TextDecoder it holds
  reducer.complete(state2);
});

Deno.test("decodeText(): complete() flushes no value when no input has been processed", () => {
  const reducer = decodeText(testingReducer());
  const state = reducer.init();
  const state2 = reducer.complete(state);
  assertEquals(state2, { initCount: 1, completeCount: 1, values: [] });
});

Deno.test("decodeText(): complete() flushes no value when the most recent input was not partial", () => {
  const reducer = decodeText(testingReducer());
  const state = reducer.init();
  const state2 = reducer.reduce(state, encode("Hi! 👋"));
  const state3 = reducer.complete(state2);
  assertEquals(state3, { initCount: 1, completeCount: 1, values: ["Hi! 👋"] });
});

Deno.test("decodeText(): complete() flushes no the partial value when the most recent input was partial", () => {
  const encoded = encode("Hi! 👋");
  assertEquals(encoded.length, 8);
  const [partial1, partial2] = [encoded.slice(0, 6), encoded.slice(6)];
  const reducer = decodeText(testingReducer());
  const state0 = reducer.init();
  const state1 = reducer.reduce(state0, partial1);
  assertEquals(state1, { initCount: 1, completeCount: 0, values: ["Hi! "] });
  const state2 = reducer.reduce(state1, partial2);
  const state3 = reducer.complete(state2);
  assertEquals(state3, {
    initCount: 1,
    completeCount: 1,
    values: ["Hi! ", "👋"],
  });
});
