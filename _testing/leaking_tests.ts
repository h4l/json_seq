/**
 * Whether tests that trigger resource leaks should be run.
 *
 * `true` if the ENABLE_LEAKING_TESTS envar is set (and permission to read it
 * is granted).
 */
export const ENABLE_LEAKING_TESTS: boolean = (await Deno.permissions.query({
      name: "env",
      variable: "ENABLE_LEAKING_TESTS",
    })).state === "granted" && !!(Deno.env.get("ENABLE_LEAKING_TESTS") ?? "");

/** A marker to use when naming tests that (intentionally) trigger resource leaks. */
export const LEAKING_TEST_SUFFIX = "[💦 LEAKING TEST 💦]";
