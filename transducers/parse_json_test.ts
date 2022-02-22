import { assertStrictEquals } from "../dev_deps.ts";
import { expectType, product } from "../_test_utils.ts";
import { couldBeTruncated, JSONValue } from "./parse_json.ts";

const prefixes = ["", " ", "  \t\r\n"].map((prefix) => ({ prefix }));
const selfDelimitingJSON = ['"foo"', '{"foo": true}', "[1, 2]"];
const nonSelfDelimitingJSON = ["true", "false", "null", "1", "43.3", "1e+3"];
const whitespace = [" ", "\t", "\r", "\n", "  \t\r\n"];

const jsonExamples = [
  ...selfDelimitingJSON.map((jsonText) => ({
    isSelfDelimiting: true,
    jsonText,
  })),
  ...nonSelfDelimitingJSON.map((jsonText) => ({
    isSelfDelimiting: false,
    jsonText,
  })),
];
const suffixes = [
  { isSuffixIsWhitespace: false, suffix: "" },
  ...whitespace.map((suffix) => ({ isSuffixIsWhitespace: true, suffix })),
];

const coudlBeTruncatedExamples = [...product(prefixes, jsonExamples, suffixes)]
  .map(([p, j, s]) => ({ ...p, ...j, ...s }));

coudlBeTruncatedExamples.forEach(
  ({ prefix, jsonText, isSelfDelimiting, isSuffixIsWhitespace, suffix }) => {
    const exampleJSONText = `${prefix}${jsonText}${suffix}`;
    const _couldBeTruncated = (!isSelfDelimiting) && (!isSuffixIsWhitespace);
    const msg = _couldBeTruncated
      ? "could be truncated"
      : "could NOT be truncated";
    Deno.test(`coudlBeTruncated(): ${msg}: ${JSON.stringify(exampleJSONText)}`, () => {
      const jsonValue = JSON.parse(exampleJSONText) as JSONValue;
      const cbt = couldBeTruncated(exampleJSONText, jsonValue);
      assertStrictEquals(cbt, _couldBeTruncated);

      if (cbt) {
        expectType<boolean | null | number>(jsonValue);
      } else {
        expectType<JSONValue>(jsonValue);
      }
    });
  },
);
