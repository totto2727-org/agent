# Rust CLI Profile

Use this profile for developers implementing command-line applications.
Apply the [shared Rust stack](share.md) for toolchain and task choices.
Use clap for typed command, argument, option, and help definitions.
Use Serde for structured configuration and machine-readable output, with [validation and observability conventions](../knowledge/capabilities.md) when those capabilities are needed.
Do not add an async runtime to a synchronous CLI without an async requirement.
Use Tokio when application I/O or selected dependencies need that runtime.

## Composition and lifetime

Keep `main` as the composition root for argument parsing, configuration precedence, diagnostic initialization, runtime construction, and application service wiring.
Document precedence between command options, environment variables, configuration files, and defaults.
Convert parsed values into validated application commands before invoking domain operations.
Keep clap and runtime-specific types out of domain contracts.
Initialize one runtime at the executable boundary instead of constructing a runtime inside each operation.
Own child tasks, signals, cancellation, completion, and shutdown at that boundary.
Keep blocking work off async executor threads, and bound parallel work and output buffering.
Use [Rust lifetime and cancellation guidance](../../../rust-coding/references/language-principles.md#cancellation-and-lifetimes) for the language-level contract.

## Output and failures

Reserve stdout for the command's result or documented machine-readable stream.
Send progress, diagnostics, and safe failure context to stderr.
Define exit status for success, invalid input, operational failure, and cancellation without exposing provider errors or secrets verbatim.
Do not let tracing output corrupt JSON or other machine-readable stdout.
Test argument failures, configuration precedence, output contracts, exit status, and cancellation through [rust-test](../../../rust-test/SKILL.md).
Keep live provider tests separate from ordinary command tests.

## Official sources

- [clap](https://docs.rs/clap/latest/clap/)
- [Tokio tutorial](https://tokio.rs/tokio/tutorial)
- [Tokio graceful shutdown](https://tokio.rs/tokio/topics/shutdown)
