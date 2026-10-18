---
name: go-stack
description: >-
  Select and maintain Go modules, Nix toolchains and packages, gofmt, golangci-lint v2, native build and test tasks, and standard-library CLI composition.
  Use for Go setup or stack decisions, not Go implementation principles or API lookup alone.
---

# Go Stack

For developers who configure Go projects and compose CLI applications.
Read [share-stack](../share-stack/SKILL.md) and the affected repository configuration first.
Use [go-coding](../go-coding/SKILL.md) for implementation decisions.

- For compiler, modules, formatting, lint, tests, CI, or Nix packaging, read the [shared Go stack](references/stack/share.md).
- For command parsing, process execution, output, or generator composition, read the [CLI stack](references/stack/cli.md).

For hosted services, follow the Cloudflare Containers default and exception criteria in [share-stack](../share-stack/SKILL.md#select-a-service-host).
Do not turn local CLI execution or library distribution into a hosted service.
For native GUI products, follow the shared [GPUI policy](../share-stack/SKILL.md#select-a-gui-stack).
Do not assume a direct Go binding exists.
