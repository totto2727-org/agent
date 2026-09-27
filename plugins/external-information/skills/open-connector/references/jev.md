# Jev Through OOMOL/OpenConnector

Call Jev through the `typesafe_ai` provider on the configured OpenConnector gateway.
This is a typed evaluation API, not a general chat or browser-control API.
Read [runtime access](runtime.md) first for trusted gateway discovery, credentials, curl transport, and error handling.
The gateway stores the TypeSafe API key, while callers use only `OPENCONNECTOR_BASE_URL` and `OPENCONNECTOR_TOKEN`.

## Discover and Verify Access

1. Fetch `GET /v1/actions?service=typesafe_ai` and inspect the deployed schemas for `typesafe_ai.list_models` and `typesafe_ai.evaluate`.
2. Call `typesafe_ai.list_models` with `{"input":{}}` to check the selected connection and discover available model IDs.
3. Report the distinction between catalog availability, a successful model-list call, and a successful evaluation.
   A catalog entry alone does not prove credentials or Action grants work, and listing models does not verify evaluation access or quota.

After resolving and validating the gateway environment as described in runtime access:

```bash
set -o pipefail
: "${OPENCONNECTOR_BASE_URL:?Configure the trusted OpenConnector HTTPS origin}"
: "${OPENCONNECTOR_TOKEN:?Configure the OpenConnector runtime token}"
curl --silent --show-error --fail-with-body --max-time 45 \
  "${OPENCONNECTOR_BASE_URL%/}/v1/actions/typesafe_ai.list_models" \
  --header "Authorization: Bearer $OPENCONNECTOR_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-binary '{"input":{}}' |
  jq -e 'if .success == true then .data.models else error(.message // "Jev model discovery failed") end'
```

Use the model IDs returned by that connection rather than assuming an alias is available.
The current evaluation schema defaults to `jev-latest` when `model` is omitted, but the deployed schema is authoritative.

## Evaluate Typed Questions

`typesafe_ai.evaluate` accepts a shared `state` (text, object, or array), named `questions`, and an optional `model`.

| Question type | Purpose                                  | Question fields                                                        | Result fields                                    |
| ------------- | ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| `choice`      | Select a named category                  | `instructions` and `criteria` mapping option names to descriptions     | `choice`, `confidence`, `probabilities`          |
| `score`       | Score against an ordered rubric          | `instructions` and `criteria` containing 2 to 10 levels, lowest first  | `score`, `confidence`, `legend`, `probabilities` |
| `noul`        | Estimate the probability of a yes answer | `instructions` or `criteria` describing `true` and/or `false` outcomes | `noul`, a probability from 0 to 1                |

The response is under `.data`, with `model`, `answers` keyed by question name, and `usage.input_tokens` and `usage.output_tokens`.
Probabilities and scores are model judgments, not independently verified facts.
Evaluate only user-authorized content and avoid sending unnecessary secrets or personal data.
Evaluation can consume provider quota or incur charges, so use model listing for connection-only checks.

This example classifies a synthetic message using the default model:

```bash
set -o pipefail
: "${OPENCONNECTOR_BASE_URL:?Configure the trusted OpenConnector HTTPS origin}"
: "${OPENCONNECTOR_TOKEN:?Configure the OpenConnector runtime token}"
jq -cn --arg state 'The application crashes when I click Save.' \
  '{input: {state: $state, questions: {category: {type: "choice", instructions: "Classify this support message.", criteria: {bug: "Reports broken behavior", question: "Asks how to use a feature"}}}}}' |
  curl --silent --show-error --fail-with-body --max-time 45 \
    "${OPENCONNECTOR_BASE_URL%/}/v1/actions/typesafe_ai.evaluate" \
    --header "Authorization: Bearer $OPENCONNECTOR_TOKEN" \
    --header 'Content-Type: application/json' \
    --data-binary @- |
  jq -e 'if .success == true then .data else error(.message // "Jev evaluation failed") end'
```

## Boundaries and Failures

- Follow runtime access for the default connection and explicit connection aliases.
  If a connection or Action grant is missing, report the specific failure without changing permissions or bypassing the gateway.
- If the deployed runtime lacks these Actions, report that limitation rather than inventing a `jev` endpoint or assuming model registration adds provider code.
- A working browser bridge or built-in Jev client says nothing about this gateway connection.
  Documenting these Actions does not reroute a client's existing Jev calls through OOMOL, which requires separate client integration.
- Do not automatically retry evaluations after ambiguous timeouts, since the remote call may already have consumed quota.

## Sources

- [TypeSafe AI](https://typesafe.ai)
- [OpenConnector TypeSafe AI provider](https://github.com/oomol-lab/open-connector/tree/main/src/providers/typesafe_ai)
- The configured gateway's `/v1/actions/typesafe_ai.evaluate` and `/v1/actions/typesafe_ai.list_models` schemas are authoritative for that deployment.
