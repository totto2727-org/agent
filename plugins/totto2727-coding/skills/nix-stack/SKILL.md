---
name: nix-stack
description: >-
  Select Nix toolchains and JS application package builds. Use for Nix infrastructure decisions, not application architecture or ordinary dependency updates.
---

# Nix Stack

| Stack                  | Technologies                          | Reference                                            |
| ---------------------- | ------------------------------------- | ---------------------------------------------------- |
| Toolchain              | Nix Flakes, `flake.lock`, nixfmt      | [Toolchain](references/stack/share.md)               |
| JS application package | pnpm dependency resolution, Bun build | [JS application](references/stack/js-application.md) |

- Shared policy: [share-stack](../share-stack/SKILL.md).
