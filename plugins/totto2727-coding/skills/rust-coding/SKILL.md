---
name: rust-coding
description: >-
  Implement or review Rust types, ownership, borrowing, Result errors, enums, boundary conversion, cancellation, and resource lifetimes.
  Use for Rust code design and anti-patterns, not toolchain or framework selection.
---

# Rust Coding Index

Use [`share-coding`](../share-coding/SKILL.md) for language-independent design decisions.
This skill serves developers implementing or maintaining Rust code.
Keep repository-specific contracts and upstream-first fork constraints rather than rewriting working code to enforce a new stack.
Read [language principles](references/language-principles.md) for Rust-specific implementation decisions.
Use [rust-stack](../rust-stack/SKILL.md) for toolchains, library selection, and CLI, desktop, or LLM composition.

## Application libraries

Current library selection belongs to [rust-stack](../rust-stack/SKILL.md).
The published [application library reference](references/application-libraries.md) preserves existing section links as forwarding guidance.

## Web UI

Only for maintenance of existing implementations, use the published [legacy Topcoat and Datastar reference](references/web-ui-topcoat-datastar.md).
This compatibility entry is not a new-project recommendation or a Rust Web profile.

## Related skills

- [`rust-test`](../rust-test/SKILL.md): Rust test implementation.
- [`share-test`](../share-test/SKILL.md): language-independent test philosophy.
- [`share-test-design`](../share-test-design/SKILL.md): test-design decisions and suitable evidence presentation.
