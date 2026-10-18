---
name: mbt-stack
description: >-
  Select and maintain MoonBit toolchains, targets, libraries, and application composition.
  Use for Nix and Moon setup, Admiral CLIs, JSON codec selection, async I/O, task graphs, or SDK integration.
  Use mbt-coding for language implementation principles and mbt-test for test implementation.
---

# MoonBit Stack

Use this skill when selecting or maintaining a MoonBit project's development stack or application integration.
Read repository instructions, manifests, resolved dependencies, Nix inputs, and existing tasks before changing the setup.
Apply [share-stack](../share-stack/SKILL.md) for common environment, dependency, task, CI, hosting, and distribution rules.
These defaults do not authorize migration of existing applications or upstream-first forks.

## Load only the required slice

Start with [shared toolchain and target selection](references/stack/share.md).

| Task                                                          | Reference                                          |
| ------------------------------------------------------------- | -------------------------------------------------- |
| Build a command-line application with Admiral                 | [CLI composition](references/stack/cli.md)         |
| Choose fixed-shape codecs or presence-sensitive JSON handling | [JSON boundaries](references/stack/json.md)        |
| Compose async I/O, a task graph, or provider SDK adapters     | [Async and integration](references/stack/async.md) |

Use [mbt-coding](../mbt-coding/SKILL.md) for MoonBit types, errors, ownership, and concurrency principles.
Use [share-coding](../share-coding/SKILL.md) for language-independent implementation rules and [mbt-test](../mbt-test/SKILL.md) for test implementation.
Use [nix-stack](../nix-stack/SKILL.md) for Nix-specific flake, overlay, package, and module configuration.

## Official guidance

Prefer the locally installed official [MoonBit skills](https://github.com/moonbitlang/skills), including [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md), when available.
Otherwise use the [official MoonBit documentation](https://docs.moonbitlang.com/en/latest/) and its [Markdown source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md).
Check API details against the target project's resolved version rather than copying examples from another release.
