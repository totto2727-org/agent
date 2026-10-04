---
name: open-connector
description: >-
  Consult the official oo skill and documentation for OpenConnector CLI usage.
---

# OpenConnector

Use the installed official `oo` skill when available.
Otherwise, consult the [official CLI reference](https://github.com/oomol-lab/oo-cli/blob/main/docs/commands.md) and [self-hosted connector guide](https://github.com/oomol-lab/oo-cli/blob/main/docs/self-hosted-connector.md).

If the `oo` binary is missing or cannot be invoked, temporarily use `curl` for the equivalent documented API operation through the same trusted OpenConnector gateway and credentials.
Keep the CLI as the normal path; do not build a separate fallback implementation or bypass authentication, permissions, or gateway routing.

## Setup

Configure the installed `oo` CLI once using the trusted gateway environment variables:

```bash
export OO_CONNECTOR_URL="$OPENCONNECTOR_BASE_URL"
export OO_CONNECTOR_TOKEN="$OPENCONNECTOR_TOKEN"
```

Resolve these values from trusted configuration or the existing secret manager without printing tokens.
The explicit gateway environment overrides saved or hosted connector accounts.

## Run

Run the installed `oo` CLI normally, using `oo connector` for gateway operations.
Do not define a wrapper, use a package runner, or bypass the configured gateway.
