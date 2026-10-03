---
name: open-connector
description: >-
  Consult the official oo skill and documentation for OpenConnector CLI usage.
---

# OpenConnector

Use the installed official `oo` skill when available.
Otherwise, consult the [official CLI reference](https://github.com/oomol-lab/oo-cli/blob/main/docs/commands.md) and [self-hosted connector guide](https://github.com/oomol-lab/oo-cli/blob/main/docs/self-hosted-connector.md).

## Execution and Gateway

Use the official CLI without a global installation:

```bash
oo() {
  OO_CONNECTOR_URL="${OPENCONNECTOR_BASE_URL:?Set the trusted gateway URL}" \
  OO_CONNECTOR_TOKEN="${OPENCONNECTOR_TOKEN:?Load the runtime token securely}" \
  OO_SKILLS_SYNC_DISABLED=1 OO_NO_SELF_UPDATE=1 \
  vpx --silent @oomol-lab/oo-cli@1.9.2 "$@"
}
```

Resolve the supplied environment variables from trusted configuration or the existing secret manager without printing tokens.
The explicit gateway environment overrides saved or hosted connector accounts for these task-scoped calls.
Define the launcher in each shell used for the task, or apply those variables to the explicit `vpx` invocation.
If persistent login is needed, use the same supplied gateway rather than selecting another account:

```bash
oo connector login "$OPENCONNECTOR_BASE_URL" --token "$OPENCONNECTOR_TOKEN"
```

If the official package cannot execute, report that dependency failure rather than changing connection credentials or silently bypassing the gateway.
