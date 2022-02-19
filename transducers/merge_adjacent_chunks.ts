import { Transducer } from "../transducers.ts";
import {
  JSONSeqFragment,
  JSONSeqSeparators,
  PossibleJSONFragment,
} from "./split_json_seq.ts";

function assertUnreachable(_: never): never {
  throw new Error("Unreachable");
}

export type OversizedPossibleJSON = Readonly<{
  type: "OversizedPossibleJSONSection";
  length: number;
  prefix: string;
}>;
export type PossibleJSON = Readonly<{
  type: "PossibleJSON";
  text: string;
}>;

export type JSONSeqElement =
  | JSONSeqSeparators
  | PossibleJSON
  | OversizedPossibleJSON;

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
  left: PossibleJSON | OversizedPossibleJSON | undefined,
  right: PossibleJSONFragment,
  maxStringLength: number,
): PossibleJSON | OversizedPossibleJSON {
  left = left || { type: "PossibleJSON", text: "" };
  if (left?.type === "PossibleJSON") {
    if (left.text.length + right.text.length <= maxStringLength) {
      return {
        type: "PossibleJSON",
        text: left.text + right.text,
      };
    } else {
      return {
        type: "OversizedPossibleJSONSection",
        length: left.text.length + right.text.length,
        prefix: left.text +
          right.text.substring(0, maxStringLength - left.text.length),
      };
    }
  } else if (left.type === "OversizedPossibleJSONSection") {
    return {
      ...left,
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
  let fragment: JSONSeqElement | undefined = undefined;
  return (step) => ({
    init: () => step.init(),
    complete: (accumulation) => {
      const finalisedChunk = fragment;
      fragment = undefined;
      return finalisedChunk === undefined
        ? step.complete(accumulation)
        : step.complete(step.reduce(accumulation, finalisedChunk));
    },
    reduce: (accumulation, value) => {
      if (value.type === "PossibleJSONFragment") {
        if (fragment?.type === "JSONSeqSeparators") {
          accumulation = step.reduce(accumulation, fragment);
          fragment = mergeFragments(undefined, value, maxStringLength);
        } else {
          fragment = mergeFragments(fragment, value, maxStringLength);
        }
      } else if (value.type === "JSONSeqSeparators") {
        if (
          fragment?.type === "OversizedPossibleJSONSection" ||
          fragment?.type === "PossibleJSON"
        ) {
          accumulation = step.reduce(accumulation, fragment);
          fragment = value;
        } else if (
          fragment === undefined || fragment.type === "JSONSeqSeparators"
        ) {
          fragment = {
            type: "JSONSeqSeparators",
            separators: (fragment?.separators ?? 0) + value.separators,
          };
        } else {
          assertUnreachable(fragment);
        }
      } else {
        assertUnreachable(value);
      }
      return accumulation;
    },
  });
}
