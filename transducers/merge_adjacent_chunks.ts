import { Transducer } from "../transducers.ts";
import { JSONSeqFragment, PossibleJSONFragment } from "./split_json_seq.ts";

function assertUnreachable(_: never): never {
  throw new Error("Unreachable");
}

function assertNonNegative(value: number, label: string) {
  if (value < 0) throw new RangeError(`${label} value was negative: ${value}`);
}

type Text = Readonly<{ text: string; length?: never; prefix?: never }>;
type OversizedText = Readonly<{ length: number; prefix: string; text?: never }>;

function isOversized(text: Text | OversizedText): text is OversizedText {
  return typeof (text as Partial<OversizedText>).prefix === "string";
}

function isEmpty(text: Text | OversizedText): boolean {
  return isOversized(text) ? text.length === 0 : text.text.length === 0;
}

/** An element of a JSON Seq stream whose length exceeds the `maxStringLength`.
 */
export type OversizedPossibleJSON =
  & Readonly<{
    type: "OversizedPossibleJSON";
    leadingSeparators: number;
  }>
  & OversizedText;
/** An element of a JSON Seq stream that is yet to be parsed. */
export type PossibleJSON =
  & Readonly<{
    type: "PossibleJSON";
    leadingSeparators: number;
  }>
  & Text;

/** Content before the first <RS> separators in the stream.
 *
 * Such content is not a valid stream element (it may be truncated).
 */
export type LeadingNonSeparators = Readonly<
  { type: "LeadingNonSeparators" } & (Text | OversizedText)
>;
/** <RS> separators after the final stream element.
 */
export type TrailingSeparators = Readonly<{
  type: "TrailingSeparators";
  separators: number;
}>;

export type JSONSeqElement =
  | LeadingNonSeparators
  | PossibleJSON
  | OversizedPossibleJSON
  | TrailingSeparators;

/**
 * 10MiB — javascript strings are 2 bytes per code unit.
 */
export const DEFAULT_MAX_STRING_LENGTH = 1024 * 1024 * 5;

export interface MergeAdjacentOptions {
  /** The maximum length of output PossibleJSON strings, produced by merging
   * adjacent fragments.
   *
   * This prevents malitous input streams without separators from consuming
   * large amounts of memory.
   */
  maxStringLength?: number;
}

function mergeFragments(
  left: Text | OversizedText,
  right: PossibleJSONFragment,
  maxStringLength: number,
): Text | OversizedText {
  if (!isOversized(left)) {
    if (left.text.length + right.text.length <= maxStringLength) {
      return {
        text: left.text + right.text,
      };
    } else {
      return {
        length: left.text.length + right.text.length,
        prefix: left.text +
          right.text.substring(0, maxStringLength - left.text.length),
      };
    }
  } else if (isOversized(left)) {
    return {
      prefix: left.prefix,
      length: left.length + right.text.length,
    };
  }
  assertUnreachable(left);
}

export function mergeAdjacent<Accumulation>(
  options?: MergeAdjacentOptions,
): Transducer<Accumulation, JSONSeqFragment, Accumulation, JSONSeqElement> {
  const maxStringLength = options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  if (maxStringLength < 0) {
    throw new RangeError(`maxStringLength was negative: ${maxStringLength}`);
  }
  let separators = 0;
  let content: Text | OversizedText = { text: "" };
  return (step) => ({
    init: () => step.init(),
    complete: (accumulation) => {
      if (separators === 0) {
        if (!isEmpty(content)) {
          // end of stream without ever seeing a separator
          accumulation = step.reduce(accumulation, {
            type: "LeadingNonSeparators",
            ...content,
          });
        }
      } else {
        if (isEmpty(content)) {
          accumulation = step.reduce(
            accumulation,
            { type: "TrailingSeparators", separators },
          );
        } else {
          const element = { leadingSeparators: separators, ...content };
          accumulation = step.reduce(
            accumulation,
            isOversized(element)
              ? { type: "OversizedPossibleJSON", ...element }
              : { type: "PossibleJSON", ...element },
          );
        }
      }
      [separators, content] = [0, { text: "" }];
      return step.complete(accumulation);
    },
    reduce: (accumulation, value) => {
      if (value.type === "PossibleJSONFragment") {
        content = mergeFragments(content, value, maxStringLength);
      } else if (value.type === "JSONSeqSeparators") {
        assertNonNegative(value.separators, "JSONSeqSeparators separators");
        if (isEmpty(content)) {
          separators += value.separators;
        } else if (separators === 0) {
          // content with no preceding separators occurs when the stream does
          // not start with a separator. This content is not a valid element.
          accumulation = step.reduce(accumulation, {
            type: "LeadingNonSeparators",
            ...content,
          });
          [separators, content] = [value.separators, { text: "" }];
        } else {
          const element = { leadingSeparators: separators, ...content };
          accumulation = step.reduce(
            accumulation,
            isOversized(element)
              ? { type: "OversizedPossibleJSON", ...element }
              : { type: "PossibleJSON", ...element },
          );
          [separators, content] = [value.separators, { text: "" }];
        }
      } else {
        assertUnreachable(value);
      }
      return accumulation;
    },
  });
}
