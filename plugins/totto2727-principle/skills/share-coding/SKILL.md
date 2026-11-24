---
name: share-coding
description: >-
  Make cross-language production design decisions about invariants, boundaries, effects, and abstractions.
---

# Shared coding decisions

## Coding principles

Use the decision that matches the change. These eight principles follow the [original source](https://x.com/murong97358/status/2124531122826854873).

1. Replacing an interface: [migrate callers and delete the obsolete implementation](../principle-migrate-callers-then-delete-legacy-apis/SKILL.md).
2. Choosing the scope: [implement current requirements without speculative layers](../principle-laziness-protocol/SKILL.md).
3. Sequencing delivery: [verify the smallest end-to-end version first](../principle-sequence-verifiable-units/SKILL.md).
4. Splitting modules: [give each module a clear responsibility](../principle-minimize-reader-load/SKILL.md).
5. Prefer a mature, maintained library over reimplementation unless a concrete requirement rules it out.
6. Check the project's existing dependencies before adding a package or writing custom code.
7. Choosing an architecture: [design for maintenance rather than a temporary workaround](../principle-foundational-thinking/SKILL.md).
8. Choosing a pattern: [inspect mature products before inventing one](../principle-exhaust-the-design-space/SKILL.md).

## Implementation decisions

- When adding a Git ignore pattern, [separate shared build artifacts from personal files](references/git-excludes.md).
- For collection identity, wire conversion, failure translation, and composition roots, use [domain modeling and effects](references/domain-models.md).
- For scheduled jobs and polling, define [timing, restart, overlap, and missed-run semantics](references/scheduling.md).
- Do not widen the public API for tests. [Test observable behavior](../principle-test-behavior-not-implementation/SKILL.md) through the caller's interface.
- For recurring workspace tasks, use [task orchestration](../share-stack/references/task-orchestration.md).

Name public operations for what callers can rely on. Use established domain vocabulary. Explain a non-obvious constraint or deliberate divergence near the code that depends on it.
