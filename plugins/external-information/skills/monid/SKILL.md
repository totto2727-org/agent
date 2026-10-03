---
name: monid
description: >-
  Consult the official Monid skill for Monid CLI usage.
---

# Monid

Use the [official Monid skill](https://monid.ai/SKILL.md), preferring an installed copy of that official skill when available.
Use its command signatures and endpoint inspection guidance, but use the gateway configuration below instead of its global installation, direct-service login, or setup steps.

## Gateway Configuration

Run the official CLI with `vpx`, not a global installation or a custom Monid HTTP client.
Resolve `OPENCONNECTOR_BASE_URL` and `OPENCONNECTOR_TOKEN` from the user's trusted configuration or existing secret manager without printing the token.
The Base URL must be a complete HTTPS origin, and the gateway must support `/v1/passthrough/monid` with a registered Monid connection and the appropriate proxy and connection grants.
Do not silently use Monid directly or another gateway if those prerequisites are missing.

Monid CLI 0.1.7 reads keys from its native configuration files and restricts `keys add` to Monid-shaped keys.
The bundled configuration helper creates an isolated native CLI profile containing the gateway runtime token, leaving the normal Monid profile unchanged.
It writes private credential files, prints only the Base URL and profile location, and performs no network requests or local HTTP relay.
The gateway replaces that runtime token with the saved Monid key for upstream requests.

Set `MONID_SKILL_DIR` to this loaded skill's absolute directory and `TASK_TMP` to a unique task-local temporary directory, then configure the profile and launcher:

```bash
: "${OPENCONNECTOR_BASE_URL:?Set the trusted gateway origin}"
: "${OPENCONNECTOR_TOKEN:?Load the gateway runtime token securely}"
: "${MONID_SKILL_DIR:?Set the absolute loaded skill directory}"
: "${TASK_TMP:?Create a unique task-local temporary directory}"
node "$MONID_SKILL_DIR/scripts/configure-gateway.mjs" > "$TASK_TMP/monid-profile.json" || exit 1
MONID_GATEWAY_BASE_URL="$(jq -er '.apiBaseUrl | strings | select(length > 0)' "$TASK_TMP/monid-profile.json")" || exit 1
MONID_GATEWAY_CONFIG_HOME="$(jq -er '.configHome | strings | select(startswith("/"))' "$TASK_TMP/monid-profile.json")" || exit 1
monid() {
  : "${MONID_GATEWAY_BASE_URL:?Gateway profile setup must succeed first}"
  : "${MONID_GATEWAY_CONFIG_HOME:?Gateway profile setup must succeed first}"
  MONID_API_BASE_URL="$MONID_GATEWAY_BASE_URL" \
  XDG_CONFIG_HOME="$MONID_GATEWAY_CONFIG_HOME" \
  vpx --silent @monid-ai/cli@0.1.7 "$@"
}
monid whoami --json > "$TASK_TMP/monid-whoami.json"
```

Run the setup block in a noninteractive task shell and stop on any setup or extraction failure.
Never invoke the launcher with an empty configuration directory: the official CLI would otherwise fall back to the user's normal profile.
The helper keeps distinct managed profiles for distinct gateway origins.
Reconfiguring the same origin replaces that origin's runtime token, so do not rotate it or use different tokens concurrently while an existing launcher is running.
Use a separate task-specific `XDG_CONFIG_HOME` before setup when concurrent tasks need different runtime tokens.
The launcher overrides the Base URL and configuration directory only for each Monid invocation.
Define it in each shell used for the task, or apply the same two environment variables to the explicit `vpx` command.
Keep the CLI version aligned with the official skill when updating this integration.
Do not use this managed profile for Monid key-management or setup commands, and never send its runtime token to `api.monid.ai` or arbitrary page URLs.
Save complete API responses before inspecting bounded projections, and confirm identity before submitting a billable run.
A missing HTTP forwarding route, unsupported transport, denied grant, or provider error is a verification blocker, not permission to change credentials, grants, or accounts.
The forwarding route is buffered and intended for practical HTTP CLI compatibility, not byte-identical headers, cookies, SSE, WebSocket, or native MCP.
