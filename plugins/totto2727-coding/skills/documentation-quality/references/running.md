# Running document evaluations

Use Node.js 24 or later for the complete workflow.
In this repository, prefix commands with `nix develop --command` to use the pinned environment.
Mechanical checks need no model, credentials, or network.
Semantic checks additionally require `curl` and the configured Cloudflare environment.

## Run the independent linters

Run markdownlint, textlint, and jevlint as separate tools.
There is no combined lint command, normalized report, or target-repository rule discovery.
Use an absolute path to the installed skill and the target document:

```bash
SKILL="/absolute/path/to/documentation-quality"
STATIC="$SKILL/static"
DOCUMENT="/absolute/path/to/guide.md"

vp -C "$STATIC" install --frozen-lockfile
vp -C "$STATIC" run markdownlint "$DOCUMENT"
vp -C "$STATIC" exec textlint \
  --config "$STATIC/config/textlint-en.cjs" "$DOCUMENT"
```

Install dependencies once, not for each document.
The markdownlint-only task calls the public library API with all standard rules enabled, including line length.
It does not invoke textlint or jevlint, or load target-repository configuration.
Inline markdownlint-disable comments do not suppress this all-rules review.
The task runner can prefix its own execution log; for a machine-readable markdownlint report, call the same entry point directly with `node "$STATIC/markdownlint.mjs" "$DOCUMENT"`.
Do not disable a rule to reconcile an existing document with the default configuration without an explicit policy decision.
The English textlint configuration preserves every rule and default option from mdts's `slopless` preset, including disabled defaults, and adds the skill-local deterministic rules.
For Japanese, use `textlint-ja.cjs`, which preserves mdts's `textlint-rule-preset-ja-technical-writing` preset and its default options.
Every rule enabled by mdts remains enabled; do not turn a preset's disabled default into a new requirement merely because it is listed in the package.
The Japanese configuration excludes English STE rules at the language boundary, not the mdts Japanese preset rules.
Neither configuration establishes translation fidelity.

The local textlint rules call the existing STE counter and source-exclusion implementation internally.
The normal static workflow does not require a separate invocation of the old mechanical evaluator.
Missing writing-mode, dictionary, or other required evidence remains review-required.
For evidence-aware English checks, create an explicit CommonJS textlint configuration under the target repository's ignored `tmp/` directory:

```javascript
const createTextlintConfig = require("/absolute/path/to/documentation-quality/static/config/textlint.cjs");

module.exports = createTextlintConfig({
  language: "en",
  ste: {
    writingMode: "descriptive",
    vocabularyFile: "/absolute/path/to/private/verified-vocabulary.json",
    wordGroups: [],
    measurementUnits: [],
    nounGroups: [],
  },
  sections: [],
});
```

Use the same verified counting and vocabulary evidence described below.
Do not declare a mixed page uniformly descriptive to remove an unresolved-context result.
Pass this configuration through `vp -C "$STATIC" exec textlint --config /absolute/path/to/repository/tmp/textlint.cjs "$DOCUMENT"`; do not install it as a repository-wide policy.
Keep the working directory at the installed static package so the target repository's `.textlintignore` cannot silently exclude the selected document.
An explicit `--config` alone does not isolate the raw textlint CLI's ignore-file search.

## Prepare and run custom jevlint review

