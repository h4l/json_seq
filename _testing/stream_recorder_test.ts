import { assertEquals, AssertionError, assertThrows } from "../dev_deps.ts";
import {
  ALL_EVENTS,
  assertRecordedEventsMatch,
  AssertRecordedEventsMatchExpectations,
  recordStreamEvents,
  SinkEvent,
} from "./stream_recorder.ts";

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

type AssertRecordedEventsMatchCases<T> = {
  name?: string;
  events: ReadonlyArray<SinkEvent<T>>;
  expectations: AssertRecordedEventsMatchExpectations<T>;
  shouldMatch?: false;
};
const assertRecordedEventsMatchCases: ReadonlyArray<
  AssertRecordedEventsMatchCases<unknown>
> = [
  {
    name: "start event can be included",
    events: [{ type: "start" }, { type: "close" }],
    expectations: {},
  },
  {
    name: "start event is optional",
    events: [{ type: "close" }],
    expectations: {},
  },
  {
    name: "abort reason is not significant",
    events: [{ type: "abort", reason: "xxx" }],
    expectations: { abort: true },
  },
  {
    name: "chunks are matched",
    events: [
      { type: "write", chunk: "foo" },
      { type: "write", chunk: "bar" },
      { type: "close" },
    ],
    expectations: { chunks: ["foo", "bar"] },
  },
  {
    name: "chunks followed by an abort are matched",
    events: [
      { type: "write", chunk: "foo" },
      { type: "write", chunk: "bar" },
      { type: "abort", reason: "xxx" },
    ],
    expectations: { chunks: ["foo", "bar"], abort: true },
  },
  {
    name: "too few chunks are rejected",
    shouldMatch: false,
    events: [
      { type: "write", chunk: "foo" },
      { type: "close" },
    ],
    expectations: { chunks: ["foo", "bar"] },
  },
  {
    name: "too many chunks are rejected",
    shouldMatch: false,
    events: [
      { type: "write", chunk: "foo" },
      { type: "write", chunk: "bar" },
      { type: "close" },
    ],
    expectations: { chunks: ["foo"] },
  },
];

assertRecordedEventsMatchCases.forEach(
  ({ name, shouldMatch, events, expectations }, i) => {
    Deno.test(`[assertRecordedEventsMatch] ${name ?? i}`, () => {
      if (shouldMatch ?? true) {
        assertRecordedEventsMatch(events, expectations);
      } else {
        assertThrows(
          () => assertRecordedEventsMatch(events, expectations),
          AssertionError,
        );
      }
    });
  },
);
