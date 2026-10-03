---
name: monid
description: >-
  Consult the official Monid skill for Monid CLI usage.
---

# Monid

Use the [official Monid skill](https://monid.ai/SKILL.md) for commands, preferring an installed copy.
Always run the official CLI through the OOMOL/OpenConnector proxy at `${OPENCONNECTOR_BASE_URL}/v1/passthrough/monid`, not directly against Monid.
Use `OPENCONNECTOR_TOKEN` as the gateway credential; the gateway supplies its saved Monid API key upstream.

Set `MONID_SKILL_DIR` to this skill's absolute directory and `TASK_TMP` to a new task-local temporary directory.
The helper creates a separate CLI profile without changing the normal Monid profile.

```bash
: "${MONID_SKILL_DIR:?}" "${TASK_TMP:?}"
XDG_CONFIG_HOME="$TASK_TMP/config" node "$MONID_SKILL_DIR/scripts/configure-gateway.mjs" > "$TASK_TMP/monid-profile.json" || exit 1
MONID_GATEWAY_BASE_URL="$(jq -er '.apiBaseUrl' "$TASK_TMP/monid-profile.json")" || exit 1
MONID_GATEWAY_CONFIG_HOME="$(jq -er '.configHome' "$TASK_TMP/monid-profile.json")" || exit 1
monid() {
  MONID_API_BASE_URL="${MONID_GATEWAY_BASE_URL:?}" \
  XDG_CONFIG_HOME="${MONID_GATEWAY_CONFIG_HOME:?}" \
  vpx --silent @monid-ai/cli@0.1.7 "$@"
}
monid whoami --json > "$TASK_TMP/monid-whoami.json"
```

Do not print or commit credentials, or use this profile for Monid key-management or setup commands.
