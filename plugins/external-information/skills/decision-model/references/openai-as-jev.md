# OpenAI Decisions behind a Jev-compatible interface

Use this guide when callers must keep Jev-shaped data while OpenAI Decisions performs inference.
This is a compatibility design reference, not an implemented adapter.
It does not cover a Jev backend behind an OpenAI-compatible API.

The intended flow is `Jev-shaped request -> adapter -> OpenAI Decisions -> adapter -> Jev-shaped result`.
Apply [interface selection](../SKILL.md#select-the-interface) before choosing this route.
An explicit requirement for actual Jev behavior still selects Jev, not this adapter.

## Contents

- [Choose the compatibility boundary](#choose-the-compatibility-boundary)
- [Translate requests](#translate-requests)
- [Translate successful answers](#translate-successful-answers)
- [Preserve semantics and failure behavior](#preserve-semantics-and-failure-behavior)
- [Acceptance checklist](#acceptance-checklist)
- [Sources and evidence](#sources-and-evidence)

## Choose the compatibility boundary

Prefer the normalized Jev data contract: `{model, answers, usage}` with answers keyed by question ID.
The existing [Jev transport reference](../../cloudflare-ai/references/decision-models.md#read-and-normalize-the-recorded-response) defines that boundary.
The [OpenAI transport reference](../../cloudflare-ai/references/openai-decisions.md) owns endpoints, authentication, caching, and response validation.
Keep provider transport details outside the application's question and answer types.

Do not claim full TypeSafe HTTP or SDK compatibility from matching this JSON shape.
SDK constructors, generic types, exceptions, model aliases, assets, and asynchronous operations need separate compatibility tests if callers use them.
A caller that requires those contracts unchanged should retain Jev until each required feature is supported.

## Translate requests

Capture an ordered list of question IDs and the original criteria before sending the request.
Use that saved list to correlate and validate answers, rather than relying on object iteration after transformations.

| Jev-facing input                          | OpenAI request                                   | Required adjustment                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model: "jev-..."` or a Jev alias         | `model: "gpt-6-luna"`                            | Select the backend explicitly in adapter configuration. Do not silently reinterpret a request that requires the named Jev model.               |
| `state` as text                           | `input` as text                                  | Preserve the evidence without adding output-format instructions.                                                                               |
| `state` as supported plain JSON           | A user message with an `input_json` content part | Preserve JSON value types and structure. `input_json` cannot be an item directly in the `input` array.                                         |
| `questions: {id: question}`               | `questions: [{name: id, ...}]`                   | Preserve IDs exactly, require uniqueness, and record request order.                                                                            |
| `type: "noul"`                            | `type: "predicate"`                              | Keep the statement's yes/no meaning. Do not turn its answer into a boolean.                                                                    |
| Noul `criteria.true` and `criteria.false` | Explicit yes/no descriptions in `instructions`   | OpenAI has no same-named predicate criteria field. Preserve both descriptions and their polarity; this is a semantic rewrite that needs tests. |
| Choice `criteria: {key: description}`     | `choices: [{value: key, description}]`           | Keep each original key as a string and preserve its description. Do not convert a key such as `"true"` into the boolean `true`.                |
| Score `criteria: [description, ...]`      | `levels: [{label, description}, ...]`            | Preserve level order and a stable index-to-original-description table. Use the index, not a returned label, as the Jev score key.              |

Start with text instructions, text criteria, plain JSON state, and the three tested primitives.
Jev permits richer content in instructions and criteria; do not silently stringify assets, images, nested instruction content, or provider-specific objects.
Add an explicit content converter and representative tests before expanding that subset.
Reject unsupported content before a paid request.

`box` is outside the OpenAI Decisions primitive set documented here.
Do not replace a Box answer with a Choice, fabricated coordinates, or an unchecked structured-text response.
Use Jev when Box or another unsupported feature is required.

## Translate successful answers

OpenAI returns an ordered `answers` array.
Before constructing the Jev answer object, require the same count, order, names, and primitive types as the submitted questions.
Reject missing, duplicate, extra, or mismatched answers.
Map each validated answer back to its original question ID.

| OpenAI answer                                                               | Jev-shaped answer                                                                                       | Validation and reconstruction                                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{type: "predicate", probability: p}`                                       | `{type: "noul", noul: p}`                                                                               | Require finite `p` in `[0, 1]`. Do not add a confidence field or threshold `p` into a boolean.                                                          |
| Choice `choice`, `confidence`, `probabilities: [{value, probability}]`      | `{type: "choice", choice, confidence, probabilities: {key: probability}}`                               | Require every original string key exactly once, no additional keys, and a selected key from that set.                                                   |
| Score `score`, `confidence`, `probabilities: [{value, label, probability}]` | `{type: "score", score, confidence, legend: {index: description}, probabilities: {index: probability}}` | Require each index `0..n-1` exactly once. Build `legend` from the saved Jev criteria, not provider-returned labels. JSON object index keys are strings. |

For Choice and Score, require finite confidence and probabilities in `[0, 1]` and distribution mass near one.
Choose an explicit numeric tolerance for provider rounding; reject material inconsistencies rather than silently renormalizing them.
Both tested Score contracts use zero-based levels and a probability-weighted score.
Require a finite Score value in `[0, n-1]` for `n` levels.
For four levels, preserve `[0, 3]`, including fractional values such as `0.44`.
Do not divide by three unless the caller explicitly requests a different, non-Jev scale.
Check that the returned score agrees with `sum(index * probability)` within the chosen tolerance.

For example, assume the caller's original Score criteria are the four descriptions shown in `legend` below.
The recorded OpenAI outage result can then be exposed in this Jev-shaped form:

```json
{
  "model": "gpt-6-luna",
  "answers": {
    "urgent": { "type": "noul", "noul": 0.99 },
    "team": {
      "type": "choice",
      "choice": "technical",
      "probabilities": { "billing": 0, "technical": 1, "unknown": 0 },
      "confidence": 1
    },
    "severity": {
      "type": "score",
      "score": 3,
      "legend": {
        "0": "No customer impact",
        "1": "Inconvenience, checkout still works",
        "2": "Checkout fails for some customers",
        "3": "Checkout fails for all customers"
      },
      "probabilities": { "0": 0, "1": 0, "2": 0, "3": 1 },
      "confidence": 1
    }
  },
  "usage": { "input_tokens": 449, "output_tokens": 0 }
}
```

This example illustrates the output shape; it is not a measured adapter execution or a Jev-generated result.
The rubric must come from the caller's saved criteria.
Report `gpt-6-luna` as the actual model, not a fabricated `jev-...` identity.
Clients that dispatch on a Jev model name need an explicit provider-aware change or must keep Jev.

## Preserve semantics and failure behavior

- **Confidence and thresholds:** copying numeric fields does not reproduce Jev calibration or judgments.
  Validate application decisions on representative cases before reusing thresholds.
  Preserve ambiguous and no-match outcomes; do not add or remove options inside the adapter without an explicit caller contract.
- **Usage:** preserve OpenAI's input and output token counts where those fields match the normalized contract.
  OpenAI Decisions can report zero output tokens; do not invent Jev-like output usage.
  Keep provider-specific cache details separately when needed, and do not price these counts with Jev rates.
  A Gateway cache hit can repeat the original usage; those numbers do not prove a second provider charge.
- **Completion:** normalize only a complete, validated result.
  The observed Jev Gateway response uses `success` and `result.state: "Completed"`; OpenAI Decisions has a different response envelope.
  Prefer the normalized boundary instead of exposing a fake Jev job ID or polling lifecycle.
  If an existing caller requires the exact Gateway envelope, handle that separately after successful validation and preserve failure states.
- **Errors:** keep validation errors, authentication failures, billing failures, rate limits, timeouts, and malformed responses outside the answer object.
  Do not map a failed request to `noul: 0`, `confidence: 0`, a no-match choice, or an empty successful result.
  Preserve available provider error details without claiming they are identical SDK exceptions.
  Do not retry through another provider after an authentication or billing failure.
- **Limits and caching:** validate the selected backend's current question, option, level, content, and context limits before calling it.
  Do not truncate or silently drop questions to fit.
  Include the backend, full translated request, adapter version, and original question/criteria mapping in the cache identity when they affect the returned Jev-shaped result.

## Acceptance checklist

Before declaring an adapter easy or compatible, verify the required subset through the caller's real public interface:

1. Preserve question IDs and choice keys, including numeric-looking strings, `"true"`, and IDs that need safe object-key handling.
2. Convert text and plain JSON state without losing types; reject unsupported content and Box before inference.
3. Test Noul true/false criteria with positive, negative, and ambiguous evidence.
4. Reconstruct every Choice probability and selected key without adding a new no-match option.
5. Test Score endpoints and fractional expectations; reconstruct the original legend with correct string index keys.
6. Reject duplicate, missing, extra, mismatched, non-finite, out-of-range, and materially unnormalized answers.
7. Preserve actual model identity, usage, cache provenance, and failure handling through the application's transport boundary.
8. Test the application's thresholds and resulting actions, not only field names or JSON parsing.

These checks are implementation acceptance criteria, not claims that an adapter already passes them.
If required behavior cannot be preserved and verified with a small adapter, retain Jev as specified by the selection policy.

## Sources and evidence

- [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart): keyed answers, Noul fields, Choice distributions, Score legend, and usage.
- [TypeSafe Noul](https://docs.typesafe.ai/primitives/noul): instructions and optional true/false criteria.
- [TypeSafe Score](https://docs.typesafe.ai/primitives/score): ordered criteria and zero-based expected score.
- [TypeSafe question types](https://docs.typesafe.ai/sdk/python/api/types/questions): rich content in criteria and instructions.
- [OpenAI Decisions reference](https://developers.openai.com/api/reference/resources/decisions/methods/create): input, questions, primitive types, and ordered answers.
- [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions): current capabilities and limits.

The available Jev Gateway fixture identifies `jev-1.13.0` and contains Noul, Choice, and Score results.
The available OpenAI Gateway fixtures identify `gpt-6-luna` and cover those three primitives, plain JSON message content, negative and insufficient-evidence inputs, request errors, and a cache hit.
These separate observations establish the documented wire shapes, not cross-provider semantic equivalence.
No compatibility adapter, reverse facade, or new inference benchmark is included here.
