---
name: rust-stack
description: >-
  Choose a Rust toolchain or libraries for a CLI, GPUI desktop app, LLM integration, or workflow.
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
- No Rust Web stack for new projects. For existing integrations only, see [Topcoat and Datastar maintenance](references/knowledge/web-ui-topcoat-datastar.md).
- Common policy: [share-stack](../share-stack/SKILL.md).
- Language and tests: [rust-coding](../rust-coding/SKILL.md), [rust-test](../rust-test/SKILL.md).

If the linked skills are not installed, read the source: [share-stack](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-stack/SKILL.md).
