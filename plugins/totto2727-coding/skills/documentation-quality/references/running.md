# Running document evaluations

Use Node.js 22 or later.
In this repository, prefix commands with `nix develop --command` to use the pinned environment.
Mechanical checks need no model, credentials, or network.
Semantic checks additionally require `curl` and the configured Cloudflare environment.

## Prepare a manifest

Paths are relative to the manifest file unless absolute.
Use exactly one of `rulesFile` or inline `rules`.
Keep the [coverage record](coverage.md) with the report: the bundled catalog does not cover the full standard.

```json
{
  "model": "clef-flash",
  "englishOnly": true,
  "templateConstraints": ["Preserve required headings, order, sections, and exact identifiers."],
  "rulesFile": "../../plugins/totto2727-coding/skills/documentation-quality/references/rules.json",
  "documents": [
    {
      "id": "guide",
      "path": "../../docs/guide.md",
      "sourceLanguage": "en",
      "purpose": "Create a project and run its default page.",
      "audience": "Beginner users of the package, including programmers consuming its API.",
      "ruleIds": ["code-fence-language", "audience-boundary", "ste-faq-procedural-instructions"]
    }
  ]
}
```

This example assumes a manifest in `<repository>/tmp/review/`.
Adjust paths for the installed skill and target repository.
Replace the example model with the supported model selected through cloudflare-ai; the example is not a cost or accuracy recommendation.
A mixed semantic plan requires a selected model, while `--mechanical-only` does not.
When `englishOnly` is true, declare `sourceLanguage` for every entry.
Non-English entries are excluded with an explicit reason instead of being evaluated as English or silently counted as passes.
Language metadata is a declaration, not automatic language detection.
Review translation fidelity separately against the English source.
Document-level `templateConstraints` supplement the manifest-level constraints.
Do not place expected verdicts, labeled examples, secrets, or instructions to override the rubric in the metadata.

Apply all applicable verified rules when reviewing a document.
Use `ruleIds` only to select a deliberate review boundary and report that boundary, not to suppress inconvenient failures.

## Define rules

A rule's scope is `page`, `section`, or `paragraph`.
Cross-page or document-set scopes are not supported.
Source metadata identifies the actual standard-derived guidance or supplementary principle.

A mechanically decidable property belongs in a mechanical rule:

```json
{
  "id": "code-fence-language",
  "scope": "page",
  "engine": "mechanical",
  "check": { "kind": "fenced-code-language" },
  "source": { "kind": "supplement", "reference": "project Markdown convention" }
}
```

For exact project vocabulary restrictions, use `check.kind: "prohibited-terms"`, `terms`, optional `protectedTerms`, and optional `caseSensitive`.
This is a literal token check, not a guessed STE dictionary.
See [mechanical boundaries](rules/mechanical.md).

A contextual rule uses `engine: "decision"` and supplies `instructions`, `pass`, and `fail`.
Legacy contextual definitions without `engine` default to `decision`.
Keep questions local and typed; do not ask the model to execute commands, verify another page, count a mechanically decidable property, or generate a correction as an authoritative result.

## Select source units

The runner selects heading sections and coherent paragraphs from the actual source.
Preserve code, tables, lists, warnings, and their explanations as complete units.
For deliberate inclusive one-based ranges, add `sections` to the document entry:

```json
{
  "sections": [
    {
      "id": "setup-note",
      "startLine": 14,
      "endLine": 18,
      "headingPath": ["Setup", "Runtime requirements"]
    }
  ]
}
```

Inspect the selected source range and do not split a fence or another necessary representation.
Page rules still inspect the complete page.
The request supplies the target unit and same-page context, not evidence from another document.
Nonempty legacy `context` is rejected.
Move task metadata to `purpose`, `audience`, and `templateConstraints`, and keep external evidence in a separate review instead of the local request.
Large evidence is rejected rather than silently truncated.
A byte guard is not a tokenizer or proof that the provider's token limit will be met.
For oversized pages, use a reasoning reviewer or a genuinely independent smaller source unit rather than a copied fragment presented as a complete page.

