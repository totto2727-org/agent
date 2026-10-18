---
name: haskell-stack
description: >-
  Select and maintain Haskell Cabal and hpack projects with Nix-managed GHC, reproducible dependency plans, Fourmolu, HLint, Hspec, and native tasks.
  Use for toolchain, packaging, Aeson, or CLI composition decisions, including the conditional Iris compatibility profile.
  Not an instruction to use the Stack build tool.
---

# Haskell Stack

For developers who configure Haskell projects and compose CLI applications.
Read [share-stack](../share-stack/SKILL.md) and the affected repository configuration first.
Use [haskell-coding](../haskell-coding/SKILL.md) for implementation decisions.
The word stack here names the technology profile, not a requirement to use the Stack executable.

- For GHC, dependencies, hpack generation, checks, tests, CI, or Nix packages, read the [shared Haskell stack](references/stack/share.md).
- For command parsing, JSON adapters, terminal interaction, or Iris compatibility, read the [CLI stack](references/stack/cli.md).

For hosted services, follow the Cloudflare Containers default and exception criteria in [share-stack](../share-stack/SKILL.md#select-a-service-host).
Do not add hosting to local CLI tools or libraries without a service requirement.
For native GUI products, follow the shared [GPUI policy](../share-stack/SKILL.md#select-a-gui-stack).
Do not invent a direct Haskell binding or confuse a terminal TUI with a native GUI.
