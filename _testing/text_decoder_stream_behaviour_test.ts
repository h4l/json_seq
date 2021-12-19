import { assert, assertEquals, assertRejects } from "../dev_deps.ts";
import { ENABLE_LEAKING_TESTS, LEAKING_TEST_SUFFIX } from "./leaking_tests.ts";

/*
 * These tests triggers a leaked resource error from the test runner for a
 * "textDecoder". What's happening is:
 *
 * - `TextDecoderStream` uses a `TextDecoder` to decode its chunks
 * - `TextDecoder.decode()` creates a native decoder resource, which it holds
 *   open when used in streaming mode. It closes the resource when a
 *   non-streaming `decode()` call is made.
 * - `TextDecoderStream` makes streaming `decode()` calls in its `transform()`
 *   method, and makes a final non-streaming `decode()` call in its `flush()`
 *   method.
 * - When a stream pipeline is errored, the `flush()` method of any
 *   `Transformer` in a `TransformStream` is not called, so in the case of
 *   `TextDecoderStream` it has no way to know its no longer in use, and keeps
 *   open its decoder.
 */

Deno.test({
  ignore: !ENABLE_LEAKING_TESTS,
  name:
    `TextDecoderStream leaks its TextDecoder's native decoder when a stream in its pipeline errors ${LEAKING_TEST_SUFFIX}`,
  fn: async () => {
    const src = new ReadableStream({
      pull(controller) {
        controller.enqueue(encode("foo"));
      },
    });
    const dst = new WritableStream({
      write(chunk) {
        assertEquals(chunk, "foo");
        throw new Error("example");
      },
    });

    await assertRejects(
      async () => await src.pipeThrough(new TextDecoderStream()).pipeTo(dst),
      Error,
      "example",
    );
  },
});

// This demonstrates what's happening with TextDecoderStream by using
// TextDecoder directly in roughly the same way it does.
Deno.test(
  {
    ignore: !ENABLE_LEAKING_TESTS,
    name:
      `A native decoder resource leaks when using TextDecoder directly in a TransformStream ${LEAKING_TEST_SUFFIX}`,
    fn: async () => {
      const decoder = new TextDecoder();
      let flushCalled = false;
      const transformer: Transformer<Uint8Array, string> = {
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }));
        },
        flush(controller) {
          flushCalled = true;
          controller.enqueue(
            decoder.decode(undefined, { stream: false }),
          );
        },
      };

      const src = new ReadableStream({
        pull(controller) {
          controller.enqueue(encode("foo"));
        },
      });
      const dst = new WritableStream({
        write(chunk) {
          assertEquals(chunk, "foo");
          throw new Error("example");
        },
      });

      await assertRejects(
        async () =>
          await src.pipeThrough(new TransformStream(transformer)).pipeTo(dst),
        Error,
        "example",
      );

      assert(!flushCalled);
    },
  },
);

Deno.test({
  ignore: !ENABLE_LEAKING_TESTS,
  name:
    `TextDecoderStream leaks its TextDecoder's native decoder when its downstream pipe is aborted ${LEAKING_TEST_SUFFIX}`,
  fn: async () => {
    const src = new ReadableStream({
      pull(controller) {
        controller.enqueue(encode("foo"));
      },
    });
    const aborter = new AbortController();
    const dst = new WritableStream({
      write(chunk) {
        assertEquals(chunk, "foo");
        aborter.abort();
      },
    });

    await assertRejects(
      async () =>
        await src.pipeThrough(new TextDecoderStream()).pipeTo(dst, {
          signal: aborter.signal,
        }),
      Error,
      "Aborted",
    );
  },
});

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}