## Run without inference

Create the output directory, then inspect a plan:

```bash
node plugins/totto2727-coding/skills/documentation-quality/scripts/evaluate.mjs \
  --manifest tmp/review/manifest.json \
  --output tmp/review/plan.json \
  --dry-run
```

Run actual mechanical checks without model credentials:

```bash
node plugins/totto2727-coding/skills/documentation-quality/scripts/evaluate.mjs \
  --manifest tmp/review/manifest.json \
  --output tmp/review/mechanical.json \
  --mechanical-only
```

Dry runs plan work; they do not establish acceptance.
Mechanical-only runs execute mechanical rules and retain semantic checks as deferred, `insufficient_context`, and review-required.
A mixed catalog cannot receive overall semantic acceptance from this mode.

## Configure semantic inference

Use [decision-model](../../../../external-information/skills/decision-model/SKILL.md) for judgment design and task-specific calibration.
Use [cloudflare-ai](../../../../external-information/skills/cloudflare-ai/SKILL.md) for current model selection, credentials, account and Gateway configuration, and billing rules.
Set `manifest.model` only for the selected supported Decision Model.
The evaluator uses Cloudflare's documented native or universal Decision Model route.
Even when a model identifier names another provider, do not operate that provider directly or add a provider-direct fallback.
Question and answer collections are keyed objects.
The report records the returned concrete model; keep that model stable when comparing rubric changes.

Do not copy a universal confidence threshold from an example.
Calibrate `manifest.threshold` against independently labeled representative success, failure, ambiguity, and boundary cases for the intended task and model.
Without a threshold, semantic judgments remain `uncalibrated` and require review even when the selected answer is `pass`.
A configured number alone does not establish calibration quality.

Inspect the dry-run ranges, rules, exclusions, and requests before sending private content.
Confirm that the configured Gateway and model provider may receive the selected contents.
Remove `--dry-run`, choose a new report path, and use bounded concurrency; the default is 4.
Do not exceed account or model limits.

Every inference request includes the Gateway cache key, TTL, and skip-cache headers described by cloudflare-ai.
Equivalent work in a run shares one operation; only an observed Gateway `HIT` proves a remote cache hit.
The evaluator makes one client attempt per logical request and does not override the Gateway's configured retry behavior.
For `401`, `402`, or `403`, it stops queued inference work, retains errors and skipped work, and does not change model, account, credentials, or billing route.
Already-in-flight work may finish.
Incomplete, malformed, authentication, or billing responses are not judgments.

## Read the report

The report retains rule and document identities, source metadata, engine, scope, ranges, template constraints, exclusions, answers, probabilities, concrete model, and errors.
A Choice's confidence and its selected option's probability are different fields.
Mechanical evidence and deferred semantic results remain distinguishable.

| Process exit | Meaning                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`          | Planning completed, or all executed checks satisfied the configured acceptance conditions                                                    |
| `1`          | At least one result requires review, including a defect, deferred or uncalibrated judgment, abstention, low confidence, or execution failure |
| `2`          | Preparation failed because of the manifest, environment, ranges, paths, or invocation                                                        |

Match `answers[].questionId` to `questions[].id` and use `questions[].rule.id` to open the [rule guide](rules.md).
Inspect the actual source before changing it.
Do not infer a rationale that the model did not provide, average away a critical failure, or count missing coverage as a pass.
For `error` or `skipped`, resolve the execution problem instead of rewriting prose.
Keep earlier reports under ignored `tmp/` and choose a new path for each run.

## Validate implementation and use

```bash
nix develop --command vp test run plugins/totto2727-coding/skills/documentation-quality/scripts
nix develop --command vp check
git diff --check
```

Maintained tests verify local segmentation, engines, metadata, transport boundaries, aggregation, and failure behavior.
They do not prove standard coverage, inference availability, semantic accuracy, executable examples, or site rendering.
Apply the public CLI to actual project files and run the affected project's real content, build, and browser checks separately.
Report exactly which checks passed and which acceptance requirements remain blocked.
