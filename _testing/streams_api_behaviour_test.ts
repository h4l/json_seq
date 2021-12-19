import { assert, assertEquals, delay, unreachable } from "../dev_deps.ts";
import { ENABLE_LEAKING_TESTS, LEAKING_TEST_SUFFIX } from "./leaking_tests.ts";
import { ALL_EVENTS, recordStreamEvents } from "./stream_recorder.ts";

/*
 * Test cases to confirm/demonstrate how the Stream APIs work. Not testing our
 * own code.
 */

Deno.test(
  `[async iteration] breaking iteration loop closes stream when not using \
preventCancel option`,
  async () => {
    let cancelled = false;
    let i = 0;
    const src = new ReadableStream<number>({
      cancel() {
        cancelled = true;
      },
      pull(controller) {
        controller.enqueue(i++);
      },
    });

    let expected = 0;
    for await (
      const chunk of src[Symbol.asyncIterator]({ preventCancel: true })
    ) {
      assertEquals(chunk, expected++);
      if (chunk > 3) {
        break;
      }
    }
    assert(!cancelled);
    for await (const chunk of src) {
      assertEquals(chunk, expected++);
      if (chunk > 6) {
        break;
      }
    }
    assert(cancelled, "src was not cancelled after breaking async iterator");
  },
);

Deno.test(
  "synchronously enqueuing an error after a chunk causes the chunk to be lost",
  async () => {
    let i = 0;
    const src = new ReadableStream<number>({
      pull(controller) {
        if (i < 2) {
          controller.enqueue(i++);
        } else {
          controller.enqueue(i++);
          controller.enqueue(i++);
          controller.error(new Error("oops"));
        }
      },
    });
    assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
      { type: "start" },
      { type: "write", chunk: 0 },
      { type: "write", chunk: 1 },
      // 2 and 3 are enqueued but lost when the error is triggered immediately,
      // before they are delivered.
      { type: "abort", reason: new Error("oops") },
    ]);
  },
);

Deno.test(
  "asynchronously enqueuing an error via a task after a chunk allows chunks " +
    "to be delivered before the error aborts the stream",
  async () => {
    let i = 0;
    const src = new ReadableStream<number>({
      async pull(controller) {
        if (i < 2) {
          controller.enqueue(i++);
        } else {
          controller.enqueue(i++);
          controller.enqueue(i++);
          // delay uses setTimeout, which is scheduled
          // as a regular (not micro) task.
          await delay(0);
          controller.error(new Error("oops"));
        }
      },
    });
    assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
      { type: "start" },
      { type: "write", chunk: 0 },
      { type: "write", chunk: 1 },
      { type: "write", chunk: 2 },
      { type: "write", chunk: 3 },
      { type: "abort", reason: new Error("oops") },
    ]);
  },
);

Deno.test(
  "asynchronously enqueuing an error via a microtask after a chunk causes " +
    "the stream to be aborted before the chunk is delivered",
  async () => {
    let i = 0;
    const src = new ReadableStream<number>({
      pull(controller) {
        if (i < 2) {
          controller.enqueue(i++);
        } else {
          controller.enqueue(i++);
          controller.enqueue(i++);
          return Promise.resolve().then(() =>
            controller.error(new Error("oops"))
          );
        }
      },
    });
    assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
      { type: "start" },
      { type: "write", chunk: 0 },
      { type: "write", chunk: 1 },
      // 2 and 3 are not delivered before the stream is aborted
      { type: "abort", reason: new Error("oops") },
    ]);
  },
);

Deno.test(
  "delaying reporting an error until the controller pulls again allows " +
    "previously-enqueued chunks to be delivered",
  async () => {
    let i = 0;
    let pendingError: Error | undefined = undefined;
    const src = new ReadableStream<number>({
      pull(controller) {
        if (pendingError) {
          controller.error(pendingError);
          return;
        }
        if (i < 4) {
          controller.enqueue(i++);
        } else {
          // report the error on next pull()
          pendingError = new Error("oops");
        }
      },
    });
    assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
      { type: "start" },
      { type: "write", chunk: 0 },
      { type: "write", chunk: 1 },
      { type: "write", chunk: 2 },
      { type: "write", chunk: 3 },
      { type: "abort", reason: new Error("oops") },
    ]);
  },
);

