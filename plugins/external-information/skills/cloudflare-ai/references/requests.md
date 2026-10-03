# curl inference requests

Use these examples with [cloudflare-ai](../SKILL.md), whose routing and cost policy applies to every call.
Credentials and account/Gateway variables are already configured; do not obtain or print them.
Run the preparation block and the selected request in the same Bash process.

## Prepare a protected workspace

```bash
set +x
set -euo pipefail
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_AI_GATEWAY_API_KEY:?CLOUDFLARE_AI_GATEWAY_API_KEY is required}"
: "${CLOUDFLARE_AI_GATEWAY_ID:?CLOUDFLARE_AI_GATEWAY_ID is required}"
[[ "$CLOUDFLARE_ACCOUNT_ID" =~ ^[0-9a-fA-F]{32}$ ]]
[[ "$CLOUDFLARE_AI_GATEWAY_ID" =~ ^[a-zA-Z0-9_-]+$ ]]
[[ "$CLOUDFLARE_AI_GATEWAY_API_KEY" != *$'\n'* ]]
[[ "$CLOUDFLARE_AI_GATEWAY_API_KEY" != *$'\r'* ]]
[[ "$CLOUDFLARE_AI_GATEWAY_API_KEY" != *'"'* ]]
[[ "$CLOUDFLARE_AI_GATEWAY_API_KEY" != *'\'* ]]
umask 077
mkdir -p tmp
WORK_DIR="$(mktemp -d tmp/cloudflare-ai.XXXXXX)"
```

Keep request/response content private and exclude this workspace from commits.
Never save a curl configuration containing the token, print the environment, enable shell tracing, or use curl verbose/trace flags.
`--disable` ignores a local curl configuration that could unexpectedly log or redirect a request.
No example follows redirects or automatically retries a paid request.

## OpenCode Go chat

Keep `SESSION_ID` stable across requests belonging to one logical session.
Prefer an existing client session ID; the fallback below generates an ID for this process.
The value must be header-safe and is not an authentication secret.

```bash
SESSION_ID="${OPENCODE_SESSION_ID:-cloudflare-ai-$(date +%s)-$$}"
[[ -n "$SESSION_ID" && "$SESSION_ID" != *$'\n'* && "$SESSION_ID" != *$'\r'* ]]
[[ "$SESSION_ID" != *'"'* && "$SESSION_ID" != *'\'* ]]
jq -n '{
  model: "custom-opencode-go/deepseek-v4.1-flash",
  messages: [{role: "user", content: "Evaluate 2 + 3. Reply with only the numeric result."}],
  max_tokens: 512,
  stream: false
}' > "$WORK_DIR/chat-request.json"
{
  printf 'url = "https://gateway.ai.cloudflare.com/v1/%s/%s/compat/chat/completions"\n' \
    "$CLOUDFLARE_ACCOUNT_ID" "$CLOUDFLARE_AI_GATEWAY_ID"
  printf 'header = "cf-aig-authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  printf 'header = "x-opencode-session: %s"\n' "$SESSION_ID"
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$WORK_DIR/chat-request.json" \
  --output "$WORK_DIR/chat-response.json" \
  --write-out 'HTTP %{http_code}\n'
jq -er '.choices[0].message.content | select(type == "string" and length > 0)' \
  "$WORK_DIR/chat-response.json"
```

The response uses `choices[0].message.content`, not the Decision Model envelope.
A `MissingSessionID` error means the required `x-opencode-session` header is absent; switching models will not fix it.
This example relies on the configured `custom-opencode-go` provider's upstream authentication.
Do not assume another custom provider can omit its own credentials.
Do not replace the default model with another provider unless the parent skill's fallback conditions are met.

## Decision Models

Choose the model deliberately within the authorized budget; this example starts with `clef-flash`, not a claim that it is always the cheapest.
Set `MODEL=clef` or `MODEL=typesafe/jev` when that model is the appropriate configured choice.
Use [decision-model](../../decision-model/SKILL.md) for task-specific state, criteria, limits, and uncertainty handling.

