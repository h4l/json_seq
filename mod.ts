/* This module implements the text format, described in [RFC 7464], to
 * represent streams of individual JSON objects (application/json-seq). See
 * [format_notes.md](format_notes.md)
 *
 * [RFC 7464]: https://datatracker.ietf.org/doc/html/rfc7464
 */

export const VERSION = "0.0.0"; // managed by standard-version, do not modify
export const JSON_SEQ_START = "\x1E";
export const JSON_SEQ_END = "\n";

enum State {
  BEFORE_CHUNK_START,
  BEFORE_CHUNK_END,
}

export interface _JsonSeqDelimiterTransformerOptions {
  strict?: boolean;
}

export function _jsonSeqDelimiterTransformer(
  options?: _JsonSeqDelimiterTransformerOptions,
): Transformer<string, string> {
  const strict = options?.strict === undefined ? false : options?.strict;
  let state: State = State.BEFORE_CHUNK_START;
  let unDelimitedChunks: string[] = [];

  return {
    transform(chunk, controller) {
      while (chunk) {
        if (state === State.BEFORE_CHUNK_START) {
          const start = chunk.indexOf(JSON_SEQ_START);
          if (strict && start !== 0) {
            throw new Error(
              `leading content before chunk start: ${
                start < 0 ? chunk : chunk.substring(0, start)
              }`,
            );
          }
          if (start < 0) {
            // ignore leading content before a chunk start
            return;
          }
          state = State.BEFORE_CHUNK_END;
          chunk = chunk.substring(start + 1);
        }
        const end = chunk.indexOf(JSON_SEQ_END);
        if (end < 0) {
          if (chunk) {
            unDelimitedChunks.push(chunk);
          }
          return;
        }
        const chunkTail = chunk.substring(0, end);
        unDelimitedChunks.push(chunkTail);
        controller.enqueue(unDelimitedChunks.join(""));
        unDelimitedChunks = [];

        state = State.BEFORE_CHUNK_START;
        chunk = chunk.substring(end + 1);
      }
    },
    flush() {
      if (strict && unDelimitedChunks.length) {
        throw new Error(`end of stream before chunk end`);
      }
    },
  };
}

export function _stringToJSONTransformer(): Transformer<string, unknown> {
  return {
    transform(chunk, controller) {
      controller.enqueue(JSON.parse(chunk));
    },
  };
}

export interface JsonSequenceDecoderStreamOptions {
  /** If `true`, raise errors instead of recovering when parsing malformed
   * streams.
   *
   * The default is `false`, as the json-seq spec (RFC 7464) encourages decoders
   * to automatically handle stream errors, such as truncated JSON texts.
   *
   * * When `true`, the decoder behaves as if the stream format **MUST** exactly
   * match the [JSON Text Sequence Encoding] format.
   * * When `false` the decoder follows the more permissive
   *   [JSON Text Sequence Parsing] format and other permissive behaviour
   *   described in the spec.
   *
   * [JSON Text Sequence Encoding]: https://datatracker.ietf.org/doc/html/rfc7464#section-2.2
   * [JSON Text Sequence Parsing]: https://datatracker.ietf.org/doc/html/rfc7464#section-2.1
   */
  strict?: boolean;
}

/** A streaming decoder that decodes RFC 7464 JSON Sequences to JSON values.
 *
 * The stream consumes UTF-8-encoded bytes. The byte stream consists of zero or
 * more JSON-encoded values, each of which is preceded by a `'\x1E'` character,
 * and followed by a `'\n'` character.
 *
 * The stream produces the values resulting from parsing each individual JSON
 * text in the stream.
 */
export class JsonSequenceDecoderStream
  implements TransformStream<Uint8Array, unknown> {
  readonly readable: ReadableStream<unknown>;
  readonly writable: WritableStream<Uint8Array>;

  constructor(options?: JsonSequenceDecoderStreamOptions) {
    const decoder = new TextDecoderStream();
    this.readable = decoder.readable
      .pipeThrough(new TransformStream(_jsonSeqDelimiterTransformer(options)))
      .pipeThrough(new TransformStream(_stringToJSONTransformer()));
    this.writable = decoder.writable;
  }
}