Deno.test(
  "delaying reporting an error until the controller pulls again can still " +
    "error the stream with undelivered chunks if the highWaterMark is > 1",
  async () => {
    let i = 0;
    let pendingError: Error | undefined = undefined;
    const src = new ReadableStream<number>({
      pull(controller) {
        if (pendingError) {
          controller.error(pendingError);
          return;
        }
        if (i < 4) {
          controller.enqueue(i++);
        } else {
          // report the error on next pull()
          pendingError = new Error("oops");
        }
      },
    }, { highWaterMark: 3 });
    assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
      { type: "start" },
      { type: "write", chunk: 0 },
      { type: "write", chunk: 1 },
      { type: "write", chunk: 2 },
      // The 4th chunk is buffered while the error is reported, so it gets lost
      { type: "abort", reason: new Error("oops") },
    ]);
  },
);

/**
 * See the desc of `stream.pipeTo()`:
 * https://streams.spec.whatwg.org/#rs-prototype
 *
 * - closing the src closes the dest, but the reverse is not true
 */
Deno.test("closing a downstream stream in a pipe does not close the source", async () => {
  let upstreamClosed = false;
  const upstream = new ReadableStream({
    cancel() {
      upstreamClosed = true;
    },
  });

  const downstream = upstream.pipeThrough(new TransformStream());
  assert(!upstreamClosed);
  await downstream.cancel();
  assert(!upstreamClosed);
});

Deno.test("closing an upstream stream in a pipe closes the dest", async () => {
  let downstreamClosed = false;
  const upstream = new ReadableStream({
    pull(controller) {
      controller.close();
    },
    cancel() {
      // not called as a result of controller.close():
      // https://streams.spec.whatwg.org/#readable-stream-default-controller-close
      unreachable();
    },
  });
  const downstream = new WritableStream({
    close() {
      downstreamClosed = true;
    },
    abort() {
      unreachable();
    },
  });
  await upstream.pipeTo(downstream);
  assert(downstreamClosed);
});

Deno.test("errors in a Transformer cancel the source and abort the dest streams", async () => {
  let srcCancelled = false;
  let destAborted = false;
  const expectedError = new Error("Example Error: foo");
  const src = new ReadableStream({
    start(controller) {
      controller.enqueue("foo");
    },
    cancel(reason) {
      srcCancelled = true;
      assertEquals(reason, expectedError);
    },
  });
  const tx = new TransformStream({
    transform(chunk, controller) {
      controller.error(new Error(`Example Error: ${chunk}`));
    },
  });
  const dest = new WritableStream({
    abort(reason) {
      destAborted = true;
      assertEquals(reason, expectedError);
    },
  });

  try {
    await src.pipeThrough(tx).pipeTo(dest);
    unreachable();
  } catch (e) {
    assert(srcCancelled);
    assert(destAborted);
    assertEquals(e, expectedError);
  }
});

/*
 * An unresolved promise is leaked if a ReadableStream's controller is not
 * explicitly closed.
 */
for (const callClose of [true, false]) {
  Deno.test({
    ignore: !callClose && !ENABLE_LEAKING_TESTS,
    name: `ReadableStream ${
      callClose ? "does not leak" : "leaks"
    } promise if controller.close() ${
      callClose ? "is" : "is not"
    } explicitly called${callClose ? "" : ` ${LEAKING_TEST_SUFFIX}`}`,
    fn: async () => {
      const src = new ReadableStream({
        start(controller) {
          controller.enqueue("foo");
          if (callClose) {
            controller.close();
          }
        },
      });
      const reader = src.getReader();
      assertEquals(await reader.read(), { done: false, value: "foo" });
      assertEquals(await reader.read(), { done: true, value: undefined });
      await reader.closed;
    },
  });
}
