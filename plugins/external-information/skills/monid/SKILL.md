---
name: monid
description: >-
  Consult the official Monid skill for Monid CLI usage.
---

# Monid

Use the installed `monid` CLI directly.
Assume that its connection and authentication are already configured, and run the task command without a connection precheck.
Do not inspect environment variables, profiles, configuration files, or credentials before execution.
Diagnose connection settings only if the task command fails with a relevant error.
Missing environment variables in the parent process do not prove that the CLI is unconfigured; its launcher can supply them.
For commands, follow the [official Monid skill](https://monid.ai/SKILL.md), preferring an installed copy of that skill.
