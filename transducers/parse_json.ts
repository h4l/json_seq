type JSONParser = <T>(string: string) => T;
export type JSONValue = string | number | boolean | null | Array<JSONValue> | {
  [key: string]: JSONValue;
};

type TruncatedJSON = {
  type: "TruncatedJSON";
  jsonValue: number | boolean | null;
  text: string;
};
type ParsedJSON = {
  type: "ParsedJSON";
  jsonValue: JSONValue;
  text: string;
};
type InvalidJSON = {
  type: "InvalidJSON";
  text: string;
  parseError: string;
};

type ParseResult = ParsedJSON | TruncatedJSON | InvalidJSON;

export function parseJson(text: string): ParseResult {
  try {
    const jsonValue = JSON.parse(text) as JSONValue;
    if (couldBeTruncated(text, jsonValue)) {
      return { type: "TruncatedJSON", jsonValue, text };
    }
    return { type: "ParsedJSON", jsonValue, text };
  } catch (e) {
    return { type: "InvalidJSON", text, parseError: e.message };
  }
}

export function couldBeTruncated(
  jsonText: string,
  jsonValue: JSONValue,
): jsonValue is (boolean | null | number) {
  return (typeof jsonValue === "boolean" || typeof jsonValue === "number" ||
    jsonValue === null) && !/[ \t\r\n]+$/.test(jsonText);
}
