import { assert, assertEquals } from "./dev_deps.ts";
import {
  JSON_SEQ_END,
  JSON_SEQ_START,
  jsonSeqDelimiterTransformer,
  stringToJSONTransformer,
} from "./mod.ts";
import { readableStreamFromIterable } from "https://deno.land/std@0.117.0/streams/mod.ts";

const LARGE_CHUNK_SIZE = 1000033;

function chunkify(str: string, size: number): string[] {
  assert(size > 0);
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, Math.min(str.length, i + size)));
  }
  return chunks;
}

Deno.test("chunkify", () => {
  assertEquals(chunkify("", 1), []);
  assertEquals(chunkify("", 10), []);
  assertEquals(chunkify("foo", 10), ["foo"]);
  assertEquals(chunkify("foo", 1), ["f", "o", "o"]);
  assertEquals(chunkify("foo", 2), ["fo", "o"]);
});

function enlargen(chunk: string, length: number): string {
  return chunk.repeat(Math.ceil(length / chunk.length)).substring(0, length);
}

Deno.test("enlargen", () => {
  assertEquals(enlargen("a", 3), "aaa");
  assertEquals(enlargen("abc", 5), "abcab");
  assertEquals(enlargen("abc", 1), "a");
  assertEquals(enlargen("abc", 2), "ab");
  assertEquals(enlargen("abc", 3), "abc");
});

function jsonSeqChunk<Content extends string = string>(
  content: Content
): `${typeof JSON_SEQ_START}${Content}${typeof JSON_SEQ_END}` {
  return `${JSON_SEQ_START}${content}${JSON_SEQ_END}`;
}

async function assertStreamContainsChunks<T>(
  stream: ReadableStream<T>,
  chunks: ReadonlyArray<T>
): Promise<void> {
  const reader = stream.getReader();
  for (const chunk of chunks) {
    const result = await reader.read();
    assertEquals(result, { done: false, value: chunk });
  }
  const result = await reader.read();
  assertEquals(result, { done: true, value: undefined });
}

Deno.test("jsonSeqDelimiterTransformer() transforms empty stream", async () => {
  const emptyStream = readableStreamFromIterable([]);
  const jsonSeqChunkStream = emptyStream.pipeThrough(
    new TransformStream(jsonSeqDelimiterTransformer())
  );
  await assertStreamContainsChunks(jsonSeqChunkStream, []);
});

Deno.test("jsonSeqDelimiterTransformer() transforms single chunk", async () => {
  const emptyStream = readableStreamFromIterable([jsonSeqChunk("content")]);
  const jsonSeqChunkStream = emptyStream.pipeThrough(
    new TransformStream(jsonSeqDelimiterTransformer())
  );
  await assertStreamContainsChunks(jsonSeqChunkStream, ["content"]);
});

Deno.test(
  "jsonSeqDelimiterTransformer() transforms multiple chunks",
  async () => {
    const chunks = ["foo", "bar", "baz"];
    const emptyStream = readableStreamFromIterable(chunks.map(jsonSeqChunk));
    const jsonSeqChunkStream = emptyStream.pipeThrough(
      new TransformStream(jsonSeqDelimiterTransformer())
    );
    await assertStreamContainsChunks(jsonSeqChunkStream, chunks);
  }
);

Deno.test("jsonSeqDelimiterTransformer() transforms large chunks", async () => {
  const chunks = ["foo", "bar", "baz"].map((c) =>
    enlargen(c, LARGE_CHUNK_SIZE)
  );

  const emptyStream = readableStreamFromIterable(
    chunkify(chunks.map(jsonSeqChunk).join(""), 1013)
  );
  const jsonSeqChunkStream = emptyStream.pipeThrough(
    new TransformStream(jsonSeqDelimiterTransformer())
  );
  await assertStreamContainsChunks(jsonSeqChunkStream, chunks);
});

