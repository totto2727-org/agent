---
name: mbt-coding
description: >-
  Apply MoonBit language implementation principles for typed boundaries, enum state, constructors, visibility, readonly fields and alias safety, collections, typed raise effects, and structured concurrency.
  Use when implementing or reviewing MoonBit production code, not when selecting toolchains or libraries.
---

# MoonBit Coding

For advanced users who make MoonBit-specific implementation decisions.
Use [share-coding](../share-coding/SKILL.md) for common principles and [mbt-test](../mbt-test/SKILL.md) for tests.

## Failure representation

Use the `raise` effect for synchronous operations that can fail.
Declare the narrowest error type that callers can act on.
Use an open `raise` effect only when the function intentionally forwards heterogeneous failures.
Use a typed `suberror` when callers need to distinguish failure cases or inspect structured context.
Use `fail(...)` for a generic failure that has no recoverable domain variants.

Use `Result` when failure must be a value in the API contract, such as storage, deferred inspection, or an API that consumes `Result`.
Otherwise, prefer the typed `raise` effect so the signature exposes failure without manual success and failure handling.

## Implementation decisions

| Decision                                          | Reference                                                |
| ------------------------------------------------- | -------------------------------------------------------- |
| External values and domain construction           | [Boundary conversion](references/boundary-conversion.md) |
| Enum state and transitions                        | [State modeling](references/state-modeling.md)           |
| Identifiers, callbacks, and labelled arguments    | [Style](references/style.md)                             |
| Construction access, readonly fields, and aliases | [Visibility](references/visibility.md)                   |
| Canonical constructors and factories              | [Constructors](references/constructors.md)               |
| Values and mutable builders                       | [Updates](references/updates.md)                         |
| Array and Iter return shapes                      | [Sequences](references/sequences.md)                     |
| Enum representation and extraction                | [Variants](references/variants.md)                       |
| Traits and owned wrappers                         | [Traits](references/traits.md)                           |
| Guards and exhaustiveness                         | [Pattern matching](references/pattern-matching.md)       |
| Typed failures and raise effects                  | [Errors](references/errors.md)                           |
| Array construction and alias safety               | [Arrays](references/arrays.md)                           |
| Structured execution                              | [Concurrency](references/concurrency.md)                 |

Use [mbt-stack](../mbt-stack/SKILL.md) for toolchains, targets, Admiral, codecs, paths, async libraries, SDKs, and semantic navigation.
Its [official guidance](../mbt-stack/SKILL.md#official-guidance) supplies MoonBit skill and documentation links.
