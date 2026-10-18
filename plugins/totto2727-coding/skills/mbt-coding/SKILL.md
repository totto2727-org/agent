---
name: mbt-coding
description: >-
  Apply MoonBit language implementation principles for typed boundaries, enum state, constructors, visibility, readonly fields and alias safety, collections, typed raise effects, and structured concurrency.
  Use when implementing or reviewing MoonBit production code, not when selecting toolchains or libraries.
---

# MoonBit Coding Index

For advanced users who make MoonBit-specific implementation decisions.
Use [share-coding](../share-coding/SKILL.md) for common principles and [mbt-test](../mbt-test/SKILL.md) for tests.

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
