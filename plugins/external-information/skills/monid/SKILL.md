---
name: monid
description: >-
  Consult the official Monid skill for Monid CLI usage.
---

# Monid

Use the installed `monid` CLI and the [official Monid skill](https://monid.ai/SKILL.md) for commands, preferring an installed copy of that skill.
Always use the OOMOL/OpenConnector proxy, not Monid directly.
`OPENCONNECTOR_BASE_URL` is the trusted HTTPS gateway origin, and `OPENCONNECTOR_TOKEN` is its runtime token.

## Setup

Configure a separate CLI profile once in a new task-local `TASK_TMP` directory.
These files store the gateway token because `monid keys add` accepts only Monid-shaped keys.

```bash
set -e
: "${OPENCONNECTOR_BASE_URL:?}" "${OPENCONNECTOR_TOKEN:?}" "${TASK_TMP:?}"
[[ "$OPENCONNECTOR_BASE_URL" == https://* ]]
umask 077
XDG_CONFIG_HOME="$(mktemp -d "$TASK_TMP/monid.XXXXXX")"
export XDG_CONFIG_HOME
mkdir "$XDG_CONFIG_HOME/monid"
MONID_GATEWAY_BASE_URL="${OPENCONNECTOR_BASE_URL%/}/v1/passthrough/monid"
jq -n '{version: "0.1.7", active_key: "gateway", last_update_check: (now | todate)}' > "$XDG_CONFIG_HOME/monid/config.yaml"
OPENCONNECTOR_TOKEN="$OPENCONNECTOR_TOKEN" jq -n '{keys: {gateway: {key: env.OPENCONNECTOR_TOKEN, prefix: "gateway", added_at: (now | todate)}}}' > "$XDG_CONFIG_HOME/monid/credentials.yaml"
```

## Run

Run normal `monid` commands, adding the proxy URL to every invocation:

```bash
MONID_API_BASE_URL="$MONID_GATEWAY_BASE_URL" monid whoami --json > "$TASK_TMP/monid-whoami.json"
MONID_API_BASE_URL="$MONID_GATEWAY_BASE_URL" monid inspect --provider tinyfish --endpoint /search --json > "$TASK_TMP/search-schema.json"
```

Do not print or commit credentials, or use this profile for Monid key-management or setup commands.
