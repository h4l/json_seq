import { assertEquals } from "./dev_deps.ts";
import { chunkify, enlargen, expectType, product } from "./_test_utils.ts";

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

Deno.test("product(): 0 columns", () => {
  assertEquals(
    expectType<[][]>([...product()]),
    [],
  );
});
Deno.test("product(): 1 columns", () => {
  assertEquals(
    expectType<[number][]>([...product([1, 2, 3])]),
    [
      [1],
      [2],
      [3],
    ],
  );
});
Deno.test("product(): 2 columns", () => {
  assertEquals(
    expectType<[number, string][]>([...product([1, 2, 3], ["a", "b"])]),
    [
      [1, "a"],
      [2, "a"],
      [3, "a"],
      [1, "b"],
      [2, "b"],
      [3, "b"],
    ],
  );
});
Deno.test("product(): 3 columns", () => {
  assertEquals(
    expectType<[string, boolean, number][]>([
      ...product(["a", "b", "c"], [true, false], [1, 2, 3]),
    ]),
    [
      ["a", true, 1],
      ["b", true, 1],
      ["c", true, 1],
      ["a", false, 1],
      ["b", false, 1],
      ["c", false, 1],
      ["a", true, 2],
      ["b", true, 2],
      ["c", true, 2],
      ["a", false, 2],
      ["b", false, 2],
      ["c", false, 2],
      ["a", true, 3],
      ["b", true, 3],
      ["c", true, 3],
      ["a", false, 3],
      ["b", false, 3],
      ["c", false, 3],
    ],
  );
});
