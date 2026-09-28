# Rule catalog

The executable definitions live in [rules.json](rules.json).
They operationalize [documentation-principles](../../documentation-principles/SKILL.md), not universal bans on technical detail or short text.
Select rules by document purpose and available evidence.

| Rule                  | Scope                          | Evidence needed                                                      | Historical revision family                                                                                             |
| --------------------- | ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `consumer-contract`   | Section                        | Reader task, audience, public behavior, surrounding page             | Consumer rendering guidance in PR #17; removal of internal fixture introductions in PR #15                             |
| `actionable-example`  | Section                        | Operation being taught and any earlier example it relies on          | Rendering and customization examples added in the final PR #17 revision                                                |
| `consequential-limit` | Section                        | Affected behavior, consequence, known remedy                         | PR #17's implementation-oriented rendering note replaced with a consumer warning                                       |
| `focused-unit`        | Section                        | The unit's question and neighboring explanation                      | PR #15's removed repeated introductions and unrelated binding instructions; PR #17's removed redundant component prose |
| `reader-route`        | Page                           | Complete page, supported default path, relevant destination excerpts | PR #15's generated project route, platform overview link, and host-local prerequisites                                 |
| `canonical-home`      | Page with document-set context | The actual entrypoints, linked guides, and overlapping procedures    | PR #17's package README and duplicate guide consolidation into the bilingual documentation site                        |

Each rule produces a separate Choice answer.
The runner adds `not_applicable` for a genuinely irrelevant rule and `insufficient_context` for missing evidence.
Neither means the rule has positively passed.
The initial confidence threshold is a review policy, not a statistically validated accuracy guarantee.

The initial `jev-1.13.0` validation detected some historical regressions but also accepted some corrected-away passages with high confidence.
Treat the bundled rubric as advisory and preserve human or reasoning-model review for acceptance decisions.
The paired corpus exercises four section rules; `reader-route` and `canonical-home` are not calibrated by those pairs.
Running page rules successfully verifies the evaluation path, not their classification accuracy.

## What these checks do not prove

- A stylistically clear API call may still be incorrect or no longer supported.
- A link label cannot prove the destination contains a prerequisite.
- A one-page judgment cannot establish cross-page duplication without the relevant pages.
- Matching English and Japanese formatting does not establish translation equivalence.
- An accepted historical short section is a positive control, not a minimum or maximum length template.

Use source checks, link validation, executable reader tasks, and translation review for those contracts.
For document-set questions, include the relevant excerpts as manifest context rather than allowing the evaluator to browse or invent missing evidence.

## Review a disagreement

Inspect the selected source range with its full page before changing text.
Classify the disagreement as a real regression, missing context, an inapplicable rule, an overbroad criterion, or model error.
Adjust the rule only against the calibration set, then run an untouched revision-family holdout.
Keep the original expected labels and record disagreements instead of replacing the reviewed target with the model's preference.