const malformedStreams = [
  {
    name: "content before first chunk",
    chunks: [null, "foo", "bar", "baz"],
    streamContent: [
      "junk",
      jsonSeqChunk("foo"),
      jsonSeqChunk("bar"),
      jsonSeqChunk("baz"),
    ].join(""),
  },
  {
    name: "content after last chunk",
    chunks: ["foo", "bar", null],
    streamContent: [jsonSeqChunk("foo"), jsonSeqChunk("bar"), "junk"].join(""),
  },
  {
    name: "content in between chunks",
    chunks: ["foo", null, "bar", "baz"],
    streamContent: [
      jsonSeqChunk("foo"),
      "junk",
      jsonSeqChunk("bar"),
      jsonSeqChunk("baz"),
    ].join(""),
  },
  {
    name: "partial chunk at end",
    chunks: ["foo", "bar", null],
    streamContent: [
      jsonSeqChunk("foo"),
      jsonSeqChunk("bar"),
      `${JSON_SEQ_START}baz`,
    ].join(""),
  },
  {
    name: "partial chunk at start",
    chunks: [null, "bar", "baz"],
    streamContent: [
      `foo${JSON_SEQ_END}`,
      jsonSeqChunk("bar"),
      jsonSeqChunk("baz"),
    ].join(""),
  },
];

const inputChunkSizes = [1, 4, LARGE_CHUNK_SIZE] as const;

for (const inputChunkSize of inputChunkSizes) {
  for (const { name, chunks, streamContent } of malformedStreams) {
    Deno.test(
      `jsonSeqDelimiterTransformer() rejects malformed streams with ${name} in strict mode (inputChunkSize: ${inputChunkSize})`,
      async () => {
        const emptyStream = readableStreamFromIterable(
          chunkify(streamContent, inputChunkSize)
        );
        const jsonSeqChunkStream = emptyStream.pipeThrough(
          new TransformStream(jsonSeqDelimiterTransformer())
        );
        const reader = jsonSeqChunkStream.getReader();
        for (const chunk of chunks) {
          if (chunk === null) {
            try {
              await reader.read();
              assert(false, "read() did not throw");
            } catch (_e) {
              return;
            }
          } else {
            const result = await reader.read();
            assertEquals(result, { done: false, value: chunk });
          }
        }
      }
    );

    Deno.test(
      `jsonSeqDelimiterTransformer() accepts malformed streams with ${name} in non-strict mode (inputChunkSize: ${inputChunkSize})`,
      async () => {
        const emptyStream = readableStreamFromIterable(
          chunkify(streamContent, inputChunkSize)
        );
        const jsonSeqChunkStream = emptyStream.pipeThrough(
          new TransformStream(jsonSeqDelimiterTransformer({ strict: false }))
        );
        const resultChunks = chunks.filter(
          (c): c is string => typeof c === "string"
        );
        await assertStreamContainsChunks(jsonSeqChunkStream, resultChunks);
      }
    );
  }
}

Deno.test("stringToJSONTransformer() parses chunks", async () => {
  const values = [{ an: "object" }, ["array"], true, false, null, 123, "foo"];
  const stream = readableStreamFromIterable(
    values.map((val) => JSON.stringify(val, undefined, 2))
  ).pipeThrough(new TransformStream(stringToJSONTransformer()));

  await assertStreamContainsChunks(stream, values);
});

Deno.test(
  "stringToJSONTransformer() errors stream on invalid JSON",
  async () => {
    const stream = readableStreamFromIterable([
      '{"ok": true}',
      '{"invalid',
    ]).pipeThrough(new TransformStream(stringToJSONTransformer()));

    const reader = stream.getReader();
    assertEquals(await reader.read(), { done: false, value: { ok: true } });
    try {
      await reader.read();
      assert(false, "read() did not throw");
    } catch (e) {
      assert(e instanceof SyntaxError);
    }
  }
);

Deno.test("async iterable", async () => {
  const values = [{}, [], true];
  const stream = readableStreamFromIterable(
    [{}, [], true].map((val) => JSON.stringify(val, undefined, 2))
  ).pipeThrough(new TransformStream(stringToJSONTransformer()));

  for await (const val of stream) {
    assertEquals(val, values.shift());
  }
});
