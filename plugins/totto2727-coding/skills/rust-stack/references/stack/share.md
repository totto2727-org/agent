# Rust Baseline

| Selected technology                                                            | Responsibility                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [rustup](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file) | Compiler supply through `rust-toolchain.toml`: channel, components, targets   |
| [Cargo](https://doc.rust-lang.org/cargo/)                                      | Native build, tasks, dependency resolution through `Cargo.lock`               |
| [Nix](https://nixos.org/manual/nixpkgs/stable/#rust)                           | Development environment and package builder with inputs fixed by `flake.lock` |
| [thiserror](https://docs.rs/thiserror/latest/thiserror/)                       | Typed errors when needed                                                      |
| [anyhow](https://docs.rs/anyhow/latest/anyhow/)                                | Contextual application error reports when needed                              |

## Compiler and lockfiles

| Selection              | Required contract                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `rust-toolchain.toml`  | Concrete release for strict reproducibility                                        |
| `Cargo.lock`           | Rust dependencies only, not compiler or native libraries                           |
| Library MSRV           | Consumer requirement independent of developer compiler and repository lockfile     |
| `flake.lock`           | Nix inputs only, without automatic alignment to `rust-toolchain.toml`              |
| Nix compiler alignment | Check development and package-builder compilers, overrides, and targets separately |
| Nix package build      | Actual build evidence for compiler alignment and sandbox dependency acquisition    |

- New projects: edition 2024 when compiler and dependencies support it.
- Application CI and distribution: `--locked`.
- Nix sandbox: no assumed rustup downloads.

## Capability additions

| Addition                 | Selection                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI                      | [clap, optional Tokio](cli.md)                                                                                                               |
| Native desktop           | [GPUI](desktop.md)                                                                                                                           |
| LLM integration          | [Rig](llm.md)                                                                                                                                |
| Wire formats             | [Serde](https://serde.rs/) plus a format parser, with [boundary guidance](../knowledge/capabilities.md#serde-garde-then-domain-construction) |
| Semantic validation      | [garde](https://docs.rs/garde/latest/garde/), independent of workflows and Web                                                               |
| Code-defined workflows   | [graph-flow](https://docs.rs/graph-flow/latest/graph_flow/), independent of Rig and Web                                                      |
| Structured observability | [tracing](https://docs.rs/tracing/latest/tracing/), independent of validation and Web                                                        |

- Audience: advanced Rust stack consumers.
- Capability contracts: [capabilities](../knowledge/capabilities.md).
- Aggregate task runners: [shared task orchestration](../../../share-stack/references/task-orchestration.md).
