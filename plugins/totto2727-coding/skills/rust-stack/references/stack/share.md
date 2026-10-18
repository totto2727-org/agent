# Shared Rust Stack

## Compiler and targets

Use rustup first for compiler supply, with `rust-toolchain.toml` for the channel, components, and targets.
For strict reproducibility, select a concrete release rather than the moving `stable` channel.
Use edition 2024 for new projects when dependencies and the supported compiler are compatible with it.
A library's consumer MSRV is independent of its developer toolchain.

## Dependencies and compatibility

`Cargo.lock` fixes resolved Rust dependencies, not the compiler or native libraries.
Use `--locked` for application CI and distribution checks.
A library's repository lockfile does not constrain downstream consumer resolution.
Use compatible version ranges unless a concrete constraint makes an exact version necessary.
Apply [shared dependency safeguards](../../../share-stack/SKILL.md#keep-environments-and-dependencies-explicit).

## Nix environment and package compiler

`flake.lock` fixes Nix inputs, but does not align the package compiler with `rust-toolchain.toml`.
Examine the actual development compiler and the package builder's compiler separately, including compiler overrides and targets.
Do not depend on rustup downloads inside a Nix sandbox without package-build evidence.
Use the real package build as evidence of compiler alignment and sandbox dependency acquisition.
See the [Nixpkgs Rust reference](https://nixos.org/manual/nixpkgs/stable/#rust) for builder behavior.

## Native tasks and checks

Keep Cargo entry points for standalone Rust projects.
Use [shared task orchestration](../../../share-stack/references/task-orchestration.md) for aggregate runners and Just selection.
Do not add Node.js or Vite+ only for common task names.
`--all-features` can combine mutually exclusive features, so it is not a universal feature-matrix check.
Use [rust-test](../../../rust-test/SKILL.md) for test implementation.

## Capability-specific libraries

Select each library only for its matching capability.
These choices do not define a Rust Web profile.

| Capability                | Default                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| CLI parsing               | [clap](cli.md)                                                                                           |
| Async I/O                 | [Tokio](cli.md), only when necessary                                                                     |
| Native GUI                | [GPUI](desktop.md)                                                                                       |
| LLM integration           | [Rig](llm.md)                                                                                            |
| Wire formats              | [Serde](../knowledge/capabilities.md#serde-garde-then-domain-construction) with a format-specific parser |
| Semantic validation       | [garde](../knowledge/capabilities.md#serde-garde-then-domain-construction)                               |
| Code-defined workflows    | [graph-flow](../knowledge/capabilities.md#workflows-with-graph-flow)                                     |
| Structured observability  | [tracing](../knowledge/capabilities.md#logging-with-tracing)                                             |
| Typed errors              | [thiserror](https://docs.rs/thiserror/latest/thiserror/)                                                 |
| Application error reports | [anyhow](https://docs.rs/anyhow/latest/anyhow/), where contextual reports are appropriate                |

## Official sources

- [rustup toolchain files](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file)
- [Cargo manifest and MSRV](https://doc.rust-lang.org/cargo/reference/manifest.html)
- [Cargo lockfiles](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html)
- [Cargo commands](https://doc.rust-lang.org/cargo/commands/index.html)
