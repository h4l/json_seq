import { assertEquals } from "../dev_deps.ts";

/**
 * Pipe the `stream` into a `WritableStream` and record all the actions that
 * the actions it receives.
 *
 * A Promise is returned which is resolved when the `stream`'s pipe has
 * completed. The resolved value is the list of recorded events.
 */
export async function recordStreamEvents<
  T,
  ET extends SinkEventType = SinkEventType,
>(
  stream: ReadableStream<T>,
): Promise<SinkEventsOfType<T, SinkEventExceptStart>[]>;
export async function recordStreamEvents<
  T,
  ET extends SinkEventType = SinkEventType,
>(
  stream: ReadableStream<T>,
  ...eventTypes: ET[]
): Promise<SinkEventsOfType<T, ET>[]>;
export async function recordStreamEvents<
  T,
  ET extends SinkEventType = SinkEventType,
>(
  stream: ReadableStream<T>,
  ...eventTypes: ET[]
): Promise<SinkEventsOfType<T, ET>[]> {
  const sink = new EventRecorderSink<T>();
  const dest = new WritableStream(sink);
  try {
    await stream.pipeTo(dest);
  } catch (e) {
    // Error should have resulted in an abort event being recorded by the sink.
    // If so then assume it's expected and carry on returning the events,
    // otherwise something else has failed, so fail with an AssertionError
    assertEquals([{ type: "abort", reason: e }], sink.events("abort"));
  }
  return sink.events(...eventTypes);
}

export type SinkEvent<T> = SinkWrite<T> | SinkAbort | SinkClose | SinkStart;
export type SinkWrite<T> = { type: "write"; chunk: T };
export type SinkAbort = { type: "abort"; reason: unknown };
export type SinkClose = { type: "close" };
export type SinkStart = { type: "start" };
export type SinkEventType = SinkEvent<unknown>["type"];
export type SinkEventsOfType<
  T,
  ET extends SinkEventType,
  SE extends SinkEvent<T> = SinkEvent<T>,
> = SE extends { type: infer ActualET } ? (ActualET extends ET ? SE : never)
  : never;
export type SinkEventExceptStart = Exclude<SinkEventType, "start">;

export const ALL_EVENTS: ReadonlySet<SinkEventType> = new Set([
  "start",
  "write",
  "abort",
  "close",
]);

// Alternatively we could emit events on a side-channel stream, but that would
// be a bit meta... Just emitting the list of events at the end makes for nice,
// declarative test code for simple cases where feeding back to the src is not
// required.

class EventRecorderSink<T> implements UnderlyingSink<T> {
  readonly #events: Array<SinkEvent<T>>;
  constructor() {
    this.#events = [];
  }
  start() {
    this.#events.push({ type: "start" });
  }
  write(chunk: T) {
    this.#events.push({ type: "write", chunk });
  }
  abort(reason: unknown) {
    this.#events.push({ type: "abort", reason });
  }
  close() {
    this.#events.push({ type: "close" });
  }

  events(): SinkEventsOfType<T, Exclude<SinkEventType, "start">>[];
  events<ET extends SinkEventType>(
    ...types: ET[]
  ): SinkEventsOfType<T, ET>[];
  events<ET extends SinkEventType>(
    ...types: ET[]
  ): SinkEventsOfType<T, ET>[] {
    const _types = new Set<SinkEventType>(
      types.length === 0 ? ["write", "abort", "close"] : types,
    );
    const selected = this.#events.filter((
      event,
    ): event is SinkEventsOfType<T, ET> => _types.has(event.type));
    return selected;
  }
}

export type AssertRecordedEventsMatchExpectations<T> = {
  /**
   * Require that exactly these chunks in this order were recorded. Zero chunks
   * are expected if unspecified.
   */
  chunks?: ReadonlyArray<T>;
  /**
   * `true` if the `events` must end with an `"abort"` event.
   * If `false` or unspecified, a `"close"` event is expected.
   */
  abort?: boolean;
};

/**
 * Make an assertion that the `events` list contains expected chunks and ends
 * with the expected `"close"` or `"abort"`.
 */
export function assertRecordedEventsMatch<T>(
  events: ReadonlyArray<SinkEvent<T>>,
  expectations?: AssertRecordedEventsMatchExpectations<T>,
): void {
  const { chunks, abort } = expectations ?? {};
  const expected: NormalisedSinkEvent<T>[] = [
    ...(events.at(0)?.type === "start" ? [{ type: "start" } as const] : []),
    ...(chunks ?? []).map((chunk) => ({ type: "write", chunk } as const)),
    abort ? { type: "abort", reason: "*any*" } : { type: "close" },
  ];
  assertEquals(normaliseEventsForEquality(events), expected);
}

// Could allow specifying a key function for reason if actual matching is
// needed. E.g. match a regex by using the match's groups as the equality key.

type AnySinkAbort = Omit<SinkAbort, "reason"> & { reason: "*any*" };
type NormalisedSinkEvent<T> = Exclude<SinkEvent<T>, SinkAbort> | AnySinkAbort;
function normaliseEventsForEquality<T>(
  events: ReadonlyArray<SinkEvent<T>>,
): NormalisedSinkEvent<T>[] {
  return events.map((event) =>
    event.type === "abort" ? { type: "abort", reason: "*any*" } : event
  );
}
