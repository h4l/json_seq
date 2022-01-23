import { ChunkSection, partitionJSONSeqChunk } from "./decoder.ts";
import { assert, assertEquals } from "./dev_deps.ts";

function render(chunkSections: Iterable<ChunkSection>): string {
  return [...chunkSections].map((cs) => {
    if ("text" in cs) {
      assert(cs.text.length > 0);
      return cs.text;
    } else {
      assert(cs.separators > 0);
      return "\x1E".repeat(cs.separators);
    }
  }).join("");
}

const partitionJSONSeqChunkCases: Array<Array<ChunkSection>> = [
  [],
  [{ text: "foo" }],
  [{ separators: 1 }],
  [{ separators: 3 }],
  [
    { text: "foo" },
    { separators: 1 },
    { text: "bar" },
  ],
  [
    { separators: 1 },
    { text: "foo" },
    { separators: 2 },
    { text: "bar" },
    { separators: 4 },
  ],
];

Deno.test("partitionJSONSeqChunk()", () => {
  for (const chunkSections of partitionJSONSeqChunkCases) {
    assertEquals(
      [...partitionJSONSeqChunk(render(chunkSections))],
      chunkSections,
    );
  }
});
