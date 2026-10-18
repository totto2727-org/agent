---
name: nix-stack
description: >-
  Select and maintain Nix development shells, flake inputs, packages, overlays, and system modules. Use when designing reproducible toolchains, packaging a language application with Nix, or structuring NixOS, nix-darwin, or Home Manager configuration. Not for application-language implementation or ordinary dependency updates alone.
---

# Nix Stack

Use this skill to select or maintain Nix infrastructure for a project.
Read [share-stack](../share-stack/SKILL.md) for shared selection rules, dependency safeguards, task ownership, and distribution checks.
Keep application-language choices in the corresponding language stack.

## Choose a reference

| Task                                                                           | Read                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Flake inputs, development shells, formatting, and toolchain authority          | [Shared Nix toolchain](references/stack/share.md)  |
| Application or library derivations, dependency sources, and consumer artifacts | [Packages](references/stack/packages.md)           |
| NixOS, nix-darwin, Home Manager, and overlays                                  | [Systems and modules](references/stack/systems.md) |

Keep this skill independent from the application language.
Do not move every language's compiler flags or library APIs into Nix guidance.
Do not add a Nix layer to an upstream-first fork merely to match a workspace preference.

## Official references

- [Nix manual](https://nix.dev/manual/nix/latest/)
- [Nix learning and guides](https://nix.dev/)
- [Nixpkgs manual](https://nixos.org/manual/nixpkgs/stable/)

Inspect the documentation for the repository's pinned versions before using an option or builder.
