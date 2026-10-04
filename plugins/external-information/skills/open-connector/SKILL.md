---
name: open-connector
description: >-
  Consult the official oo skill and documentation for OpenConnector CLI usage.
---

# OpenConnector

Use the installed official `oo` skill when available.
Otherwise, consult the [official CLI reference](https://github.com/oomol-lab/oo-cli/blob/main/docs/commands.md) and [self-hosted connector guide](https://github.com/oomol-lab/oo-cli/blob/main/docs/self-hosted-connector.md).

If `oo` fails with `EACCES` or `Permission denied`, follow [Executable permission errors](#executable-permission-errors) below and retry the CLI instead of switching to `curl`.
If the `oo` binary is missing or cannot be invoked for another reason, temporarily use `curl` for the equivalent documented API operation through the same trusted OpenConnector gateway and credentials.
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

## Executable permission errors

If `oo` fails with `EACCES` or `Permission denied`, inspect the exact binary path reported by the error with `ls -l`.
If that trusted installed binary lacks execute permission for the current user, grant it execute permission and retry the original command:

```bash
ls -l "/absolute/path/to/the/reported/oo/binary"
chmod u+x "/absolute/path/to/the/reported/oo/binary"
```

Replace the example path with the actual binary path from the error, including the platform-specific `@oomol-lab/oo-cli-<platform>/bin/oo` binary when reported, rather than only changing the launcher.
Apply this repair only to that binary; do not use recursive permission changes, `chmod 777`, or `sudo` as a generic workaround.
If the binary already has execute permission or the same error persists, investigate the remaining access restriction instead of broadening permissions.
