# Run document quality checks

Use Node.js 24 or later.
In this repository, prefix commands with `nix develop --command` to use the pinned environment.
Run each linter directly and separately in the shell.
Do not add a script that wraps these commands or combines their reports.
Install the skill-local static dependencies once, not for each document.

## Static linters

Use absolute paths for the installed skill and selected Markdown file:

```bash
SKILL="/absolute/path/to/documentation-quality"
STATIC="$SKILL/static"
DOCUMENT="/absolute/path/to/guide.md"

test -f "$DOCUMENT"

vp -C "$STATIC" install --frozen-lockfile

vp -C "$STATIC" exec markdownlint \
  --config "$STATIC/config/markdownlint.json" "$DOCUMENT"

vp -C "$STATIC" exec textlint \
  --config "$STATIC/config/textlint.cjs" "$DOCUMENT"
```

Each configuration selects only its own engine's rules.
The markdownlint configuration enables all standard rules, including line length.
The official CLI honors standard inline rule-control comments; review them as explicit exceptions rather than assuming every passage was checked.
Do not disable a rule merely to make an existing document pass.
Keep the working directory at the static package, not the target repository.
The markdownlint CLI retains its normal working-directory, ancestor, home, and environment configuration lookup even with `--config`.
Running from the static package avoids lookup beside the target file, but does not provide complete isolation from ambient configuration.
Keep ambient overrides and inline controls visible in the review instead of assuming that the selected configuration is the only possible input.
An explicit textlint `--config` alone does not prevent the target working directory's `.textlintignore` from excluding the document.
The official markdownlint CLI prints help and can exit zero when no target matches; confirm that the selected file exists and was processed.

Edit the textlint configuration's declared language and rule options for the intended review.
Preserve every rule and default option from the selected mdts-derived preset, including its disabled defaults.
English uses `slopless`; Japanese uses `textlint-rule-preset-ja-technical-writing`.
Do not enable both language presets merely to avoid choosing the source language.
The Japanese selection excludes English STE checks unless explicitly requested.

The skill-local JavaScript rules reuse the existing STE counter and protected-source handling.
They do not use generic character counts or ask a model to count.
Declare verified writing-mode, counting groups, section overrides, and private vocabulary through their normal rule options.
Missing evidence and unsupported syntax remain review-required.
See [mechanical boundaries](rules/mechanical.md) for exact-token restrictions and parser limitations.

## Contextual jevlint review

