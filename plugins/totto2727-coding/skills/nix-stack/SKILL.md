---
name: nix-stack
description: >-
  Select Nix toolchains, package builders, overlays, and system modules. Use for Nix infrastructure decisions, not application architecture or ordinary dependency updates.
---

# Nix Stack

For advanced Nix users who select infrastructure and package tools.
Use [share-stack](../share-stack/SKILL.md) for common policy.

| Decision                                  | Reference                                |
| ----------------------------------------- | ---------------------------------------- |
| Inputs, compiler authority, formatter     | [Toolchain](references/stack/share.md)   |
| Builders and dependency sources           | [Packages](references/stack/packages.md) |
| NixOS, nix-darwin, Home Manager, overlays | [Systems](references/stack/systems.md)   |

Application-language choices remain in their language stacks.
