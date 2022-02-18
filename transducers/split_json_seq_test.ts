import { assertEquals } from "../dev_deps.ts";
import { testingReducer } from "../_testing.ts";
import { splitJSONSeq } from "./split_json_seq.ts";

const RS = "\x1E";

Deno.test("init() calls init()", () => {
  const state = splitJSONSeq(testingReducer()).init();
  assertEquals(state, { initCount: 1, completeCount: 0, values: [] });
});

Deno.test("complete() calls complete()", () => {
  const reducer = splitJSONSeq(testingReducer());
  const state = reducer.complete(reducer.init());
  assertEquals(state, { initCount: 1, completeCount: 1, values: [] });
});

const splitChunkExamples = [
  { chunk: "", split: [] },
  { chunk: "foo", split: [{ text: "foo" }] },
  { chunk: `${RS}`, split: [{ separators: 1 }] },
  { chunk: `${RS}${RS}`, split: [{ separators: 2 }] },
  { chunk: `${RS}${RS}foo`, split: [{ separators: 2 }, { text: "foo" }] },
  {
    chunk: `foo${RS}${RS}bar`,
    split: [{ text: "foo" }, { separators: 2 }, { text: "bar" }],
  },
  {
    chunk: `${RS}foo${RS}${RS}bar${RS}`,
    split: [{ separators: 1 }, { text: "foo" }, { separators: 2 }, {
      text: "bar",
    }, { separators: 1 }],
  },
  {
    chunk: `${RS}foo\nbar${RS}`,
    split: [{ separators: 1 }, { text: "foo\nbar" }, { separators: 1 }],
  },
] as const;

splitChunkExamples.forEach((example, i) => {
  Deno.test(`reduce() splits input chunks [${i + 1}/${splitChunkExamples.length}]`, () => {
    const reducer = splitJSONSeq(testingReducer());
    let state = reducer.init();
    state = reducer.reduce(state, example.chunk);
    assertEquals(state, {
      initCount: 1,
      completeCount: 0,
      values: example.split,
    });
  });
});
