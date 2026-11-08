# OpenAI Decisions requests

Use this reference after [interface selection](../../decision-model/SKILL.md#select-the-interface).
Call `gpt-6-luna` through the configured AI Gateway's OpenAI provider route.
The Gateway uses its configured provider credential; do not add a direct OpenAI key or switch billing routes after a failure.
A successful request does not establish subscription coverage or the final billed cost.

## Contents

- [Prepare the request](#prepare-the-request)
- [Execute the request](#execute-the-request)
- [Validate the response](#validate-the-response)
- [Other question and input types](#other-question-and-input-types)
- [Sources](#sources)

## Prepare the request

Run preparation, execution, and validation in the same Bash process.
Use [PassCLI injection](../SKILL.md#passcli-credential-injection) when the required variables are not inherited.
Apply the shared [cache and equivalent-call rules](decision-models.md#cache-and-equivalent-calls).

```bash
set -euo pipefail
set +x
umask 077
mkdir -p tmp
WORK_DIR="$(mktemp -d tmp/cloudflare-ai.XXXXXX)"
URL="https://gateway.ai.cloudflare.com/v1/${CLOUDFLARE_ACCOUNT_ID}/${CLOUDFLARE_AI_GATEWAY_ID}/openai/decisions"
REQUEST_FILE="$WORK_DIR/decision-request.json"
RESPONSE_FILE="$WORK_DIR/decision-response.json"
RESPONSE_HEADERS="$WORK_DIR/decision-headers.txt"
jq -n '{
  model: "gpt-6-luna",
  input: "Checkout has been failing for every customer for the last hour.",
  questions: [{
    type: "predicate",
    name: "urgent",
    instructions: "Does this report describe an urgent ongoing service outage?"
  }]
}' > "$REQUEST_FILE"
CACHE_KEY="decision-v1-$({
  printf '%s\n' "$URL" "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  jq -cS . "$REQUEST_FILE"
} | shasum -a 256 | cut -d ' ' -f 1)"
CACHE_TTL=3600
```

The URL includes the account and Gateway identifiers.
The cache key also includes the credential scope and complete canonical request.
Choose a TTL that fits the input's freshness requirements.

## Execute the request

```bash
{
  printf 'url = "%s"\n' "$URL"
  printf 'header = "cf-aig-authorization: Bearer %s"\n' "$CLOUDFLARE_AI_GATEWAY_API_KEY"
  printf 'header = "cf-aig-cache-key: %s"\n' "$CACHE_KEY"
  printf 'header = "cf-aig-cache-ttl: %s"\n' "$CACHE_TTL"
  printf 'header = "cf-aig-skip-cache: false"\n'
} | curl --disable --config - \
  --request POST --silent --show-error --fail-with-body \
  --connect-timeout 15 --max-time 90 \
  --header 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" \
  --dump-header "$RESPONSE_HEADERS" \
  --output "$RESPONSE_FILE" \
  --write-out 'HTTP %{http_code}\n'
```

Use `cf-aig-authorization`, not the Workers AI route's `Authorization` header.
Follow the shared [failure rules](../SKILL.md#failures), including stopping on authentication or billing failures.
A `400` response is not a judgment; inspect its `error.param` and correct the request before a bounded retry.

## Validate the response

OpenAI returns top-level `model`, `answers`, and `usage` fields, not a Workers AI envelope.
The following check is specific to the single-predicate example:

```bash
jq -e --slurpfile request "$REQUEST_FILE" '
  . as $response | $request[0] as $request
  | if .error != null
      or .model != $request.model
      or (.answers | type) != "array"
      or (.answers | length) != 1
      or .answers[0].name != $request.questions[0].name
      or .answers[0].type != "predicate"
      or (.answers[0].probability | type) != "number"
      or (.answers[0].probability >= 0 and .answers[0].probability <= 1 | not)
    then error("invalid predicate decision")
    else {model, answers, usage} end
' "$RESPONSE_FILE" > "$WORK_DIR/decision-normalized.json"
jq '{model, answers, usage}' "$WORK_DIR/decision-normalized.json"
```

For batches, require exact answer count, order, names, and types before converting the array into a keyed object.
Use unique question names and reject missing or duplicate answers.
Inspect `cf-aig-event-id` or `cf-aig-trace-id` for route evidence and `cf-aig-cache-status` for an observed cache result.
Do not infer a cache hit from equal response bodies or reuse the cached response's usage as a new billed-token count.

## Other question and input types

- `predicate` returns `probability`, not a separate confidence value.
- `choice` accepts `choices: [{value, description}]` and returns `choice`, `probabilities`, and `confidence`.
  Check typed choice membership, complete distribution coverage, finite probabilities in `[0, 1]`, and a sum near one.
- `score` accepts ordered `levels: [{label, description}]` and returns `score`, `probabilities`, and `confidence`.
  Scores use the zero-based level scale: four levels span `[0, 3]`, not `[0, 1]`.
  Check the level distribution and its probability-weighted score.
- To supply structured data, use `input: [{type: "message", role: "user", content: [{type: "input_json", data: {message: "Hello"}}]}]`.
  `input_json` is a message-content part, not a top-level item in the `input` array.

Check current model limits before large batches or multimodal requests.
Keep no-match outcomes explicit and test positive, negative, and insufficient-evidence cases in the application's real workflow.

## Sources

- [Create a decision](https://developers.openai.com/api/reference/resources/decisions/methods/create): request and response contracts.
- [Decisions guide](https://developers.openai.com/api/docs/guides/decisions): primitives, input formats, and current limits.
- [Cloudflare OpenAI provider](https://developers.cloudflare.com/ai-gateway/usage/providers/openai/): Gateway provider route.
