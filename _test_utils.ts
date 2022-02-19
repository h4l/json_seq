import { assert, assertEquals } from "./dev_deps.ts";
import { JSON_SEQ_END, JSON_SEQ_START } from "./mod.ts";

export function chunkify(str: string, size: number): string[] {
  assert(size > 0);
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, Math.min(str.length, i + size)));
  }
  return chunks;
}

export function enlargen(chunk: string, length: number): string {
  return chunk.repeat(Math.ceil(length / chunk.length)).substring(0, length);
}

export function jsonSeqChunk<Content extends string = string>(
  content: Content,
): `${typeof JSON_SEQ_START}${Content}${typeof JSON_SEQ_END}` {
  return `${JSON_SEQ_START}${content}${JSON_SEQ_END}`;
}

export async function assertStreamContainsChunks<T>(
  stream: ReadableStream<T>,
  chunks: ReadonlyArray<T>,
): Promise<void> {
  const reader = stream.getReader();
  for (const chunk of chunks) {
    const result = await reader.read();
    assertEquals(result, { done: false, value: chunk });
  }
  const result = await reader.read();
  assertEquals(result, { done: true, value: undefined });
}
