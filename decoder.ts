// deno-lint-ignore no-control-regex
const SEPARATOR = /\x1E/m;
// deno-lint-ignore no-control-regex
const TOKEN_CONTENT = /[^\x1E]/m;
export type ChunkSection = { text: string } | { separators: number };

export function* partitionJSONSeqChunk(chunk: string): Generator<ChunkSection> {
  while (chunk.length) {
    let separatorStart = chunk.search(SEPARATOR);
    separatorStart = separatorStart < 0 ? chunk.length : separatorStart;
    if (separatorStart > 0) {
      yield { text: chunk.substring(0, separatorStart) };
      chunk = chunk.substring(separatorStart);
    }
    let textStart = chunk.search(TOKEN_CONTENT);
    textStart = textStart < 0 ? chunk.length : textStart;
    if (textStart > 0) {
      yield { separators: textStart };
      chunk = chunk.substring(textStart);
    }
  }
}
