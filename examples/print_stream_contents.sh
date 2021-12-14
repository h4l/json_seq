#!/usr/bin/env bash
DIR="$(dirname "$0")"

echo -e '\x1E{"message": "hi"}\n\x1E{"message": "bye"}\n' \
  | deno run "$DIR/print_stream_contents.ts"