```bash
MODEL=clef-flash
case "$MODEL" in
  clef|clef-flash)
    URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${MODEL}"
    ;;
  typesafe/jev)
    URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run"
    ;;
  *) printf 'Unsupported Decision Model\n' >&2; exit 2 ;;
esac
jq -n --arg model "$MODEL" '{
  model: $model,
  state: "Checkout has been failing for every customer for the last hour.",
  questions: {
    urgent: {type: "noul", instructions: "Is this support request urgent?"},
    team: {
      type: "choice",
      instructions: "Which team should handle this request?",
      criteria: {
        billing: "Payments, invoices, and refunds",
        technical: "Outages, errors, and configuration",
        sales: "Plans and upgrades"
      }
    },
    severity: {
      type: "score",
      instructions: "How severe is the customer impact?",
      criteria: ["No impact", "Minor", "Major", "Critical"]
    }
  }
}' > "$WORK_DIR/decision-input.json"
if [[ "$MODEL" == typesafe/jev ]]; then
  jq '{model: .model, input: del(.model)}' "$WORK_DIR/decision-input.json" \
    > "$WORK_DIR/decision-request.json"
else
  jq '.' "$WORK_DIR/decision-input.json" > "$WORK_DIR/decision-request.json"
fi
if [[ "${DIRECT_WORKERS_AI:-0}" == 1 && "$MODEL" == typesafe/jev ]]; then
  printf 'Direct Workers AI mode is only for native clef models\n' >&2
  exit 2
fi
{
  printf 'url = "%s"\n' "$URL"
  printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  if [[ "${DIRECT_WORKERS_AI:-0}" != 1 ]]; then
    printf 'header = "cf-aig-gateway-id: %s"\n' "$CLOUDFLARE_AI_GATEWAY_ID"
  fi
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$WORK_DIR/decision-request.json" \
  --dump-header "$WORK_DIR/decision-headers.txt" \
  --output "$WORK_DIR/decision-response.json" \
  --write-out 'HTTP %{http_code}\n'
```

For a **direct native Workers AI** request, set `DIRECT_WORKERS_AI=1` before this block and choose `clef` or `clef-flash`.
With the default mode, the same native model URL plus `cf-aig-gateway-id` routes through the existing Gateway.
`typesafe/jev` is a third-party universal request, not an invented `@cf/typesafe/jev` native model.
Omitting its Gateway header is not a documented provider-direct mode; keep the explicit Gateway selection.
Workers AI inference uses `Authorization`, not the OpenCode Go `cf-aig-authorization` header.
The generic `/ai/run` body has **`{model, input: {state, questions}}`**, while the native Clef body has **`{model, state, questions}`**.

## Normalize and check judgments

Native Clef responses expose `result.answers`.
The observed universal Jev response exposes `result.state: "Completed"` and **`result.result.answers`**.
Reject other job states, missing envelopes, and missing answers instead of confusing an incomplete result with a pass.

```bash
jq -e '
  if .success != true then error("inference failed")
  elif (.result | type) != "object" then error("missing result")
  else .result end
  | if has("state") then
      if .state == "Completed" and (.result | type) == "object" then .result
      else error("job is not complete") end
    else . end
  | if (.model | type) != "string" or (.answers | type) != "object"
    then error("invalid judgment result")
    else {model, answers, usage} end
' "$WORK_DIR/decision-response.json" > "$WORK_DIR/decision-normalized.json"
jq -e --slurpfile input "$WORK_DIR/decision-input.json" \
  '(.answers | keys) == ($input[0].questions | keys)' \
  "$WORK_DIR/decision-normalized.json"
jq '{model, answers, usage}' "$WORK_DIR/decision-normalized.json"
```

Question coverage is only the first check: validate each question's returned type, permitted choice keys, numeric ranges, probability distributions, and task-specific acceptance criteria.
Do not turn a high probability or confidence into authorization for consequential actions.
Save full responses before reading a bounded projection; a large link inventory or full distribution need not enter the main model's context.

Gateway response headers such as `cf-aig-event-id`, `cf-aig-trace-id`, and, when present, `cf-aig-log-id` are useful route evidence.
Do not require a log ID when the API returns only event/trace IDs, or claim a cache miss without the corresponding response header.
The examples leave logging and caching policy to the configured Gateway; choose explicit per-request policy when private inputs or freshness require it.

Implementations must preserve these envelope distinctions, keep API secrets on the server side, and validate untrusted output at a typed boundary.
Use the parent skill's authentication/billing failure rules; do not silently turn a failed Decision Model request into a more expensive generative-model call.
