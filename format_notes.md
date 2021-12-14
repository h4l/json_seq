This module implements the text format, described in [RFC 7464], to represent
streams of JSON objects (application/json-seq).

[RFC 7464]: https://datatracker.ietf.org/doc/html/rfc7464

The format is simple. A stream consists of normal UTF-8 JSON texts, each
separated by a ASCII Record Separator character (0x1E), and terminated by an
ASCII Line Feed (\n or 0x0A). The JSON texts can have whatever indentation is
desired, so the encoded format can be as human-readable as regular JSON.

## Key points from the RFC

- The spec emphasises the importance of parsers recovering from stream errors
  rather than failing on a problematic item:
  - Section 2:
    > "Having two different sets of rules permits recovery parsers from
    > sequences where some of the elements are truncated for whatever reason."
  - Section 2.1:
    > "If parsing of such an octet string as a UTF-8-encoded JSON text fails,
    > the parser SHOULD nonetheless continue parsing the remainder of the
    > sequence."
  - Section 2.1 and 2.2: It follows the [Robustness Principle] in specifying a
    reasonably precise encoding for the stream format, but reasonably lenient
    rules for parsing.

    [Robustness Principle]: https://en.wikipedia.org/wiki/Robustness_principle

  - Section 2.3:

    > "Per Section 2.1, JSON text sequence parsers should not abort when an
    > octet string contains a malformed JSON text. Instead, the JSON text
    > sequence parser should skip to the next RS."

  - Section 2.4:

    > Parsers MUST check that any JSON texts that are a top-level number, or
    > that might be 'true', 'false', or 'null', include JSON whitespace (at
    > least one byte matching the "ws" ABNF rule from [RFC7159]) after that
    > value; otherwise, the JSON-text may have been truncated. Note that the LF
    > following each JSON text matches the "ws" ABNF rule.

    > Parsers MUST drop JSON-text sequence elements consisting of non-self-
    > delimited top-level values that may have been truncated (that are not
    > delimited by whitespace). Parsers can report such texts as warnings
    > (including, optionally, the parsed text and/or the original octet string).

    For example, it's not possible to know if a top-level number that isn't
    followed by whitespace was truncated, so it's not safe for the parser to
    output it as a complete value.:

    > For example, `'<RS>123<RS>'` might have been intended to carry the top-
    > level number 1234, but it got truncated.

    However, strings and other unambiguously-terminated values are safe to
    report:

    > Implementations may produce a value when parsing `'<RS>"foo"<RS>'`

    The spec allows skipping over junk after a JSON value prior to the next
    `<RS>` char:

    > [...] Such implementations ought to skip to the next RS byte, possibly
    > reporting any intervening non-whitespace bytes.

    However the `JSON.parse` function doesn't really allow identifying and
    skipping such junk content (short of hacks involving parsing a thrown
    `SyntaxError` to guess the end of a valid JSON string prefix).

  - Section 3, Security Considerations warns of the danger of different
    implementations reporting or not emitting values for valid JSON with junk
    suffixes:

    > Note that incremental JSON text parsers can produce partial results and
    > later indicate failure to parse the remainder of a text. A sequence parser
    > that uses an incremental JSON text parser might treat a sequence like
    > `'<RS>"foo"<LF>456<LF><RS>'` as a sequence of one element ("foo"), while a
    > sequence parser that uses a non-incremental JSON text parser might treat
    > the same sequence as being empty. This effect, and texts that fail to
    > parse and are ignored, can be used to smuggle data past sequence parsers
    > that don't warn about JSON text failures.
