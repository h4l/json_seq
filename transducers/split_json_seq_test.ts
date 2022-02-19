import { assertEquals } from "../dev_deps.ts";
import { transduce } from "../transducers.ts";
import { testingReducer } from "../_testing.ts";
import { JSONSeqFragment, splitJSONSeq } from "./split_json_seq.ts";

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

const splitChunkExamples: ReadonlyArray<
  { chunk: string; split: ReadonlyArray<JSONSeqFragment> }
> = [
  { chunk: "", split: [] },
  { chunk: "foo", split: [{ type: "PossibleJSONFragment", text: "foo" }] },
  { chunk: `${RS}`, split: [{ type: "JSONSeqSeparators", separators: 1 }] },
  {
    chunk: `${RS}${RS}`,
    split: [{ type: "JSONSeqSeparators", separators: 2 }],
  },
  {
    chunk: `${RS}${RS}foo`,
    split: [
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "foo" },
    ],
  },
  {
    chunk: `foo${RS}${RS}bar`,
    split: [
      { type: "PossibleJSONFragment", text: "foo" },
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "bar" },
    ],
  },
  {
    chunk: `${RS}foo${RS}${RS}bar${RS}`,
    split: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "foo" },
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "bar" },
      { type: "JSONSeqSeparators", separators: 1 },
    ],
  },
  {
    chunk: `${RS}foo\nbar${RS}`,
    split: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "foo\nbar" },
      { type: "JSONSeqSeparators", separators: 1 },
    ],
  },
];

splitChunkExamples.forEach((example, i) => {
  Deno.test(`reduce() splits input chunks [${i + 1}/${splitChunkExamples.length}]`, () => {
    const state = transduce(splitJSONSeq, testingReducer(), [example.chunk]);
    assertEquals(state, {
      initCount: 1,
      completeCount: 1,
      values: example.split,
    });
  });
});
