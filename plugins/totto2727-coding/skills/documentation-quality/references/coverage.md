# Coverage and source authority

ASD-STE100 is the strict default for English prose.
Implementation coverage is a separate fact: the current catalog is incomplete and must not be described as an STE compliance checker.

## Official sources

- [ASD-STE100 overview](https://www.asd-ste100.org/about_STE.html) identifies Issue 9, the writing rules, and the controlled dictionary.
- [Official FAQ](https://www.asd-ste100.org/STE_faq.html) supplies public guidance on procedural instructions, descriptive voice, pre-action conditions, and one topic per sentence.
- [Official download page](https://www.asd-ste100.org/STE_downloads.html) supplies the procedure for requesting the standard.

The complete Issue 9 rules and dictionary were not available when this catalog was prepared.
The FAQ is explanatory guidance, not a substitute for the full standard or its exceptions.
Its references in the catalog do not establish normative rule numbers.

## Implemented coverage

| Source                        | Implemented checks                                                                                              | Boundary                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Official FAQ                  | `ste-faq-procedural-instructions`, `ste-faq-active-description`, `ste-faq-condition-first`, `ste-faq-one-topic` | Contextual checks of the published guidance only                                                |
| Supplementary principles      | Audience, current guidance, representations, limitations, local navigation, focused content, visual roles       | Project documentation needs, not additional STE rules                                           |
| Project Markdown convention   | `code-fence-language`                                                                                           | Deterministic presence of a fenced-code language, not correctness of that language or execution |
| Explicit project restrictions | Optional `prohibited-terms` mechanical check                                                                    | Exact configured tokens only, not the STE controlled dictionary                                 |

## Unimplemented standard coverage

The complete writing-rule catalog, approved dictionary, technical-name allowances, exact counting rules, and all normative exceptions remain unverified.
Do not infer numeric sentence or paragraph limits from secondary summaries.
Do not label a word prohibited without the applicable dictionary entry, permitted meaning, part of speech, and relevant technical-name rule.
A regex can identify an exact configured token but cannot establish its contextual STE meaning.

When the complete source is available, map each verified rule to its source, applicability, local review scope, engine, and exclusions.
Implement decidable properties mechanically before introducing a model judgment.
Keep cross-page and document-set rules outside the evaluator; record them for separate review rather than pretending that local evidence is enough.
Separate implementation gaps from operational exception proposals.
An unavailable source is a coverage gap, not permission to relax the standard.

## Acceptance claims

A mechanical pass proves only the configured mechanical property of the selected source.
A semantic judgment requires contextual verification and task-specific calibration before an automated acceptance claim.
A site build and browser test prove the exercised rendering and navigation behavior, not STE coverage.
Report these observations separately, including omitted rules, excluded translations, missing evidence, and unchanged exception candidates.
