# Rule index

Apply all applicable Issue 9 rules to English prose within its required structure.
The [coverage record](coverage.md) distinguishes complete source mapping from bounded automated verification.
The [Issue 9 operational map](rules/ste-issue9.md) gives original rubrics, printed and PDF page references, allowances, and missing-evidence handling for every numbered rule.

## Mechanical checks

Use the skill-local textlint preset for these deterministic checks and markdownlint separately for standard Markdown rules.
The existing counter and source exclusions run inside the textlint rules.

| Executable ID                                  | Scope                       | Decidable property                                                   |
| ---------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `ste-5-1`                                      | Paragraph                   | Procedural 20-word sentence limit, including safety instructions     |
| `ste-6-3`                                      | Paragraph                   | Descriptive 25-word sentence limit, including procedural notes       |
| `ste-6-6`                                      | Paragraph                   | Descriptive paragraph maximum of six actual sentences                |
| `ste-8-1`                                      | Page                        | No semicolon in prose                                                |
| `ste-dictionary-candidates`                    | Page                        | Private local vocabulary candidate lookup, never contextual approval |
| [code-fence-language](rules/mechanical.md)     | Page                        | Each fenced code block declares a language                           |
| [Custom prohibited terms](rules/mechanical.md) | Page, section, or paragraph | Exact configured project tokens, not the STE dictionary              |

The four counting methods 8.4 through 8.7 are included in both sentence-length checks through `source.requiredRules`.
They are not separate model questions or duplicate mechanical runs.
Use explicit local writing mode, audited literal count groups, and private entry evidence as defined in [running evaluations](running.md).
Unknown mode, unsupported syntax, uncertain boundaries, and missing contextual evidence remain unresolved.
Do not use a naive regex, arbitrary count-group declaration, or token whitelist to establish STE approval.

## Source-backed contextual checks

IDs use `ste-<section>-<rule>` and their `source.rule` preserves the actual dotted standard number.
These 45 contextual entries and four numbered mechanical entries map the 49 independently executed numbered checks.
Counting dependencies supply the remaining four numbered mappings, for a verified total of 53.

| Numbered rules      | Scope     | Original guide                                                                |
| ------------------- | --------- | ----------------------------------------------------------------------------- |
| 1.1–1.10, 1.12–1.14 | Paragraph | [Vocabulary, technical terms, and spelling](rules/ste-issue9.md#section-1)    |
| 1.11                | Page      | [Same-item naming](rules/ste-issue9.md#section-1)                             |
| 2.1                 | Paragraph | [Noun groups](rules/ste-issue9.md#section-2)                                  |
| 2.2                 | Page      | [Official long terms and visible reuse](rules/ste-issue9.md#section-2)        |
| 3.1–3.7             | Paragraph | [Verb forms, role, and voice](rules/ste-issue9.md#section-3)                  |
| 4.1, 4.2, 4.5       | Paragraph | [Clear complete sentences and determiners](rules/ste-issue9.md#section-4)     |
| 4.3–4.4             | Section   | [Complete lists and local connections](rules/ste-issue9.md#section-4)         |
| 5.2, 5.5            | Section   | [Action grouping and informational notes](rules/ste-issue9.md#section-5)      |
| 5.3–5.4             | Paragraph | [Commands and necessary pre-action conditions](rules/ste-issue9.md#section-5) |
| 6.1–6.2, 6.4        | Section   | [Gradual descriptive structure](rules/ste-issue9.md#section-6)                |
| 6.5                 | Paragraph | [One descriptive paragraph topic](rules/ste-issue9.md#section-6)              |
| 7.1–7.3             | Section   | [Whole safety instructions](rules/ste-issue9.md#section-7)                    |
| 8.2–8.3             | Paragraph | [Hyphen relations and parenthetical roles](rules/ste-issue9.md#section-8)     |
| 9.1                 | Section   | [Meaning-preserving reconstruction](rules/ste-issue9.md#section-9)            |
| 9.2–9.3             | Paragraph | [Contextual approved senses and phrases](rules/ste-issue9.md#section-9)       |
| 9.4                 | Page      | [Consistent equivalent-operation wording](rules/ste-issue9.md#section-9)      |

Dictionary lookup and numeric noun-group counts are deterministic prerequisites, not semantic work.
Dictionary-dependent questions require actual matched private entries and must not infer approvals from memory.
Missing noun-group boundaries or verified counts leave the numeric portions of 1.9 and 2.1–2.2 unavailable.

The [eight general recommendations](rules/ste-issue9.md#general-recommendations) remain editorial aids, separate from numbered rules.
The [former FAQ-only checks](rules/ste-faq.md) are superseded by the corresponding full-source definitions and must not run as duplicate checks.

## Supplementary principles

These checks cover documentation needs not settled by the language standard.
Do not restate them as STE requirements or duplicate language checks through them.
Use their [fixed custom jevlint rubrics](jevlint/) through the [configuration](jevlint.yaml) and direct commands in [running evaluations](running.md).
The same directory contains 27 fixed local STE contextual checks with the catalog's original instructions.
The remaining 18 dictionary-, noun-group-, or related-evidence-dependent checks use the evidence-aware evaluator.

| Rule                                                | Scope   | Evidence needed                                               |
| --------------------------------------------------- | ------- | ------------------------------------------------------------- |
| [consumer-contract](rules/consumer-contract.md)     | Section | Reader purpose and relevance of current guidance or history   |
| [audience-boundary](rules/audience-boundary.md)     | Section | Intended group and indispensable task knowledge               |
| [actionable-example](rules/actionable-example.md)   | Section | Necessary representation, inputs, actions, and interpretation |
| [consequential-limit](rules/consequential-limit.md) | Section | Local applicability, consequence, and known next action       |
| [focused-unit](rules/focused-unit.md)               | Section | A coherent reader question within the imposed structure       |
| [reader-route](rules/reader-route.md)               | Page    | Prerequisites, steps, and onward descriptions on this page    |
| [visual-role](rules/visual-role.md)                 | Section | Meaningful content roles and permitted presentation           |

## Resolve a finding

For the retained evaluator, match `answers[].questionId` to `questions[].id`, then resolve `questions[].rule.id` against the catalog.
For textlint, use the reported custom rule ID and source location.
For jevlint, remove the `documentation-` prefix to find the catalog rule and inspect the reported original file.
The whole-file subject does not identify a precise defective paragraph or section; verify that passage before editing.
Mechanical evidence identifies the checked source range.
A typed semantic answer is not a verified rationale or complete compliance finding.
Compare the actual passage, technical meaning, template constraints, public contract, and source-backed rubric before editing.

Keep defects, justified `not_applicable`, `insufficient_context`, parser gaps, excluded scope, uncalibrated results, and request errors distinct.
A missing fact requires evidence, not an invented correction.
An unavoidable operational constraint beyond a verified allowance is only an exception proposal, with the exact passage, affected rule, reason, and minimum relaxation.
Leave such passages unchanged pending approval.

## Excluded script scope

Do not infer cross-page naming/style consistency, document-wide first introductions, external terminology authority, risk analysis, or rewrite effects from one page.
Those applicable standard obligations remain required for separate review, not marked passed or waived.
Do not automate cross-page duplication, ownership, destination content, translation fidelity, link execution, external API accuracy, or runnable behavior through this evaluator.
Use separate source, document-set, renderer, or runtime workflows.

The executable catalog is [rules.json](rules.json).
Read the [execution guide](running.md#interpret-results) for request boundaries, engines, calibration, and report handling.
