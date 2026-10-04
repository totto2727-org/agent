# LLM requests

## Generic chat-compatible invocation

The Gateway's compatibility endpoint accepts an OpenAI-style chat body with a configured `provider/model` ID.
Replace the model template below with the ID selected using [model selection](model-routing.md).
Provider-specific fields and authentication remain part of that provider's invocation contract.
For OpenCode Go, use the specialization below instead of executing this generic template.

### Prepare the request and record paths

```bash
set +x
umask 077
mkdir -p tmp
WORK_DIR="$(mktemp -d tmp/cloudflare-ai.XXXXXX)"
MODEL="<provider>/<model>"
URL="https://gateway.ai.cloudflare.com/v1/${CLOUDFLARE_ACCOUNT_ID}/${CLOUDFLARE_AI_GATEWAY_ID}/compat/chat/completions"
REQUEST_FILE="$WORK_DIR/chat-request.json"
RESPONSE_FILE="$WORK_DIR/chat-response.json"
RESPONSE_HEADERS="$WORK_DIR/chat-headers.txt"
jq -n --arg model "$MODEL" '{
  model: $model,
  messages: [{role: "user", content: "Evaluate 2 + 3. Reply with only the numeric result."}],
  max_tokens: 512,
  stream: false
}' > "$REQUEST_FILE"
```

### Execute the request

```bash
{
  printf 'url = "%s"\n' "$URL"
  printf 'header = "cf-aig-authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" \
  --dump-header "$RESPONSE_HEADERS" \
  --output "$RESPONSE_FILE" \
  --write-out 'HTTP %{http_code}\n'
```

This authenticates the Gateway; other configured providers may also require their own upstream authentication.

## OpenCode Go invocation

OpenCode Go uses the same endpoint and chat body, with the `custom-opencode-go/` model prefix and an additional `x-opencode-session` header.
Keep the session ID stable within one logical client session and use a header-safe value.
This invocation relies on the configured custom provider's upstream authentication.

### Prepare the request and record paths

```bash
set +x
umask 077
mkdir -p tmp
WORK_DIR="$(mktemp -d tmp/cloudflare-ai.XXXXXX)"
MODEL="custom-opencode-go/deepseek-v4.1-flash"
SESSION_ID="${OPENCODE_SESSION_ID:-cloudflare-ai-$(date +%s)-$$}"
URL="https://gateway.ai.cloudflare.com/v1/${CLOUDFLARE_ACCOUNT_ID}/${CLOUDFLARE_AI_GATEWAY_ID}/compat/chat/completions"
REQUEST_FILE="$WORK_DIR/chat-request.json"
RESPONSE_FILE="$WORK_DIR/chat-response.json"
RESPONSE_HEADERS="$WORK_DIR/chat-headers.txt"
jq -n --arg model "$MODEL" '{
  model: $model,
  messages: [{role: "user", content: "Evaluate 2 + 3. Reply with only the numeric result."}],
  max_tokens: 512,
  stream: false
}' > "$REQUEST_FILE"
```

### Execute the request

```bash
{
  printf 'url = "%s"\n' "$URL"
  printf 'header = "cf-aig-authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  printf 'header = "x-opencode-session: %s"\n' "$SESSION_ID"
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" \
  --dump-header "$RESPONSE_HEADERS" \
  --output "$RESPONSE_FILE" \
  --write-out 'HTTP %{http_code}\n'
```

`400 MissingSessionID` means the session header is absent, not that a different model is needed.

## Read the recorded response

Both invocation forms store the full body and headers before projecting the chat content:

```bash
jq -er '.choices[0].message.content | select(type == "string" and length > 0)' \
  "$RESPONSE_FILE"
```

Use [connection and records](connection.md) for credentials, storage, failures, and route evidence.

## Sources

- [AI Gateway Custom Providers](https://developers.cloudflare.com/ai-gateway/configuration/custom-providers/): custom model prefixes and compatibility routes.
- [OpenCode Go](https://opencode.ai/docs/go/): model IDs and session requirements.
