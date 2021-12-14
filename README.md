# json_seq

A [Deno] module for working with streams of individual JSON objects, using the
json-seq format described in [RFC 7464].

[Deno]: https://deno.land/
[RFC 7464]: https://datatracker.ietf.org/doc/html/rfc7464

## Usage

```ts
// examples/print_stream_contents.ts
import { JsonSequenceDecoderStream } from "https://deno.land/x/json_seq@v0.1.0/mod.ts";
import { readableStreamFromReader } from "https://deno.land/std@0.117.0/streams/conversion.ts";

const jsonStream = readableStreamFromReader(Deno.stdin)
  .pipeThrough(new JsonSequenceDecoderStream());

for await (const json of jsonStream) {
  console.log(`JSON value: ${Deno.inspect(json)}`);
}
```

```sh
$ echo -e '\x1E{"message": "hi"}\n\x1E{"message": "bye"}\n' \
  | deno run examples/print_stream_contents.ts
JSON value: { message: "hi" }
JSON value: { message: "bye" }
```

## Roadmap

- Publish on deno.land
- Implement stream encoding
- Review the non-strict decoding behaviour and more closely follow the lenient
  handling of malformed streams described in the RFC
  - Maybe allow visibility of/control over malformed stream recovery actions

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
