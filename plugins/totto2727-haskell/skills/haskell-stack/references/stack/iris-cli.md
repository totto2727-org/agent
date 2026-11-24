# Haskell Iris CLI Stack

| Area                           | Selection                     | Configuration                                                                   |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| Terminal interaction           | Iris 0.1                      | Select this stack for a CLI that uses Iris.                                     |
| Command interface              | optparse-applicative          | Typed options and subcommands.                                                  |
| Compiler and build plan        | Nix-managed GHC and Cabal     | Select a compiler and dependency plan within the Iris 0.1 package bounds.       |
| Package description and checks | hpack, Fourmolu, HLint, Hspec | Use the [Haskell toolchain workflow](share.md) with the compatible package set. |

- Keep Cabal bounds and Nix overrides consistent without bypassing Iris compatibility bounds with `allow-newer`.
