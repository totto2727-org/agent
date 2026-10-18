# Go CLI Stack

For developers who compose small native Go commands and code generators.
Use the [shared Go stack](share.md) for tools and [go-coding](../../../go-coding/SKILL.md) for implementation rules.

## Composition

1. Parse arguments with standard-library `flag` when its option model meets the command contract.
2. Use a separate `flag.FlagSet` with `flag.ContinueOnError` for a parser that tests can call without exiting the process.
3. Convert parsed flags and configuration into validated command input.
4. Assemble file, process, and other I/O capabilities at the command entry point.
5. Call the application operation, then map its result to output, diagnostics, and exit status.

Keep `main` thin and put reusable execution in a function that accepts arguments and output writers.
Return failures through that function so deferred cleanup runs before `main` exits.
Send generated data to stdout and diagnostics to stderr.
Give help, invalid usage, cancellation, and operation failure deliberate exit behavior.
Use `signal.NotifyContext` when an interrupt must cancel child work, and release its signal registration after execution.
Use `os/exec.CommandContext` with explicit arguments for subprocesses rather than assembling shell text from input.
Check subprocess exit status and preserve useful stderr without exposing secrets.
Do not promise whole-process-tree termination from `CommandContext` without platform-specific handling and tests.

Add a larger CLI framework only when required command behavior exceeds this baseline.
Do not add a framework to a dependency-free program merely to fill a stack template.

## Generator-specific dependencies

Atlas is appropriate when a generator needs Atlas schema or HCL parsing.
Keep its parser values inside the schema adapter and pass explicit generation input to deterministic rendering code.
Generating TypeScript types for Kysely does not require a Node runtime for the Go generator.
This use of Atlas does not establish a Go ORM, database runtime, or universal database dependency.

## Checks

Use `testing` for command parsing and operation tests, with buffers for stdout and stderr.
Use fixture and golden-output checks when deterministic generation is the contract.
Use `os/exec` to check the built binary's output streams and exit status when the process boundary changes.
Check malformed arguments, help, input errors, interrupted work, and output write failures where affected.
Keep heavyweight or live-system acceptance outside default native tests unless the project explicitly requires it.

## Official references

- [flag](https://pkg.go.dev/flag)
- [os/exec](https://pkg.go.dev/os/exec)
- [os/signal](https://pkg.go.dev/os/signal)
- [Atlas schema inspection](https://atlasgo.io/inspect)
