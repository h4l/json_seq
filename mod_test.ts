// Copyright 2021 Hal Blackburn. All rights reserved. MIT license.

import {
  assert,
  assertEquals,
  readableStreamFromIterable,
  unreachable,
} from "./dev_deps.ts";
import {
  _jsonSeqDelimiterTransformer,
  _stringToJSONTransformer,
  JSON_SEQ_END,
  JSON_SEQ_START,
  JsonSequenceDecoderStream,
} from "./mod.ts";
import {
  ENABLE_LEAKING_TESTS,
  LEAKING_TEST_SUFFIX,
} from "./_testing/leaking_tests.ts";
import {
  assertStreamContainsChunks,
  chunkify,
  enlargen,
  jsonSeqChunk,
} from "./_test_utils.ts";

const LARGE_CHUNK_SIZE = 1000033;

Deno.test(
  "_jsonSeqDelimiterTransformer() transforms empty stream",
  async () => {
    const emptyStream = readableStreamFromIterable([]);
    const jsonSeqChunkStream = emptyStream.pipeThrough(
      new TransformStream(_jsonSeqDelimiterTransformer()),
    );
    await assertStreamContainsChunks(jsonSeqChunkStream, []);
  },
);

Deno.test(
  "_jsonSeqDelimiterTransformer() transforms single chunk",
  async () => {
    const emptyStream = readableStreamFromIterable([jsonSeqChunk("content")]);
    const jsonSeqChunkStream = emptyStream.pipeThrough(
      new TransformStream(_jsonSeqDelimiterTransformer()),
    );
    await assertStreamContainsChunks(jsonSeqChunkStream, ["content"]);
  },
);

Deno.test(
  "_jsonSeqDelimiterTransformer() transforms multiple chunks",
  async () => {
    const chunks = ["foo", "bar", "baz"];
    const emptyStream = readableStreamFromIterable(chunks.map(jsonSeqChunk));
    const jsonSeqChunkStream = emptyStream.pipeThrough(
      new TransformStream(_jsonSeqDelimiterTransformer()),
    );
    await assertStreamContainsChunks(jsonSeqChunkStream, chunks);
  },
);

Deno.test(
  "_jsonSeqDelimiterTransformer() transforms large chunks",
  async () => {
    const chunks = ["foo", "bar", "baz"].map((c) =>
      enlargen(c, LARGE_CHUNK_SIZE)
    );

    const emptyStream = readableStreamFromIterable(
      chunkify(chunks.map(jsonSeqChunk).join(""), 1013),
    );
    const jsonSeqChunkStream = emptyStream.pipeThrough(
      new TransformStream(_jsonSeqDelimiterTransformer()),
    );
    await assertStreamContainsChunks(jsonSeqChunkStream, chunks);
  },
);

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
          chunkify(streamContent, inputChunkSize),
        );
        const jsonSeqChunkStream = emptyStream.pipeThrough(
          new TransformStream(_jsonSeqDelimiterTransformer({ strict: true })),
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
      },
    );

    Deno.test(
      `jsonSeqDelimiterTransformer() accepts malformed streams with ${name} in non-strict mode (inputChunkSize: ${inputChunkSize})`,
      async () => {
        const emptyStream = readableStreamFromIterable(
          chunkify(streamContent, inputChunkSize),
        );
        const jsonSeqChunkStream = emptyStream.pipeThrough(
          new TransformStream(_jsonSeqDelimiterTransformer({ strict: false })),
        );
        const resultChunks = chunks.filter(
          (c): c is string => typeof c === "string",
        );
        await assertStreamContainsChunks(jsonSeqChunkStream, resultChunks);
      },
    );
  }
}

Deno.test("_stringToJSONTransformer() parses chunks", async () => {
  const values = [{ an: "object" }, ["array"], true, false, null, 123, "foo"];
  const stream = readableStreamFromIterable(
    values.map((val) => JSON.stringify(val, undefined, 2)),
  ).pipeThrough(new TransformStream(_stringToJSONTransformer()));

  await assertStreamContainsChunks(stream, values);
});

Deno.test(
  "_stringToJSONTransformer() errors stream on invalid JSON",
  async () => {
    const stream = readableStreamFromIterable([
      '{"ok": true}',
      '{"invalid',
    ]).pipeThrough(new TransformStream(_stringToJSONTransformer()));

    const reader = stream.getReader();
    assertEquals(await reader.read(), { done: false, value: { ok: true } });
    try {
      await reader.read();
      assert(false, "read() did not throw");
    } catch (e) {
      assert(e instanceof SyntaxError);
    }
  },
);

Deno.test("JsonSequenceDecoderStream", async () => {
  const content = [{ foo: "bar" }, { foo: "baz" }];
  await assertStreamContainsChunks(
    readableStreamFromIterable(
      content.map((c) => JSON.stringify(c)).map(jsonSeqChunk),
    )
      .pipeThrough(new TextEncoderStream())
      .pipeThrough(new JsonSequenceDecoderStream()),
    content,
  );
});

const strictOptionVariants = [
  { options: undefined, isStrict: false },
  { options: {}, isStrict: false },
  { options: { strict: true }, isStrict: true },
  { options: { strict: false }, isStrict: false },
] as const;

for (const { options, isStrict } of strictOptionVariants) {
  Deno.test(
    `JsonSequenceDecoderStream is${
      isStrict ? "" : " not"
    } strict when constructed with options ${Deno.inspect(options)}`,
    async () => {
      const content = `junk${jsonSeqChunk(`"foo"`)}`;
      const stream = readableStreamFromIterable([content])
        .pipeThrough(new TextEncoderStream())
        .pipeThrough(new JsonSequenceDecoderStream());
      const reader = stream.getReader();

      if (isStrict) {
        try {
          await reader.read();
          assert(
            false,
            "read() should have raised due to malformed stream in strict mode",
          );
        } catch (_e) {
          /* expected */
        }
      } else {
        assertEquals(await reader.read(), { done: false, value: "foo" });
        assertEquals(await reader.read(), { done: true, value: undefined });
      }
    },
  );
}

Deno.test("JSON Sequence ReadableStreams are async iterable", async () => {
  const values = [{}, [], true];
  const stream = readableStreamFromIterable(
    [{}, [], true].map((val) => JSON.stringify(val, undefined, 2)),
  ).pipeThrough(new TransformStream(_stringToJSONTransformer()));

  for await (const val of stream) {
    assertEquals(val, values.shift());
  }
});

// This is failing due to the TextDecoderStream resource leak, see
// _testing/text_decoder_stream_behaviour_test.ts
Deno.test({
  ignore: !ENABLE_LEAKING_TESTS,
  name:
    `[JsonSequenceDecoderStream] errors propagate upstream ${LEAKING_TEST_SUFFIX}`,
  fn: async () => {
    let srcCancelled = false;
    let destAborted = false;
    const src = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(jsonSeqChunk("invalid")));
      },
      cancel(reason) {
        srcCancelled = true;
        assert(reason instanceof SyntaxError);
      },
    });
    const tx = new JsonSequenceDecoderStream();
    const dest = new WritableStream({
      abort(reason) {
        destAborted = true;
        assert(reason instanceof SyntaxError);
      },
    });

    try {
      await src.pipeThrough(tx).pipeTo(dest);
      unreachable();
    } catch (e) {
      assert(srcCancelled);
      assert(destAborted);
      assert(e instanceof SyntaxError);
    }
  },
});
