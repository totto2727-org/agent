---
name: mbt-stack
description: >-
  Select and maintain MoonBit toolchains, targets, libraries, and application composition.
  Use for Nix and Moon setup, Admiral CLIs, JSON codec selection, async I/O, task graphs, or SDK integration.
  Use mbt-coding for language implementation principles and mbt-test for test implementation.
---

# MoonBit Stack

| Selected technologies                                                                                                                                                    | Composition                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [Nix](https://nixos.org/), [moonbit-overlay](https://github.com/totto2727-org/moonbit-overlay), [Moon](https://docs.moonbitlang.com/en/latest/toolchain/moon/index.html) | [MoonBit baseline](references/stack/share.md)                              |
| [Admiral](https://mooncakes.io/docs/totto2727/admiral)                                                                                                                   | [CLI addition](references/stack/cli.md)                                    |
| [Standard codecs](https://docs.moonbitlang.com/en/latest/language/derive.html), conditional [Lens](https://mooncakes.io/docs/totto2727/lens)                             | Baseline [codec selection](references/stack/share.md#capability-additions) |
| [moonbitlang/async](https://github.com/moonbitlang/async), conditional [Workgraph](https://github.com/totto2727-org/workgraph)                                           | Baseline I/O and sequential task-graph additions                           |

- Audience: advanced users selecting or maintaining MoonBit stacks.
- Common policy: [share-stack](../share-stack/SKILL.md).
- Language, tests, and Nix: [mbt-coding](../mbt-coding/SKILL.md), [mbt-test](../mbt-test/SKILL.md), [nix-stack](../nix-stack/SKILL.md).

## Official guidance

- Prefer installed official [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md).
- Fallback: its upstream skill and [MoonBit documentation](https://docs.moonbitlang.com/en/latest/).
