# Rust CLI Profile

Use [clap](https://docs.rs/clap/latest/clap/) for typed command definitions and help.
Use Serde for structured configuration and machine-readable output.
Use [capability guidance](../knowledge/capabilities.md) only when validation or structured telemetry is necessary.

Use [Tokio](https://docs.rs/tokio/latest/tokio/) when application I/O or a selected dependency needs it.
Do not add an async runtime to a synchronous CLI only to match this profile.
See [runtime composition](https://docs.rs/tokio/latest/tokio/runtime/index.html) and [graceful shutdown](https://tokio.rs/tokio/topics/shutdown) for library-specific behavior.
Use [Rust lifetime guidance](../../../rust-coding/references/language-principles.md#cancellation-and-lifetimes) for future-drop semantics and [rust-test](../../../rust-test/SKILL.md) for CLI contracts.
