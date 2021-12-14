// Copyright 2021 Hal Blackburn. All rights reserved. MIT license.

import { assertEquals } from "./dev_deps.ts";
import { chunkify, enlargen } from "./_test_utils.ts";

Deno.test("chunkify", () => {
  assertEquals(chunkify("", 1), []);
  assertEquals(chunkify("", 10), []);
  assertEquals(chunkify("foo", 10), ["foo"]);
  assertEquals(chunkify("foo", 1), ["f", "o", "o"]);
  assertEquals(chunkify("foo", 2), ["fo", "o"]);
});

Deno.test("enlargen", () => {
  assertEquals(enlargen("a", 3), "aaa");
  assertEquals(enlargen("abc", 5), "abcab");
  assertEquals(enlargen("abc", 1), "a");
  assertEquals(enlargen("abc", 2), "ab");
  assertEquals(enlargen("abc", 3), "abc");
});
