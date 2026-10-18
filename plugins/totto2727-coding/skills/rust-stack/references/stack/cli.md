# Rust CLI Addition

| Selected technology                          | Role                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [Rust baseline](share.md)                    | Compiler, dependencies, packaging                                 |
| [clap](https://docs.rs/clap/latest/clap/)    | Typed commands and help                                           |
| [Serde](https://serde.rs/)                   | Structured configuration and machine-readable output              |
| [Tokio](https://docs.rs/tokio/latest/tokio/) | Optional runtime when application I/O or a dependency requires it |

- Audience: advanced Rust CLI consumers.
- Synchronous CLI: no runtime solely for stack consistency.
- Optional validation and telemetry: independent [capability additions](../knowledge/capabilities.md).
- CLI contracts: [rust-test](../../../rust-test/SKILL.md).
