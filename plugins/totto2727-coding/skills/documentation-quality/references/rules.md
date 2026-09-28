# Rule index

Select a rule by the reader's task and the evidence available.
Open its guide only when needed to interpret a finding or resolve uncertainty; do not load every example for a normal review.
These checks cover selected [documentation principles](../../documentation-principles/SKILL.md), not every aspect of documentation quality.

| Rule and follow-up guide                            | Scope                          | Evidence needed                                                |
| --------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| [consumer-contract](rules/consumer-contract.md)     | Section                        | Reader task, audience, public behavior, surrounding page       |
| [actionable-example](rules/actionable-example.md)   | Section                        | Operation being taught and any earlier example it relies on    |
| [consequential-limit](rules/consequential-limit.md) | Section                        | Affected behavior, observable consequence, known remedy        |
| [focused-unit](rules/focused-unit.md)               | Section                        | The unit's question and neighboring explanation                |
| [reader-route](rules/reader-route.md)               | Page                           | Complete page, default path, relevant destination excerpts     |
| [canonical-home](rules/canonical-home.md)           | Page with document-set context | Actual entry points, linked guides, and overlapping procedures |

## Resolve a finding

Match the report's `answers[].questionId` to `questions[].id` in the same evaluation, then use `questions[].rule.id` to select the guide above.
Each guide contains a contextual anti-pattern, an improved sample, and exceptions to check before editing.
For a custom rule not listed here, use that rule's supplied definition and review evidence rather than guessing a bundled equivalent.
If the problem is missing context, obtain that context rather than copying an example into the document.

## Jev boundaries

The executable definitions live in [rules.json](rules.json); the linked Markdown examples are for follow-up review, not automatic model input.
Keep `fail`, low confidence, `not_applicable`, `insufficient_context`, and infrastructure errors distinct from a positive pass.
The [execution guide](running.md#read-the-report) explains report fields and errors.

The rubric is advisory: a high-confidence judgment can still be wrong.
Examples explain the intended decision but do not establish model accuracy.
