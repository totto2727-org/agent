# Rule index

Apply every applicable verified rule to English source content within its required structure.
These checks operate on one page or a unit within that page.
Read the [coverage record](coverage.md) before making a compliance claim.

## Mechanical checks

| Rule                                           | Scope                       | Property                                              |
| ---------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| [code-fence-language](rules/mechanical.md)     | Page                        | Each fenced code block declares a language            |
| [Custom prohibited terms](rules/mechanical.md) | Page, section, or paragraph | Exact project-defined tokens outside protected syntax |

The second check is available for explicit project restrictions and is not enabled by the bundled catalog.
Neither check needs a model or credentials.
Neither establishes code correctness, rendering support, or the full STE dictionary.

## Published STE guidance

These IDs identify FAQ-derived checks, not numbered rules of the complete standard.
Their executable source metadata preserves that distinction.

| Rule                              | Scope     | Follow-up                                                                                 |
| --------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `ste-faq-procedural-instructions` | Paragraph | [Direct procedural instructions](rules/ste-faq.md#direct-procedural-instructions)         |
| `ste-faq-active-description`      | Paragraph | [Active descriptions](rules/ste-faq.md#active-descriptions)                               |
| `ste-faq-condition-first`         | Paragraph | [Necessary conditions before action](rules/ste-faq.md#necessary-conditions-before-action) |
| `ste-faq-one-topic`               | Paragraph | [One topic per sentence](rules/ste-faq.md#one-topic-per-sentence)                         |

## Supplementary principles

These checks address documentation needs not settled by the language guidance.
Do not introduce overlapping language requirements through them.

| Rule                                                | Scope   | Evidence needed                                                  |
| --------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| [consumer-contract](rules/consumer-contract.md)     | Section | Reader purpose and relevance of current guidance or history      |
| [audience-boundary](rules/audience-boundary.md)     | Section | Intended reader group and indispensable task knowledge           |
| [actionable-example](rules/actionable-example.md)   | Section | Necessary representation, inputs, actions, and interpretation    |
| [consequential-limit](rules/consequential-limit.md) | Section | Locally stated applicability, consequence, and known next action |
| [focused-unit](rules/focused-unit.md)               | Section | A coherent reader question within the required structure         |
| [reader-route](rules/reader-route.md)               | Page    | Prerequisites, steps, and onward descriptions on this page only  |
| [visual-role](rules/visual-role.md)                 | Section | Consequential content roles and allowed presentation forms       |

## Resolve a finding

Match `answers[].questionId` to `questions[].id`, then select the guide by `questions[].rule.id`.
Mechanical evidence gives the checked source location; semantic answers are typed judgments, not verified rationales.
Compare every proposed correction with the actual passage, required structure, public contract, and verified rule source.
Examples explain applicability but do not establish model accuracy or prescribe mandatory wording.

Keep defects, `not_applicable`, `insufficient_context`, deferred checks, uncalibrated passes, exclusions, and request errors separate.
Missing evidence requires evidence, not an invented correction.
Record unavoidable exception candidates with the precise rule, passage, operational reason, and smallest relaxation, and leave them unchanged pending approval.

## Excluded script scope

Do not automate cross-page duplication, canonical ownership, destination content, translation fidelity, working links, external API accuracy, or executable behavior through this evaluator.
These require separate source, renderer, runtime, or document-set checks.
A local rule cannot pass or fail unseen material merely because its page contains a link.

The executable catalog is [rules.json](rules.json).
The [execution guide](running.md#read-the-report) describes manifest boundaries, engines, calibration, and failures.
