---
name: mbt-coding
description: >-
  Apply MoonBit language implementation principles for typed boundaries, enum state, constructors, visibility, readonly fields and alias safety, collections, typed raise effects, and structured concurrency.
  Use when implementing or reviewing MoonBit production code, not when selecting toolchains or libraries.
---

# MoonBit Coding Index

Use this skill for MoonBit-specific implementation decisions.
Use [share-coding](../share-coding/SKILL.md) for language-independent design principles.
Use [mbt-stack](../mbt-stack/SKILL.md) for toolchains, targets, library selection, and CLI or SDK composition.
Read only the reference needed for the current change.
These principles do not authorize unrelated refactoring of maintained applications or upstream-first forks.

## Type boundaries

- [Boundary conversion](references/boundary-conversion.md): decode external values, validate domain models, and encode request models.
- [State modeling](references/state-modeling.md): enum variants and exhaustive transitions.

## Language conventions

- [Style](references/style.md): public documentation, identifiers, callbacks, labelled arguments, and ignored results.
- [Visibility](references/visibility.md): construction boundaries, readonly fields, alias protection, extension points, and test visibility.
- [Constructors](references/constructors.md): canonical constructors and intent-specific factories.
- [Updates](references/updates.md): immutable values and mutable builders.
- [Sequences](references/sequences.md): Array and Iter return shapes.
- [Variants](references/variants.md): enum representation and typed extraction.
- [Traits](references/traits.md): behavior contracts, implementations, and owned wrappers.
- [Pattern matching](references/pattern-matching.md): patterns, guards, and exhaustiveness.

## Failures

- [Errors](references/errors.md): typed failures, effect signatures, recovery, and error context.

## Collections

- [Arrays](references/arrays.md): construction, shared-reference alias safety, and mutation exceptions.

## Stack and test routing

- [mbt-stack](../mbt-stack/SKILL.md): Nix and Moon tooling, target capability proof, Admiral, JSON, async I/O, and SDK boundaries.
- [share-stack](../share-stack/SKILL.md): common environment, task, CI, hosting, and distribution policy.
- [mbt-test](../mbt-test/SKILL.md): test implementation, assertions, and fixtures.

Prefer locally installed official [MoonBit skills](https://github.com/moonbitlang/skills), including [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md), when available.
Otherwise use the [official MoonBit documentation](https://docs.moonbitlang.com/en/latest/) and [Markdown source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md).
Use the stack's [official Lens routing](../mbt-stack/references/stack/json.md#official-lens-guidance) when Lens-specific guidance is needed.

## Structured values

Use [JSON boundaries](../mbt-stack/references/stack/json.md) for codecs and [path boundaries](../mbt-stack/references/stack/json.md#path-boundaries) for the selected path library.

## Execution

Use [concurrency principles](references/concurrency.md) for language-level execution decisions and [CLI composition](../mbt-stack/references/stack/cli.md) for Admiral applications.

## Code analysis

Use the stack's [semantic navigation](../mbt-stack/references/stack/share.md#semantic-navigation) for Moon IDE tooling.

## Related skills

Use the stack and test routing above to select the owning skill rather than duplicating library guidance here.
