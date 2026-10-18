# MoonBit CLI Composition

Use Admiral for new CLIs, but keep maintained compatibility contracts.
Use the resolved API with the [official repository](https://github.com/totto2727-org/admiral) and [API documentation](https://mooncakes.io/docs/totto2727/admiral).

## Command pipeline

```text
Admiral context -> typed command input -> domain operation -> request type -> encoded request -> transport
```

The request stages apply only to service calls.
Reuse typed option definitions for registration and extraction, rather than a parallel set of string names.
Let Admiral own dispatch and its documented help fallback, including group-only commands.
Use the resolved callback contract, without an extra task group only because callbacks are async.

## Input conversion

Read raw context only in the callback or its command-local conversion function.
Resolve option, positional, configuration, and environment fallbacks there, with explicit precedence.
Use typed required-value extraction where available.
Reject missing or malformed required values during input conversion.
Make sure that cardinality is exact, with absent and invalid values distinct when an optional getter collapses those cases.
Use an enum for mutually exclusive input modes.

The result is typed command input with validated intent, not a remote request body.
Keep payload-file reads, domain parsing, HTTP calls, and serialization outside option conversion.
Downstream helpers must not read raw context or resolve credentials again.

## Command and adapter ownership

Keep command definitions, input conversion, and orchestration together.
Convert the domain result into a request-specific struct before encoding.
Keep request and response types distinct, even when their fields match.
Do not replace the wire contract with a generic mutable JSON body builder.
Use [JSON guidance](json.md) for omission versus explicit `null`.
This profile selects no universal HTTP client.

## Responses, output, and errors

Keep opaque response bytes for pass-through commands that make no field-dependent decisions.
Otherwise, decode only where the command needs a typed decision.
Use [mbt-test](../../../mbt-test/SKILL.md) for CLI output and exit contracts, and [MoonBit errors](../../../mbt-coding/references/errors.md) for failures.
Process-dependent commands still need [target capability proof](share.md#target-capability-proof).
