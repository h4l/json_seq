import { JsonSequenceDecoderStream } from "https://deno.land/x/json_seq@unpublished/mod.ts";
import { readableStreamFromReader } from "https://deno.land/std@0.117.0/streams/conversion.ts";

const jsonStream = readableStreamFromReader(Deno.stdin)
  .pipeThrough(new JsonSequenceDecoderStream());

for await (const json of jsonStream) {
  console.log(`JSON value: ${Deno.inspect(json)}`);
}
