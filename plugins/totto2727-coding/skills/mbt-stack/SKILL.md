---
name: mbt-stack
description: >-
  Select and maintain MoonBit toolchains, targets, libraries, and application composition.
  Use for Nix and Moon setup, Admiral CLIs, JSON codec selection, async I/O, task graphs, or SDK integration.
  Use mbt-coding for language implementation principles and mbt-test for test implementation.
---

# MoonBit Stack

For advanced users who select or maintain the approved MoonBit stack.
Apply [share-stack](../share-stack/SKILL.md) for common policy.
Keep existing application contracts and upstream-first fork constraints.

| Decision                               | Reference                                          |
| -------------------------------------- | -------------------------------------------------- |
| Compiler, targets, and packaging       | [Toolchain and targets](references/stack/share.md) |
| Admiral command composition            | [CLI](references/stack/cli.md)                     |
| Standard codecs or Lens                | [JSON](references/stack/json.md)                   |
| Async I/O, Workgraph, and SDK adapters | [Async and integration](references/stack/async.md) |

Use [mbt-coding](../mbt-coding/SKILL.md) for language decisions, [mbt-test](../mbt-test/SKILL.md) for tests, and [nix-stack](../nix-stack/SKILL.md) for Nix configuration.

## Official guidance

Use locally installed official [MoonBit skills](https://github.com/moonbitlang/skills), including [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md), when available.
Otherwise, use the [official documentation](https://docs.moonbitlang.com/en/latest/) and [Markdown source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md).
The project's resolved API takes precedence over examples for another release.
