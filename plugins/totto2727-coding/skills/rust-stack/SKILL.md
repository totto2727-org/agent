---
name: rust-stack
description: >-
  Select and compose Rust toolchains and application libraries for CLI, native GPUI desktop, LLM integration, workflows, validation, and observability.
  Use for rustup, Cargo, Nix compiler alignment, or stack setup, not Rust language design, test implementation, or a Rust Web profile.
---

# Rust Stack

For advanced users who select or maintain the approved Rust stack.
Apply [share-stack](../share-stack/SKILL.md) for common policy.
Keep existing application contracts and upstream-first fork constraints.
Rust Web is out of scope, with no new Web profile.

| Decision                                                | Reference                                            |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Compiler, Cargo, Nix alignment, and capability defaults | [Shared Rust stack](references/stack/share.md)       |
| clap and conditional Tokio use                          | [CLI](references/stack/cli.md)                       |
| Native GPUI integration                                 | [Desktop](references/stack/desktop.md)               |
| Rig and provider composition                            | [LLM](references/stack/llm.md)                       |
| Independent graph-flow, garde, and tracing choices      | [Capabilities](references/knowledge/capabilities.md) |

Add each library only when its capability is necessary.
Use the resolved release's official guidance, not examples for another release.
Use an installed official library skill when available, with its upstream source and documentation as fallbacks.

Use [rust-coding](../rust-coding/SKILL.md) for language decisions and [rust-test](../rust-test/SKILL.md) for tests.
