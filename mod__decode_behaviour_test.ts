/** Tests for decoder behaviour of malformed streams. */

import {
  assert,
  assertEquals,
  AssertionError,
  readableStreamFromIterable,
} from "./dev_deps.ts";
import {
  JSON_SEQ_END as NL,
  JSON_SEQ_START as RS,
  JsonSequenceDecoderStream,
} from "./mod.ts";

type Json = null | boolean | number | string | { [key: string]: Json } | Json[];

const cases: ReadonlyArray<{
  /** Description of the case for the test name. */
  name: string;
  /** The encoded stream content to be decoded. */
  streamContent: string;

  /**
   * Values emitted by the non-strict decoder. No error is expected.
   */
  normalDecoderResult: ReadonlyArray<Json>;

  /**
   * Values emitted by the strict decoder. An error is expected to be emitted
   * after the final item.
   */
  strictDecoderResult: ReadonlyArray<Json>;
}> = [
  // Section 2 and 2.3 of the RFC encourage decoder's to recover when truncated
  // elements are encountered by skipping to the next RS and ignoring the
  // truncated element (optionally reporting the abnormality). A missing RS at
  // the start would occur if the start of the stream was truncated for any
  // reason.
  {
    name: "truncated initial chunk containing valid JSON",
    streamContent: `{"a":0}${NL}${RS}{"a":1}${NL}`,
    normalDecoderResult: [{ a: 1 }],
    strictDecoderResult: [],
  },
  {
    name: "truncated initial chunk containing junk",
    streamContent: `asdf${NL}${RS}{"a":1}${NL}`,
    normalDecoderResult: [{ a: 1 }],
    strictDecoderResult: [],
  },
  {
    name: "truncated intermediate chunk containing valid JSON",
    // missing NL at end of a:1
    streamContent: `${RS}{"a":0}${NL}${RS}{"a":1}${RS}{"a":2}${NL}`,
    normalDecoderResult: [{ a: 0 }, { a: 1 }, { a: 2 }],
    strictDecoderResult: [{ a: 0 }],
  },
];

for (const { name, streamContent, normalDecoderResult } of cases) {
  Deno.test(`[decode/non-strict]: ${name}`, async () => {
    let stream: ReadableStream<unknown> | undefined = undefined;
    let reader: ReadableStreamReader<unknown> | undefined = undefined;
    try {
      stream = readableStreamFromIterable([streamContent])
        .pipeThrough(new TextEncoderStream())
        .pipeThrough(new JsonSequenceDecoderStream({ strict: false }));
      reader = stream.getReader();
      for (
        const { json: expectedJson, i } of normalDecoderResult.map((
          json,
          i,
        ) => ({
          json,
          i,
        }))
      ) {
        const { done, value: actualJson } = await reader.read();
        assert(
          done === false,
          `premature end of stream: i=${i}, expectedJson=${
            Deno.inspect(expectedJson)
          }`,
        );
        assertEquals(
          actualJson,
          expectedJson,
          `unexpected decoder output: i=${i}, expectedJson=${
            Deno.inspect(expectedJson)
          }, actualJson=${Deno.inspect(actualJson)}`,
        );
      }
      const { done, value } = await reader.read();
      assert(
        done === true,
        `stream produced value when end-of-stream expected: value=${
          Deno.inspect(value)
        }`,
      );
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      throw new AssertionError(`Unexpected error: ${Deno.inspect(e)}`);
    } finally {
      // await reader ? reader?.cancel() : stream?.cancel();
    }
  });
}

// FIXME: if we don't call cancel() at the end of the test, the TextEncoderStream is leaked (Deno test complains about it).
// But if we call cancel on an already-closed stream the resulting error cannot
// be handled and Deno's process exits.
// TODO: Review stream spec to determine error propagation/cancellation
// behaviour so that we can determine if this is a bug.

// if weve leaked the text decoder it coul be throwing the pronise error when the leak is found

for (const { name, streamContent, strictDecoderResult } of cases) {
  Deno.test(`[decode/strict]: ${name}`, async () => {
    let stream: ReadableStream<unknown> | undefined = undefined;
    let reader: ReadableStreamReader<unknown> | undefined = undefined;
    try {
      stream = readableStreamFromIterable([streamContent])
        .pipeThrough(new TextEncoderStream())
        .pipeThrough(new JsonSequenceDecoderStream({ strict: true }));

      reader = stream.getReader();
      for (
        const { json: expectedJson, i } of strictDecoderResult.map((
          json,
          i,
        ) => ({
          json,
          i,
        }))
      ) {
        const { done, value: actualJson } = await reader.read();
        assert(
          done === false,
          `premature end of stream: i=${i}, expectedJson=${
            Deno.inspect(expectedJson)
          }`,
        );
        assertEquals(
          actualJson,
          expectedJson,
          `unexpected decoder output: i=${i}, expectedJson=${
            Deno.inspect(expectedJson)
          }, actualJson=${Deno.inspect(actualJson)}`,
        );
      }
      try {
        const result = await reader.read();
        assert(
          false,
          `stream read() succeeded when error expected: read result=${result}`,
        );
      } catch (e) {
        // error expected
        assert(e);
      }
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      throw new AssertionError(`Unexpected error: ${Deno.inspect(e)}`);
    } finally {
      try {
        // await reader ? reader?.cancel() : stream?.cancel();
        // await stream?.cancel();
      } catch (_e) {
        // ignore
      }
    }
  });
}
