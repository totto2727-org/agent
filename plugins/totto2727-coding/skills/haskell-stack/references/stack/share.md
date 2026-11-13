# Haskell Toolchain Stack

| Area                      | Selection                               | Configuration                                                                                                    |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Compiler and environment  | Nix-managed GHC                         | Locked Nix Haskell package set for development and package builds.                                               |
| Build and dependency plan | Cabal and cabal-install                 | `index-state` in `cabal.project`, committed `cabal.project.freeze` for the application or contributor test plan. |
| Package description       | hpack                                   | Editable hpack input, committed generated `.cabal` file.                                                         |
| Formatting                | Fourmolu                                | Nix-managed formatter for checks and fixes.                                                                      |
| Lint                      | HLint                                   | Nix-managed lint tool.                                                                                           |
| Tests                     | Hspec                                   | Cabal test suite.                                                                                                |
| Task orchestration        | Native Cabal commands, Just when needed | Project-local Justfile for multi-step tasks.                                                                     |
| Application packaging     | Nix `callCabal2nix`                     | Selected Haskell package set, [nix-stack](../../../nix-stack/SKILL.md) for package mechanics.                    |

- Generate the `.cabal` file before build and test tasks.
- Check generated-manifest drift in a disposable copy without changes to the working tree.
- Keep immutable dependency revisions consistent between Cabal and Nix when both resolve a dependency.
