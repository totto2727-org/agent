---
name: rust-stack
description: >-
  Select and compose Rust toolchains and application libraries for CLI, native GPUI desktop, LLM integration, workflows, validation, and observability.
  Use for rustup, Cargo, Nix compiler alignment, or stack setup, not Rust language design, test implementation, or a Rust Web profile.
---

# Rust Stack

| Selected technologies                                                                                                                                                           | Composition                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [rustup](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file), [Cargo](https://doc.rust-lang.org/cargo/), [Nix](https://nixos.org/manual/nixpkgs/stable/#rust) | [Rust baseline](references/stack/share.md)                                                |
| [clap](https://docs.rs/clap/latest/clap/), optional [Tokio](https://docs.rs/tokio/latest/tokio/)                                                                                | [CLI addition](references/stack/cli.md)                                                   |
| [GPUI](https://www.gpui.rs/)                                                                                                                                                    | [Native desktop addition](references/stack/desktop.md)                                    |
| [Rig](https://rig.rs/docs)                                                                                                                                                      | [LLM addition](references/stack/llm.md)                                                   |
| [graph-flow](https://docs.rs/graph-flow/latest/graph_flow/), [garde](https://docs.rs/garde/latest/garde/), [tracing](https://docs.rs/tracing/latest/tracing/)                   | Independent [capability additions](references/knowledge/capabilities.md), not a Web stack |

- Audience: advanced users selecting or maintaining Rust application stacks.
- Scope: one Rust baseline with capability additions.
- Rust Web excluded.
- Common policy: [share-stack](../share-stack/SKILL.md).
- Language and tests: [rust-coding](../rust-coding/SKILL.md), [rust-test](../rust-test/SKILL.md).
