/* This module implements the text format, described in [RFC 7464], to
 * represent streams of individual JSON objects (application/json-seq). See
 * [format_notes.md](format_notes.md)
 *
 * [RFC 7464]: https://datatracker.ietf.org/doc/html/rfc7464
 */

export const JSON_SEQ_START = "\x1E";
export const JSON_SEQ_END = "\n";

enum State {
  BEFORE_CHUNK_START,
  BEFORE_CHUNK_END,
}

export function jsonSeqDelimiterTransformer(options?: {
  strict?: boolean;
}): Transformer<string, string> {
  const strict = options?.strict === undefined ? true : options?.strict;
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
              }`
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

export function stringToJSONTransformer(): Transformer<string, unknown> {
  return {
    transform(chunk, controller) {
      controller.enqueue(JSON.parse(chunk));
    },
  };
}

export class JsonSequenceDecoderStream
  implements TransformStream<Uint8Array, unknown>
{
  readonly readable: ReadableStream<unknown>;
  readonly writable: WritableStream<Uint8Array>;

  constructor() {
    const decoder = new TextDecoderStream();
    this.readable = decoder.readable
      .pipeThrough(new TransformStream(jsonSeqDelimiterTransformer()))
      .pipeThrough(new TransformStream(stringToJSONTransformer()));
    this.writable = decoder.writable;
  }
}