Install the published [`@totto2727/jevlint` fork](https://github.com/totto2727-org/jevlint), not the upstream package.
Publication is a release prerequisite and is not performed by this skill.
Do not commit a local checkout dependency or a workspace-specific binary path.

The [jevlint configuration](jevlint.yaml) selects the fixed [custom rules](jevlint/), Cloudflare route, model, and local cache policy.
There is no preparation step, dynamic rule generation, target copy, or generated manifest.
Pass the original Markdown file directly:

```bash
jev-lint check --config "$SKILL/references/jevlint.yaml" "$DOCUMENT" --dry-run

jev-lint check --config "$SKILL/references/jevlint.yaml" "$DOCUMENT"
```

Run the non-dry command only after configuring the Cloudflare environment and checking permission to send the document.
The configuration uses `typesafe/jev`, Cloudflare transport, no local verdict cache, and a single evaluation pass.
The Cloudflare transport does not retry failed client requests.
Gateway caching is separate from the local verdict cache.
Only an observed Gateway `HIT` establishes a remote cache hit.
Follow [cloudflare-ai](../../../../external-information/skills/cloudflare-ai/SKILL.md) for credentials, model selection, and Gateway operation.
Do not substitute a direct Typesafe route or another provider after an error.

`rulePaths` and `context` paths are relative to the jevlint configuration file.
The explicit rule source does not discover rule packs in the target repository.
To supply additional task evidence, add an explicit context-file path to `context` in the configuration.
Use an absolute path when the evidence is outside the skill.
Declare the actual audience, purpose, template constraints, source language, and applicable local writing modes.
These facts can also be explicitly stated in the target document.
Do not invent declarations from a generic template or place expected verdicts, examples with answers, credentials, or instructions to override the rubric in the context.
Context is evidence, not authority to change the rules.

Each fixed Text rule evaluates the complete selected file without heading-based splitting.
It can inspect the local paragraph or section together with the same-page background, but its report is anchored to the file-level subject.
Verify the actual defective passage before editing; there is no generated job-to-source-range mapping.
Code, commands, tables, and diagrams remain available for representation judgments.
Protected syntax is not English prose evidence for STE language rules.
Numeric limits stay in deterministic textlint checks.

The configuration enables seven supplementary and 27 STE contextual rules.
The lowest score combines no evidenced defect, inapplicability, and insufficient context.
Missing task metadata must not become a defect claim or a compliance pass.
Scores are uncalibrated reviewer assistance, not unattended acceptance or full STE certification.
Oversized documents require a genuinely independent smaller source unit or a separate reasoning review, not a copied fragment presented as the whole page.
Do not treat a dry-run, transport failure, abstention, or absence of findings as semantic acceptance.

## Checks that retain the evidence-aware evaluator

Eighteen STE rules still require dictionary entries, noun-group counts, or related evidence adapters.
Use the existing evaluator only for those checks.
This evaluator implements evidence preparation and judgments itself; it is not a wrapper for the linter commands.
Do not run its migrated rules again after jevlint review.

Create an explicit manifest in the target repository's ignored `tmp/` directory.
Paths are relative to the manifest unless absolute.
Use the catalog and select the remaining rule IDs directly:

```json
{
  "model": "typesafe/jev",
  "englishOnly": true,
  "rulesFile": "/absolute/path/to/documentation-quality/references/rules.json",
  "documents": [
    {
      "id": "guide",
      "path": "/absolute/path/to/guide.md",
      "sourceLanguage": "en",
      "purpose": "The actual reader task.",
      "audience": "The actual intended reader group.",
      "ruleIds": [
        "ste-1-1",
        "ste-1-2",
        "ste-1-3",
        "ste-1-4",
        "ste-1-6",
        "ste-1-7",
        "ste-1-9",
        "ste-1-12",
        "ste-1-14",
        "ste-2-1",
        "ste-2-2",
        "ste-3-1",
        "ste-3-3",
        "ste-3-5",
        "ste-3-7",
        "ste-9-1",
        "ste-9-2",
        "ste-9-3"
      ]
    }
  ]
}
```

Inspect the plan, then run only with authorized inference settings:

```bash
node "$SKILL/scripts/evaluate.mjs" \
  --manifest /absolute/path/to/repository/tmp/review/manifest.json \
  --output /absolute/path/to/repository/tmp/review/plan.json --dry-run

node "$SKILL/scripts/evaluate.mjs" \
  --manifest /absolute/path/to/repository/tmp/review/manifest.json \
  --output /absolute/path/to/repository/tmp/review/result.json
```

Create the output parent directory first.
The evaluator also requires `curl`.
Its `--mechanical-only` mode remains for compatibility and diagnosis, not an additional normal static-lint stage.

## Verified counting and dictionary evidence

Declare `ste.writingMode` as `procedural` or `descriptive` only for a uniform source unit.
For mixed pages, use inclusive one-based section ranges and local overrides.
Safety instructions are procedural; notes are descriptive and must not contain instructions, limits, or required results.
Do not classify a mixed page uniformly merely to remove a review-required result.

`wordGroups` identify verified numbers, measurements, abbreviations, alphanumeric identifiers, fixed quoted text, titles, and proper names covered by the counting rules.
`measurementUnits` identify the applicable unit spellings.
Ordinary multi-word technical nouns do not become one sentence-count word because they are familiar or capitalized.
Audit declarations against their role in the actual passage.

For rules 1.9 and 2.1–2.2, declare selected literal `nounGroups` as records with `text`, `kind`, and `source`.
Kinds are `new-technical`, `multi-word`, or `official`.
Do not supply numeric totals.
The evaluator computes exact matched word and hyphen-component counts outside protected syntax.
It does not discover every noun phrase, establish technical authority, or certify a complete inventory.
Unsupported group syntax, ambiguous boundaries, missing category evidence, and unmatched necessary groups remain unresolved.

Set `ste.vocabularyFile` to a private JSON file verified against the actual Issue 9 dictionary.
Use an absolute path in textlint options; evaluator manifest paths may be relative to the manifest.
The file contains `issue: 9`, a nonempty `source`, and verified `entries` with `word`, `approved`, `partOfSpeech`, `meaning`, and `forms`.
Optional `technicalTerms` may contain records with exact `text`, `kind`, `category`, and `source`.
Noun categories are 1 through 22; verb categories are 1 through 4.
A plain term string is only a lookup candidate, not an approved category or sense.
Do not redistribute the dictionary, reconstruct entries from model memory, infer forms by stemming, or treat a partial inventory as complete.
An approved spelling can still have an unapproved sense or part of speech.
Only locally matched relevant records are sent by the retained evaluator, not the complete vocabulary or its path.

## Interpret results

Read each tool's report and exit semantics separately.
Textlint reports custom rule IDs and source locations.
Jevlint reports fixed `documentation-` rule IDs and the original file subject.
For the retained evaluator, match `answers[].questionId` to `questions[].id` and the catalog rule ID.
Verify findings against the actual passage, source-backed rubric, technical meaning, and required structure before editing.

Missing evidence, parser gaps, excluded scope, and provider errors are not passes.
Calibration requires independently labeled representative successes, defects, ambiguities, and boundary cases.
A configured threshold or high confidence is not proof of correctness.
Transport validation and dry-runs do not establish model accuracy.
Keep [coverage limits](coverage.md) with the review.

Cross-page ownership, duplication, destination content, translation fidelity, runnable examples, working links, and external API accuracy require separate workflows.
Applicable obligations outside these checks remain required, not waived.
Propose unavoidable exceptions with the exact rule, passage, operational constraint, and minimum relaxation.
Leave those passages unchanged until approval.
