---
name: share-coding
description: >-
  Make cross-language production design decisions about invariants, boundaries, effects, and abstractions.
---

# Shared Coding Philosophy

For advanced users who make production-code design decisions across languages.

## Coding principles

1. When replacing code or interfaces, remove the obsolete implementation outright. Do not preserve backward compatibility, add compatibility layers, write migration scripts, or keep fallback rollback paths.
2. Choose the simplest implementation that meets the current requirements. Do not add abstractions or configuration layers for hypothetical needs.
3. Start with the smallest working end-to-end version. Verify it works before extending it. Do not break working behavior to prepare for hypothetical complexity.
4. Give each module a clear responsibility. Keep unrelated concerns separate.
5. Prefer mature, actively maintained third-party libraries. Reimplement their capabilities only when there is a compelling reason.
6. Before writing code, check what the project's existing dependencies can do. Use that evidence to decide whether to add a package or write custom code.
7. Make architecture decisions for long-term maintenance. Do not ship temporary workarounds with a plan to revisit them later.
8. Look at how mature products solve the same problem before choosing a design. Reuse proven patterns instead of inventing new ones.

[Source](https://x.com/murong97358/status/2124531122826854873)

For decisions about types, collection identity, boundary conversion, state, errors, and side effects, use [domain modeling and effects](references/domain-models.md).

## Naming

Names state what callers can rely on, not how the implementation works.
Reuse established domain vocabulary and avoid abbreviations unless they are standard in the domain.

## Public surface

Expose only the declarations callers need.
Do not widen production visibility for a test.
Prefer the public contract or the language's white-box test mechanism for a stable internal invariant that cannot reasonably be observed through that contract.

## Testability

Inject dependencies at boundaries, keep branches understandable, and model failures explicitly.
A unit that requires disproportionate setup usually has the wrong boundary or too many responsibilities.

Follow [test implementation boundaries](../share-test/SKILL.md#test-implementation-boundaries) when verifying a change.
Use the established test tools and project rules, not a new script registered in a task runner or CI for an individual test.
Propose a new testing mechanism separately for user approval, or keep verification code temporary and uncommitted.

## Change scope

Prefer small local changes and composable units.
Extract a shared abstraction only after concrete use demonstrates a stable invariant or policy.

## Readability

Choose explicit control flow over compact cleverness.
Comments explain non-obvious reasons and constraints.
The code itself explains what it does.

## Consistency

Look for prior art in the same package before introducing a new pattern.
Record the reason close to the decision when a deliberate divergence is necessary.

## Workspace toolchains and tasks

Use [`share-stack`](../share-stack/SKILL.md) for shared stack and dependency policy.
Read its [task orchestration](../share-stack/references/task-orchestration.md) reference when adding or changing recurring tasks, runner selection, task dependencies, or cache boundaries.

## Abstractions

Keep a wrapper only when it owns a real invariant, reusable policy, or typed boundary.
A helper that merely renames one standard operation and has one call site adds indirection without preserving knowledge.

Infrastructure separation does not require an anti-corruption layer that recreates an existing library's API.
Treat a sufficiently abstract library, such as an ORM, as an existing infrastructure abstraction for the application.
Do not add another abstraction layer merely because the library is an external dependency.
Use the library's infrastructure configuration to switch access targets or backends where supported.
For tests, statically substitute a mock for a library-using operation through that operation's interface, without recreating the library's complete API.
Select these configurations and substitutes in execution or test setup entry points.
ORMs are one example of this principle, not a separate restriction on library choice or count.
Add a narrower domain abstraction only when it owns a demonstrated domain invariant or policy, not to duplicate an existing abstraction.

## Domain boundaries

Place discovery, resolution, and domain rules in the library that owns the concept.
Entry points request resolved domain values rather than reimplementing filesystem walks, lookup rules, or naming policies.

## Scheduling

- [`scheduling.md`](references/scheduling.md): Read before implementing or changing scheduled jobs, periodic tasks, or polling loops.
  Define timing, restart, overlap, missed-run, and retry semantics before selecting a scheduler.

## Concrete implementation skills

- [`js-coding`](../js-coding/SKILL.md): TypeScript implementation.
- [`mbt-coding`](../mbt-coding/SKILL.md): MoonBit implementation.
- [`rust-coding`](../rust-coding/SKILL.md): Rust implementation.

## Related skills

- [`share-test`](../share-test/SKILL.md), [`js-test`](../js-test/SKILL.md), and [`mbt-test`](../mbt-test/SKILL.md): testing philosophy and executable tests.
- [`rust-test`](../rust-test/SKILL.md): executable Rust test guidance.
- [`share-test-design`](../share-test-design/SKILL.md): test-design decisions and suitable evidence presentation.
- [`moonbit-orientation`](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md): official MoonBit documentation skill.
  Prefer the local skill when installed.
  Otherwise, fetch the [MoonBit documentation Markdown source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md) directly.
  Resolve source paths beginning with `/` under `https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/` after stripping the leading slash.
- [`building-components`](https://github.com/vercel/components.build/blob/main/skills/building-components/SKILL.md): official components.build documentation skill.
  Prefer the local skill when installed.
  Otherwise, fetch the Markdown-native [components.build specification](https://www.components.build/llms.txt) directly.
- [`share-artifact`](../share-artifact/SKILL.md): durable README, AGENTS, and ADR authoring.

If the linked skills are not installed, read the source: [js-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-js/skills/js-coding/SKILL.md), [mbt-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-mbt/skills/mbt-coding/SKILL.md), [rust-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-rust/skills/rust-coding/SKILL.md), [js-test](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-js/skills/js-test/SKILL.md), [mbt-test](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-mbt/skills/mbt-test/SKILL.md), [rust-test](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-rust/skills/rust-test/SKILL.md), [share-artifact](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-documentation/skills/share-artifact/SKILL.md).
