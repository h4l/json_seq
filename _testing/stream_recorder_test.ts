import { assertEquals } from "../dev_deps.ts";
import { ALL_EVENTS, recordStreamEvents } from "./stream_recorder.ts";

Deno.test("[recordStreamEvents] records events in successful stream", async () => {
  const src = new ReadableStream({
    start(controller) {
      controller.enqueue("foo");
      controller.enqueue("bar");
      controller.close();
    },
  });
  assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
    { type: "start" },
    { type: "write", chunk: "foo" },
    { type: "write", chunk: "bar" },
    { type: "close" },
  ]);
});

Deno.test("[recordStreamEvents] records events in failed stream", async () => {
  const src = new ReadableStream({
    start(controller) {
      controller.enqueue("foo");
      controller.enqueue("bar");
    },
    pull(controller) {
      controller.error(new Error("oops"));
    },
  });
  assertEquals(await recordStreamEvents(src, ...ALL_EVENTS), [
    { type: "start" },
    { type: "write", chunk: "foo" },
    { type: "write", chunk: "bar" },
    { type: "abort", reason: new Error("oops") },
  ]);
});
