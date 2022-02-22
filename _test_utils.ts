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

/** An identity function used to assert that a particular type is expected. */
export const expectType = <T>(t: T): T => t;

/** The type of the values of the `ArrayType` array. */
type ArrayElement<ArrayType> = ArrayType extends readonly unknown[]
  ? (ArrayType extends (infer T)[] ? T : never)
  : never;

/** The tuple type of one value from each array of `Columns`. */
type Row<Columns> = Columns extends [] ? []
  : (Columns extends [infer Col1, ...infer Cols]
    ? [ArrayElement<Col1>, ...Row<Cols>]
    : never);

/** Cartesian product of columns.
 *
 * Equivalent to nested for loops of each col array.
 */
export function* product<Columns extends unknown[][]>(
  ...cols: Columns
): Generator<Row<Columns>> {
  const rowCount = cols.length === 0
    ? 0
    : cols.reduce((length, set) => length * set.length, 1);
  const emitCounts = cols.map((_, i) => {
    return cols.slice(0, i).reduce((n, set) => n * set.length, 1);
  });
  for (let rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
    const row = [] as unknown[];
    for (let colIndex = 0; colIndex < cols.length; ++colIndex) {
      const set = cols[colIndex];
      const setIndex = Math.floor(rowIndex / emitCounts[colIndex]) % set.length;
      row[colIndex] = set[setIndex];
    }
    yield row as Row<Columns>;
  }
}
