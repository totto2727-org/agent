# Decision Model requests

Select a configured Decision Model using [Cloudflare AI](../SKILL.md#choose-a-workflow) and use [decision-model](../../decision-model/SKILL.md) to design the state, questions, and criteria.
Native Clef models use `{model, state, questions}`; universal `typesafe/jev` uses `{model, input: {state, questions}}`.

## Prepare the request and record paths

This example prepares the native `clef-flash` request.
Replace `MODEL=clef-flash` with `MODEL=clef` for the other native model.

```bash
set +x
umask 077
mkdir -p tmp
WORK_DIR="$(mktemp -d tmp/cloudflare-ai.XXXXXX)"
MODEL=clef-flash
URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${MODEL}"
REQUEST_FILE="$WORK_DIR/decision-input.json"
RESPONSE_FILE="$WORK_DIR/decision-response.json"
RESPONSE_HEADERS="$WORK_DIR/decision-headers.txt"
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
}' > "$REQUEST_FILE"
CACHE_TTL=2592000
prepare_cache_headers() {
  CACHE_KEY="decision-v1-$({
    printf '%s\n' "$URL" "$CLOUDFLARE_AI_GATEWAY_ID" "$CLOUDFLARE_AI_GATEWAY_API_KEY"
    jq -cS . "$REQUEST_FILE"
  } | shasum -a 256 | cut -d ' ' -f 1)"
  GATEWAY_HEADERS=(
    "header = \"cf-aig-gateway-id: ${CLOUDFLARE_AI_GATEWAY_ID}\""
    "header = \"cf-aig-cache-key: ${CACHE_KEY}\""
    "header = \"cf-aig-cache-ttl: ${CACHE_TTL}\""
    "header = \"cf-aig-skip-cache: false\""
  )
}
prepare_cache_headers
```

### Universal Jev request shape

For `typesafe/jev`, apply this to the prepared state and questions before execution:

```bash
MODEL=typesafe/jev
URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run"
jq --arg model "$MODEL" '{model: $model, input: del(.model)}' \
  "$WORK_DIR/decision-input.json" > "$WORK_DIR/decision-request.json"
REQUEST_FILE="$WORK_DIR/decision-request.json"
prepare_cache_headers
```

This is a universal third-party model ID, not a native `@cf/typesafe/jev` path.
Its Gateway selection remains explicit.
The native Workers AI catalog and universal third-party model IDs are different catalogs; absence from native search does not rule out a universal route.

### Direct native Workers AI

For a direct native `clef` or `clef-flash` request, retain the native URL and body and omit the Gateway header before execution:

```bash
GATEWAY_HEADERS=()
```

This direct variant is for native Clef models, not the universal Jev request.

## Cache and equivalent calls

Every Gateway Decision Model call, whether sent by curl or an application, carries `cf-aig-cache-key`, `cf-aig-cache-ttl`, and `cf-aig-skip-cache: false`.
The custom key opts the request into caching even when global Gateway caching is disabled; TTL alone only changes the lifetime of a request that already uses caching.
The example uses a 30-day TTL (`2592000` seconds) for judgments over stable inputs.
Choose a TTL appropriate to the state; the supported range is 60 seconds through one month.
Use a shorter TTL when freshness or model-version changes matter; a long TTL is not permission to reuse a stale judgment.

The key fingerprints the endpoint, Gateway, credential scope, and complete canonical request JSON, including the model, state, questions, and criteria.
Do not substitute a fixed key or omit meaningful fields, since identical custom keys share a response.
Keep question IDs stable for an equivalent judgment so incidental local identifiers do not prevent reuse.

Submit each prepared logical request once and reuse its recorded result for its consumers.
Coalesce concurrent equivalent work within an application and reuse completed results.
Failed requests may be retried with bounded backoff using the same request and cache key; do not disable the configured Gateway retry policy merely to prevent duplicate successful calls.
Separate runs or processes can reuse a cached successful response under the same key and TTL, so long-lived Gateway caching is sufficient when best-effort reuse meets the application requirement.
Gateway caching is volatile: entries can be unavailable before their TTL ends, and concurrent cold requests can both reach the provider.
A longer TTL reduces repeated calls after a response is cached but does not provide strict cross-process deduplication or an exactly-once guarantee.

## Execute the request

```bash
{
  printf 'url = "%s"\n' "$URL"
  printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  printf '%s\n' "${GATEWAY_HEADERS[@]}"
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" \
  --dump-header "$RESPONSE_HEADERS" \
  --output "$RESPONSE_FILE" \
  --write-out 'HTTP %{http_code}\n'
```

The native URL plus `cf-aig-gateway-id` routes through the existing Gateway.
Workers AI inference uses `Authorization`, not the LLM compatibility endpoint's `cf-aig-authorization` header.

## Read and normalize the recorded response

Native Clef responses expose `result.answers`.
The observed universal Jev response exposes `result.state: "Completed"` and `result.result.answers`.

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
' "$RESPONSE_FILE" > "$WORK_DIR/decision-normalized.json"
jq -e --slurpfile input "$WORK_DIR/decision-input.json" \
  '(.answers | keys) == ($input[0].questions | keys)' \
  "$WORK_DIR/decision-normalized.json"
jq '{model, answers, usage}' "$WORK_DIR/decision-normalized.json"
```

Reject incomplete jobs, missing envelopes, and missing answers rather than treating them as positive judgments.
Question coverage is the first response check; validate returned types, choice membership, finite numeric ranges, and probability distributions at the application's typed boundary.
Confidence and probability do not authorize consequential actions.
Use the [Cloudflare AI entry point](../SKILL.md) for shared connection and failure handling.
Read `cf-aig-cache-status` from the recorded headers to distinguish an observed `HIT` from `MISS`; the cache key or repeated response text alone does not prove a hit.
If a universal response has no cache-status header, retain an unknown cache status rather than assuming either a hit or a miss.
Caller-side deduplication still applies regardless of the Gateway's cache outcome.

## Sources

- [AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/): universal envelopes and Gateway selection.
- [Workers AI REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/): native inference requests.
- [AI Gateway caching](https://developers.cloudflare.com/ai-gateway/features/caching/): per-request cache opt-in, keys, TTL, hit status, and concurrent-miss limits.
- [Gateway request handling](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/): bounded retries for failed requests.
