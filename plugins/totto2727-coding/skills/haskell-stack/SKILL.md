---
name: haskell-stack
description: >-
  Select Haskell Cabal and hpack projects with Nix-managed GHC, Fourmolu, HLint, Hspec, and native tasks.
  Use for toolchain, dependency, optparse-applicative/Aeson CLI, Iris CLI, or Brick/Vty TUI decisions.
  This skill does not select the Stack build tool.
---

# Haskell Stack

| Stack                                          | Selected technologies                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [Haskell toolchain](references/stack/share.md) | Nix-managed GHC, Cabal, hpack, Fourmolu, HLint, Hspec                 |
| [CLI](references/stack/cli.md)                 | Haskell toolchain, optparse-applicative, Aeson                        |
| [Iris CLI](references/stack/iris-cli.md)       | Iris 0.1, optparse-applicative, compatible Nix-managed GHC/Cabal plan |
| [Terminal UI](references/stack/tui.md)         | Haskell toolchain, Brick, Vty                                         |

- Audience: advanced Haskell users who select project tools and application dependencies.
- General stack policy: [share-stack](../share-stack/SKILL.md).
- Implementation principles: [share-coding](../share-coding/SKILL.md).
