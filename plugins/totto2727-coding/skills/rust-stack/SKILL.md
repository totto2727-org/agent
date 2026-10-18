---
name: rust-stack
description: >-
  Select and compose Rust toolchains and application libraries for CLI, native GPUI desktop, LLM integration, workflows, validation, and observability.
  Use for rustup, Cargo, Nix compiler alignment, or stack setup, not Rust language design, test implementation, or a Rust Web profile.
---

# Rust Stack

This skill serves developers selecting or maintaining a Rust application stack.
Read repository instructions, manifests, lockfiles, task configuration, and CI before changing the baseline.
Apply [share-stack](../share-stack/SKILL.md) for common policy and preserve repository-specific requirements, existing applications, and upstream-first forks.
Read only the profiles needed for the task.

| Concern                                                                  | Reference                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Compiler, targets, dependencies, tasks, CI, packaging, and Nix alignment | [Shared Rust stack](references/stack/share.md)               |
| Arguments, configuration, runtime ownership, output, and exit status     | [CLI](references/stack/cli.md)                               |
| Native GPUI implementation and background work                           | [Desktop](references/stack/desktop.md)                       |
| Rig, provider boundaries, streaming, and tools                           | [LLM](references/stack/llm.md)                               |
| graph-flow, Serde, garde, and tracing conventions                        | [Capability knowledge](references/knowledge/capabilities.md) |

Rust Web is out of scope, and this skill provides no Web profile.
Do not use a replaced application as grounds for selecting a new Web standard.
Library recommendations apply only when the capability is needed, not as mandatory dependencies for every application.
Verify APIs against the repository's resolved versions before writing integration code.
Prefer an installed official library skill when available, with its official source and documentation as fallbacks rather than copied library documentation.

Use [rust-coding](../rust-coding/SKILL.md) and [share-coding](../share-coding/SKILL.md) for implementation principles.
Use [rust-test](../rust-test/SKILL.md), [share-test](../share-test/SKILL.md), and [share-test-design](../share-test-design/SKILL.md) for test implementation and design.
