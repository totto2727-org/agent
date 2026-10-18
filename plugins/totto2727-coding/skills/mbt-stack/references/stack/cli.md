# MoonBit CLI Composition

This reference serves developers who build or maintain MoonBit command-line applications.
Use Admiral for new CLIs and preserve a maintained application's compatibility constraints.
Read the resolved Admiral version, generated package interfaces, and current source before choosing constructors, option getters, callback types, or help behavior.
Use the [official Admiral repository](https://github.com/totto2727-org/admiral) and [package API documentation](https://mooncakes.io/docs/totto2727/admiral) as reference entry points.
Do not pin a release from an example or restore a manual parser to accommodate an outdated snippet.

## Command pipeline

Keep the command path explicit:

```text
Admiral context -> typed command input -> domain operation -> request type -> encoded request -> transport
```

The final request stages apply only to commands that call an external service.
Define each option or positional argument once with a typed definition supported by the resolved Admiral API.
Reuse that definition in command registration and value extraction instead of maintaining a parallel set of string names.
Group-only commands own subcommands rather than a second dispatch table.
Keep the application entry point responsible only for constructing the Admiral application and running it.
Let Admiral own parsing, dispatch, and its documented help fallback.
Do not wrap the whole application in a background task or task group merely because command callbacks are async.
Use the callback contract exposed by the resolved version without adding artificial I/O to suppress diagnostics in examples.

## Input conversion

Read raw Admiral context only in the command callback and its command-local conversion function.
Resolve flags, positional values, configuration, and environment fallbacks there with explicit precedence.
Use typed required-value extraction when supported, and reject missing or malformed required values immediately.
Check exact cardinality and distinguish absent from invalid input when an optional getter would collapse those cases.
Represent mutually exclusive input modes with an enum instead of unrelated optional fields.
Return a typed command input that contains validated user intent, not a remote request body.
Keep payload file reads, domain parsing, HTTP requests, and request serialization out of options conversion.
Do not re-read credentials or raw context in downstream helpers.

## Command and adapter ownership

Keep command-specific definitions, input conversion, and orchestration together.
Extract shared transport, output writing, and configuration boundaries only when real callers need them.
Convert command input through domain operations into a request-specific struct before encoding.
Keep request and response types distinct even when their current fields look alike.
Avoid generic mutable body builders and JSON patch helpers that hide a command's wire contract.
Follow [JSON boundaries](json.md) for codec selection and omission versus explicit `null`.
Keep provider credentials, SDK configuration, and transport construction at the application composition boundary.
Do not select an unverified HTTP library merely because a CLI needs a request adapter.

## Responses, output, and errors

Preserve an opaque response body when the command promises pass-through output and makes no field-dependent decisions.
When a decision requires decoding, decode at the smallest boundary and continue with a command-specific typed result.
Keep machine-readable results or requested binary content on stdout or the requested output file.
Keep diagnostics on stderr and select exit status at the application boundary without leaking secrets.
Do not duplicate lower-layer error logging or turn cancellation into a successful command result.
Use [MoonBit errors](../../../mbt-coding/references/errors.md) for typed failure propagation.

## Verification

Use [mbt-test](../../../mbt-test/SKILL.md) to test command input conversion independently of transport.
Exercise help, unknown commands, invalid options, missing required values, fallback precedence, and the promised exit behavior through the actual CLI entry point.
Verify stdout and stderr separately for machine-readable commands.
Use local adapters or process fixtures where external credentials are not part of the test contract.
Follow [target capability proof](share.md#target-capability-proof) for process-dependent commands rather than assuming Admiral supports every module target.