The distributable workflow requires the published [`@totto2727/jevlint` fork](https://github.com/totto2727-org/jevlint).
It is not the upstream `jev-lint` package.
Package publication is a release prerequisite, not an action performed by this skill.
Do not commit a local checkout dependency or a workspace-specific binary path as a substitute for publication.

Prepare a bounded review job from the manifest described below, then call the installed fork's binary directly:
Create the output directory's parent first and choose a new job directory.
Preparation refuses an existing job directory so stale targets cannot expand the next review.

```bash
node "$SKILL/scripts/evaluate.mjs" \
  --manifest /absolute/path/to/manifest.json \
  --export-jevlint --output /absolute/path/to/repository/tmp/jev-review

jev-lint check \
  --config /absolute/path/to/repository/tmp/jev-review/config.yaml \
  --rules /absolute/path/to/repository/tmp/jev-review/rules \
  /absolute/path/to/repository/tmp/jev-review/targets \
  --dry-run --cache none
```

Input preparation does not invoke a model or either static linter.
The job preserves the bounded target, same-page context, task metadata, and original source ranges.
Inspect the prepared data before sending private content to the selected Cloudflare route.
Remove `--dry-run` for contextual review after configuring the Gateway.
Use only the explicit custom rules, not an upstream rule pack or rules discovered in the target repository.

The jevlint migration covers seven supplementary rules and 27 local STE contextual rules.
The 18 remaining STE contextual rules require dictionary, noun-group, or related evidence adapters and retain the evidence-aware evaluator.
Inspect `export.json` for migrated, retained, and skipped checks and their evidence boundaries.
If it names `legacyManifestPath`, run the retained evaluator against that generated manifest to avoid repeating migrated rules:

```bash
node "$SKILL/scripts/evaluate.mjs" \
  --manifest /absolute/path/to/repository/tmp/jev-review/legacy-manifest.json \
  --output /absolute/path/to/repository/tmp/retained-review.json
```

Uncalibrated contextual findings assist review and do not establish unattended acceptance or full STE compliance.
Read each tool's own report and exit semantics separately.
Transport errors, abstentions, and missing evidence are not clean verdicts.

## Prepare a manifest

Paths are relative to the manifest file unless absolute.
Use exactly one of `rulesFile` or inline `rules`.
Keep the [coverage record](coverage.md) with the report: the catalog maps the numbered Issue 9 rules, but bounded checks and missing evidence do not establish full compliance.

```json
{
  "model": "typesafe/jev",
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
      "ruleIds": ["code-fence-language", "audience-boundary", "ste-5-3"]
    }
  ]
}
```

This example assumes a manifest in `<repository>/tmp/review/`.
Adjust paths for the installed skill and target repository.
Use `typesafe/jev` as the default semantic-review model.
Keep the explicit model field in the manifest so the selected model is recorded.
Follow cloudflare-ai for model overrides and execution.
This default is an operational policy, not proof of superior accuracy or lower cost.
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
Unsupported container fences and ambiguous list-continuation syntax produce parser warnings and `insufficient_context`, not a partial-scan pass.

A contextual rule uses `engine: "decision"` and supplies `instructions`, `pass`, and `fail`.
Legacy contextual definitions without `engine` default to `decision`.
Keep questions local and typed.
Do not ask the model to execute commands, verify another page, count a mechanically decidable property, or generate a correction as an authoritative result.

## Declare STE counting context

Declare the local writing mode before running mode-dependent counts.
Use `document.ste.writingMode` for a uniform source unit and `document.sections[].ste.writingMode` for a selected unit with a different mode.
Supported modes are `procedural` and `descriptive`.
Classify a safety instruction locally as `procedural`, even within a descriptive page.
Do not give a mixed page a uniform mode just to avoid a missing-context result.
A procedural note is descriptive, but a note must not contain an instruction, limit, or required result.
A safety instruction retains the procedural sentence limit even within a descriptive page.

```json
{
  "ste": {
    "writingMode": "descriptive",
    "wordGroups": [
      { "text": "OpenJS Foundation", "category": "proper-noun" },
      { "text": "Documentation Quality", "category": "title" }
    ],
    "measurementUnits": ["milliseconds"]
  }
}
```

Verify each declared group against the passage and the applicable counting rule.
Use `wordGroups` only for actual numbers, measurements, abbreviations, alphanumeric identifiers, quoted material or formulas, fixed titles, and proper nouns covered by Issue 9.
Do not declare an ordinary technical multi-word noun as a single word merely because it is a familiar term.
Typography or capitalization alone does not establish a quoted label or a proper noun.
Group declarations are reviewer-supplied evidence, not automatically verified facts or exceptions.
The counter must preserve ambiguity and unsupported source syntax as review-required instead of reporting a partial-scan pass.

## Declare noun-group evidence

Rules `ste-1-9`, `ste-2-1`, and `ste-2-2` declare `requiresNounGroupCounts: true`.
Their numeric criteria use engine-computed evidence, not a model count or a caller-supplied total.
Declare selected literal noun groups in `document.ste.nounGroups` or the selected `document.sections[].ste.nounGroups` override:

```json
{
  "ste": {
    "nounGroups": [
      {
        "text": "filter-housing support bracket",
        "kind": "multi-word",
        "source": "Illustrative local terminology record. Verify its role and relationships before use."
      }
    ]
  }
}
```

This example demonstrates the input shape, not verified terminology or permission to add a hyphen.
Each record contains only `text`, `kind`, and `source`.
Supported kinds are `new-technical`, `multi-word`, and `official`.
`text` and `source` are nonempty literal strings of at most 512 characters, with no leading or trailing whitespace or control characters.
At most 1000 records are accepted, and extra properties, including submitted numeric counts, are rejected.
Section overrides replace the corresponding document-level noun-group array rather than merging it.

The engine selects exact case-sensitive matches with token boundaries wholly inside the target range and outside protected source regions.
It computes `wordCount` and `hyphenComponentCounts`, with a genuine hyphenated token counted as one word and its underlying component count retained.
For the example literal, the numeric result is three tokens and component counts `[2, 1, 1]`.
The current noun-group counter accepts ASCII alphabetic words separated by single spaces, with single word-internal hyphens.
Other group syntax or a match overlapping an uncertain parse remains `insufficient_context`, not a guessed count.
The request receives only matched `nounGroupCounts` records in its local target evidence, or page evidence for a page-scoped check, with status and source ranges.
With no decidable local noun-group match, these questions defer without an inference request.
An attempted model pass is guarded when the supplied matched group evidence is incomplete or unsupported.

`nounGroups` identify selected groups for noun-specific limits under 1.9 and section 2.
They do not collapse ordinary technical nouns into one sentence-count word under 8.6.
Sentence token grouping uses the separate audited `wordGroups` counting context above.
The engine proves only the computed numbers for the selected literal matches.
It does not discover all noun phrases, verify the declared role or official status, approve new hyphen relationships, or certify an exhaustive noun-group inventory.
Reviewers must establish the actual head noun, modifiers, term authority, category, and applicable exceptions from local evidence.
An undeclared necessary group, an ambiguous boundary, or missing authority remains unresolved even if other supplied groups were counted successfully.
Do not use selective declarations to suppress a violation or claim complete 1.9/2.1/2.2 compliance.

## Supply private dictionary evidence

Set `document.ste.vocabularyFile` to a private JSON file whose path is relative to the manifest.
Use only entries verified against the actual Issue 9 dictionary, with the entry's permitted meaning, part of speech, and listed forms.
Do not distribute the PDF or a copied dictionary with the skill.

```json
{
  "issue": 9,
  "source": "ASD-STE100 Issue 9, Part 2; independently verified local entries",
  "entries": [
    {
      "word": "<verified entry>",
      "approved": true,
      "partOfSpeech": "n",
      "meaning": "<verified meaning>",
      "forms": ["<verified permitted form>"]
    }
  ],
  "technicalTerms": ["<locally verified technical noun or verb>"]
}
```

This is an input shape, not usable dictionary data.
Exact lookup produces lexical candidates for contextual review.
It does not establish permitted use in that sentence.
An approved spelling can still have an unapproved meaning or part of speech.
A term absent from a partial inventory is not automatically prohibited, and a listed unapproved term may qualify as a technical noun or verb only in a permitted context.
Do not infer forms by stemming or call a partial PDF extraction a complete dictionary.
Treat declared technical terms as claims that require their category and local meaning to be verified, not a blanket whitelist.
A literal `technicalTerms` string is only a lookup candidate.
For source-declared evidence, use `{ "text": "<exact term>", "kind": "noun", "category": 19, "source": "<verified category and local meaning>" }`.
The noun category must be 1 through 22, and the verb category must be 1 through 4.
The engine sends only exact locally matched entries and technical-term records to the contextual request.
It does not send the private file path, unmatched entries, or the complete vocabulary.
Dictionary-dependent rules declare `requiresDictionaryEntries: true`.
With no matched source evidence, these questions are deferred without a model request.
An attempted model pass remains insufficient when local coverage is incomplete.
Record the evidence guard separately from the provider's original answer, not as a new high-confidence model judgment.
Keep unresolved evidence visible and use only the relevant verified entries in a contextual review, not the entire dictionary as model state.

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
When paragraph rules are selected, a range that cuts a natural paragraph is rejected before inference rather than silently dropping part of the selection.
Page rules still inspect the complete page.
The request supplies the target unit and same-page context, not evidence from another document.
Nonempty legacy `context` is rejected.
Move task metadata to `purpose`, `audience`, and `templateConstraints`, and keep external evidence in a separate review instead of the local request.
Large evidence is rejected rather than silently truncated.
A byte guard is not a tokenizer or proof that the provider's token limit will be met.
For oversized pages, use a reasoning reviewer or a genuinely independent smaller source unit rather than a copied fragment presented as a complete page.

## Retained evaluator and compatibility commands

Use the evidence-aware evaluator for contextual checks that have not migrated to jevlint.
Limit its manifest to those rules instead of repeating the migrated supplementary checks.
The mechanical-only command remains available for compatibility and diagnosis, not as an additional normal static-lint stage.

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

Dry runs plan work.
They do not establish acceptance.
Mechanical-only runs execute mechanical rules and retain semantic checks as deferred, `insufficient_context`, and review-required.
A mixed catalog cannot receive overall semantic acceptance from this mode.

## Configure semantic inference

Use [decision-model](../../../../external-information/skills/decision-model/SKILL.md) for judgment design and task-specific calibration.
Use [cloudflare-ai](../../../../external-information/skills/cloudflare-ai/SKILL.md) for current model selection, credentials, account and Gateway configuration, and billing rules.
Set `manifest.model` only for the selected supported Decision Model.
The evaluator uses Cloudflare's documented native or universal Decision Model route.
Even when a model identifier names another provider, do not operate that provider directly or add a provider-direct fallback.
Question and answer collections are keyed objects.
The report records the returned concrete model.
Keep that model stable when comparing rubric changes.

Do not copy a universal confidence threshold from an example.
Calibrate `manifest.threshold` against independently labeled representative success, failure, ambiguity, and boundary cases for the intended task and model.
Without a threshold, semantic judgments remain `uncalibrated` and require review even when the selected answer is `pass`.
A configured number alone does not establish calibration quality.

Inspect the dry-run ranges, rules, exclusions, and requests before sending private content.
Confirm that the configured Gateway and model provider may receive the selected contents.
Remove `--dry-run`, choose a new report path, and use bounded concurrency.
The default is 4.
Do not exceed account or model limits.

Every inference request includes the Gateway cache key, TTL, and skip-cache headers described by cloudflare-ai.
Equivalent work in a run shares one operation.
Only an observed Gateway `HIT` proves a remote cache hit.
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
nix develop --command vp run test:documentation-quality
nix develop --command vp run test:documentation-quality-static
nix develop --command vp check
git diff --check
```

Maintained tests verify local segmentation, engines, metadata, transport boundaries, aggregation, and failure behavior.
After the fork package is installed, set `JEVLINT_CLI` to its installed JavaScript CLI entry point to enable the explicit cross-package dry-run test.
They do not prove standard coverage, inference availability, semantic accuracy, executable examples, or site rendering.
Apply the public CLI to actual project files and run the affected project's real content, build, and browser checks separately.
Report exactly which checks passed and which acceptance requirements remain blocked.
