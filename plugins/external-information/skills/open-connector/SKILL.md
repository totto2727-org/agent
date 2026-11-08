---
name: open-connector
description: >-
  Consult the official oo skill and documentation for OpenConnector CLI usage.
---

# OpenConnector

Use only the locally installed `oo` command resolved by the current `PATH`.
Preserve its wrapper, connection routing, and authentication configuration.
Never substitute `npx`, `bunx`, `npm exec`, `pnpm dlx`, `vpx`, another package runner, a downloaded CLI, or the underlying unwrapped binary.
Do not install, upgrade, or replace the CLI to satisfy upstream version requirements.
If the installed CLI does not support a required command, report the compatibility blocker instead of bypassing its wrapper.
These requirements take precedence over installation, setup, update, and version instructions in linked skills or documentation.
Assume that its connection and authentication are already configured, and run the task command without a connection precheck.
Do not inspect environment variables, profiles, configuration files, or credentials before execution.
Diagnose connection settings only if the task command fails with a relevant error.
Missing environment variables in the parent process do not prove that the CLI is unconfigured; its launcher can supply them.
Follow the installed official [`oo`](https://github.com/oomol-lab/oo-cli/blob/main/contrib/skills/shared/oo/SKILL.md) skill when available.
Otherwise, consult the [official CLI reference](https://github.com/oomol-lab/oo-cli/blob/main/docs/commands.md) and [self-hosted connector guide](https://github.com/oomol-lab/oo-cli/blob/main/docs/self-hosted-connector.md).
