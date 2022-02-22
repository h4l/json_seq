import { assert, assertEquals, assertThrows } from "../dev_deps.ts";
import { transduce } from "../transducers.ts";
import { testingReducer, TestingReducerState } from "../_testing.ts";
import {
  DEFAULT_MAX_STRING_LENGTH,
  JSONSeqElement,
  mergeAdjacent,
  MergeAdjacentOptions,
} from "./merge_adjacent_chunks.ts";
import { JSONSeqFragment } from "./split_json_seq.ts";

const mergeAdjacentExamples: ReadonlyArray<
  {
    name?: string;
    inputs: ReadonlyArray<JSONSeqFragment>;
    options?: MergeAdjacentOptions;
    outputs: ReadonlyArray<JSONSeqElement>;
  }
> = [
  { inputs: [], outputs: [] },
  {
    name: "single element",
    inputs: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "foo" },
    ],
    outputs: [
      { type: "PossibleJSON", text: "foo", leadingSeparators: 1 },
    ],
  },
  {
    name: "single element, multiple fragments",
    inputs: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "f" },
      { type: "PossibleJSONFragment", text: "oo" },
    ],
    outputs: [
      { type: "PossibleJSON", text: "foo", leadingSeparators: 3 },
    ],
  },
  {
    name: "multiple elements",
    inputs: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "f" },
      { type: "PossibleJSONFragment", text: "oo" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "bar" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "baz" },
    ],
    outputs: [
      { type: "PossibleJSON", text: "foo", leadingSeparators: 3 },
      { type: "PossibleJSON", text: "bar", leadingSeparators: 1 },
      { type: "PossibleJSON", text: "baz", leadingSeparators: 2 },
    ],
  },
  {
    name: "single separator with no text",
    inputs: [{ type: "JSONSeqSeparators", separators: 1 }],
    outputs: [{ type: "TrailingSeparators", separators: 1 }],
  },
  {
    name: "multiple separators with no text",
    inputs: [
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 2 },
    ],
    outputs: [{ type: "TrailingSeparators", separators: 3 }],
  },
  {
    name: "single text fragment with no separators",
    inputs: [{ type: "PossibleJSONFragment", text: "foo" }],
    outputs: [{ type: "LeadingNonSeparators", text: "foo" }],
  },
  {
    name: "multiple text fragments with no separators",
    inputs: [
      { type: "PossibleJSONFragment", text: "f" },
      { type: "PossibleJSONFragment", text: "oo" },
    ],
    outputs: [{ type: "LeadingNonSeparators", text: "foo" }],
  },

  {
    name: "oversized fragment without separators",
    options: { maxStringLength: 4 },
    inputs: [
      { type: "PossibleJSONFragment", text: "12345" },
    ],
    outputs: [
      { type: "LeadingNonSeparators", prefix: "1234", length: 5 },
    ],
  },
  {
    name: "multiple oversized fragmetns without separators",
    options: { maxStringLength: 4 },
    inputs: [
      { type: "PossibleJSONFragment", text: "123" },
      { type: "PossibleJSONFragment", text: "456" },
      { type: "PossibleJSONFragment", text: "789" },
    ],
    outputs: [
      { type: "LeadingNonSeparators", prefix: "1234", length: 9 },
    ],
  },
  {
    name: "interleaved fragments with oversize strings",
    options: { maxStringLength: 4 },
    inputs: [
      { type: "PossibleJSONFragment", text: "abc" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 2 },
      { type: "PossibleJSONFragment", text: "f" },
      { type: "PossibleJSONFragment", text: "oo" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "bar" },
      { type: "PossibleJSONFragment", text: "bar" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "bazbaz" },
      { type: "PossibleJSONFragment", text: "bazbaz" },
      { type: "JSONSeqSeparators", separators: 1 },
      { type: "PossibleJSONFragment", text: "baz" },
      { type: "JSONSeqSeparators", separators: 1 },
    ],
    outputs: [
      { type: "LeadingNonSeparators", text: "abc" },
      { type: "PossibleJSON", text: "foo", leadingSeparators: 3 },
      {
        type: "OversizedPossibleJSON",
        prefix: "barb",
        length: 6,
        leadingSeparators: 1,
      },
      {
        type: "OversizedPossibleJSON",
        prefix: "bazb",
        length: 12,
        leadingSeparators: 2,
      },
      { type: "PossibleJSON", text: "baz", leadingSeparators: 1 },
      { type: "TrailingSeparators", separators: 1 },
    ],
  },
];

mergeAdjacentExamples.forEach((example, i) => {
  const name = example.name ? ` - ${example.name}` : "";
  Deno.test(`mergeAdjacent() merges example [${i + 1}/${mergeAdjacentExamples.length}]${name}`, () => {
    const state = transduce(
      mergeAdjacent<TestingReducerState<JSONSeqElement>>(example.options),
      testingReducer(),
      example.inputs,
    );
    assertEquals(state, {
      initCount: 1,
      completeCount: 1,
      values: example.outputs,
    });
  });
});

Deno.test("maxStringLength cannot be negative", () => {
  assertThrows(
    () => mergeAdjacent({ maxStringLength: -1 }),
    RangeError,
    "maxStringLength was negative: -1",
  );
});

Deno.test("default maxStringLength is DEFAULT_MAX_STRING_LENGTH", () => {
  const oversizeText = "a".repeat(DEFAULT_MAX_STRING_LENGTH + 1);
  const state = transduce(
    mergeAdjacent<TestingReducerState<JSONSeqElement>>(),
    testingReducer(),
    [{ type: "JSONSeqSeparators", separators: 1 }, {
      type: "PossibleJSONFragment",
      text: oversizeText,
    }],
  );
  assert(state.values.length === 1);
  const [x] = state.values;
  assert(x.type === "OversizedPossibleJSON");
  assertEquals(x.length, DEFAULT_MAX_STRING_LENGTH + 1);
  assert(x.prefix === oversizeText.substring(0, DEFAULT_MAX_STRING_LENGTH));
});