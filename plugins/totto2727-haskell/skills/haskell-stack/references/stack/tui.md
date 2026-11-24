# Haskell Terminal UI Stack

| Area             | Selection                           | Purpose                                                |
| ---------------- | ----------------------------------- | ------------------------------------------------------ |
| Toolchain        | [Haskell toolchain stack](share.md) | Nix-managed GHC, Cabal, hpack, Fourmolu, HLint, Hspec. |
| Application UI   | Brick                               | Stateful terminal widgets, layout, and event handling. |
| Terminal backend | Vty                                 | Terminal input and screen rendering for Brick.         |

- Select this stack for a full-screen terminal application with an event loop and widget layout.
