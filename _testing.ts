import { Reducer } from "./transducers.ts";

export type TestingReducerState<T> = Readonly<
  { values: ReadonlyArray<T>; initCount: number; completeCount: number }
>;
export type TestingReducer<T> = Reducer<TestingReducerState<T>, T>;
export function testingReducer<T>(): Reducer<TestingReducerState<T>, T> {
  return {
    init: () => ({ values: [], initCount: 1, completeCount: 0 }),
    complete: (state) => ({ ...state, completeCount: state.completeCount + 1 }),
    reduce: (state, value) => ({ ...state, values: [...state.values, value] }),
  };
}

export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
