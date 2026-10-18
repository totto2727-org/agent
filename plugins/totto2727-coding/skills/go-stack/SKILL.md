---
name: go-stack
description: >-
  Select Go modules, Nix toolchains, gofmt, golangci-lint v2, native tasks, and CLI dependencies.
  Use for Go stack decisions, not implementation principles or API lookup alone.
---

# Go Stack

For advanced Go users who select project tools and application dependencies.
Use [share-stack](../share-stack/SKILL.md) for general stack policy and [share-coding](../share-coding/SKILL.md) for implementation principles.

- For compiler, dependency, and task decisions, use the [shared Go stack](references/stack/share.md).
- For CLI and generator dependencies, use the [CLI stack](references/stack/cli.md).
- For hosted services, use the shared [service-host policy](../share-stack/SKILL.md#select-a-service-host).
- For native GUIs, use the shared [GPUI policy](../share-stack/SKILL.md#select-a-gui-stack).
  This policy does not establish the availability of a direct Go binding.
