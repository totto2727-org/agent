# Coverage and source authority

ASD-STE100 Issue 9 is the strict default for applicable English prose.
Apply all applicable requirements within the required structure.
Complete source mapping is not the same as complete automated compliance verification.

## Source authority

The user supplied the complete ASD-STE100 Issue 9 PDF, dated 2025-01-15.
All Part 1 numbered rules, explanations, allowances, and general recommendations were read directly.
The verified inventory is **53 numbered rules**, with section counts **14, 2, 7, 5, 5, 6, 3, 7, 4**.
The [original operational map](rules/ste-issue9.md) gives each rule's printed page, physical PDF page, rubric, scope, and evidence boundary.
The eight general recommendations are mapped separately because the standard explicitly distinguishes them from its rules.
The guide does not distribute the source PDF, dictionary, verbatim examples, or a substitute full-text standard.

Official source access remains available through the [overview](https://www.asd-ste100.org/about_STE.html), [request/download page](https://www.asd-ste100.org/STE_downloads.html), and explanatory [FAQ](https://www.asd-ste100.org/STE_faq.html).
The FAQ is supplementary explanation, not the authority for the numbered rule definitions.

## Numbered rule mapping

The executable catalog has **49 numbered entries** and one supporting dictionary candidate adapter.
Four additional normative rules, 8.4 through 8.7, are included as deterministic counting dependencies of 5.1 and 6.3 through `source.requiredRules`.
This maps all 53 without four duplicate requests or model counting.
Every numbered entry records `source.rule`, `edition`, `printedPages`, `pdfPages`, `coverage`, and the guide location as plain JSON.

| Section | All numbered rules | Included engine and local scope                                                                                                              | Bounded unavailable or excluded portions                                                                                                                                                                                      |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | 1.1–1.14           | Contextual decisions at paragraph scope, except page consistency for 1.11. Deterministic private vocabulary lookup supplies candidates.      | Missing approved meanings, roles, forms, spelling, or term authority. New-name numeric counting in 1.9 without verified term evidence. External authority verification and cross-page naming consistency are outside scripts. |
| 2       | 2.1–2.2            | Paragraph noun-group judgment and page introduction/reuse judgment.                                                                          | Numeric noun-group limits without deterministic boundaries/counts. Document-wide first occurrence, unseen illustrations, and external name approval are outside scripts.                                                      |
| 3       | 3.1–3.7            | Paragraph contextual grammatical decisions.                                                                                                  | Missing dictionary forms or approved senses. Lookup is not delegated to model memory. Missing state/action or actor evidence remains unresolved.                                                                              |
| 4       | 4.1–4.5            | Paragraph clarity, completeness, and determiners. Section lists and local connections.                                                       | Missing grammatical reference, lead-in, list boundaries, or publication directives. External facts and renderer behavior are outside scripts.                                                                                 |
| 5       | 5.1–5.5            | Paragraph mechanical procedural 20-word limit. Paragraph instruction/condition decisions. Section action grouping and note decisions.        | Unknown writing mode or counting context. Notes need descriptive 25-word assessment. A full procedure-without-notes test cannot be asserted when steps are elsewhere.                                                         |
| 6       | 6.1–6.6            | Section progressive description/cohesion/grouping decisions. Paragraph topic decisions and mechanical 25-word/six-sentence limits.           | Unknown mode, paragraph boundaries, composite word groups, or unsupported syntax. Cross-page cohesion is outside scripts.                                                                                                     |
| 7       | 7.1–7.3            | Section contextual safety label, opening, and risk explanation.                                                                              | Missing risk analysis or governing classification. Actual risk discovery and external safety authority verification are outside scripts.                                                                                      |
| 8       | 8.1–8.7            | Page mechanical semicolon restriction. Paragraph hyphen/parenthesis decisions. 8.4–8.7 included in the mechanical counting model of 5.1/6.3. | General punctuation beyond the configured property. Ambiguous role-based count groups, malformed delimiters, and unsupported Markdown require review. Count correctness does not approve the underlying prose or grouping.    |
| 9       | 9.1–9.4            | Section reconstruction, paragraph contextual approved usage/phrases, and page consistent operation wording.                                  | Missing original meaning or entries. Cross-page rewrite effects and document-set style consistency are outside scripts.                                                                                                       |

No rule is wholly omitted from the source map.
Local checks cover only the parts decidable from supplied page evidence.
A bounded exclusion preserves the obligation for separate review and must not appear as a pass.

## Mechanical versus contextual evidence

The bundled deterministic checks are `ste-5-1`, `ste-6-3`, `ste-6-6`, and `ste-8-1`.
`ste-dictionary-candidates` locates private local records but always requires contextual review of meaning, part of speech, and technical-term allowances.
A known entry lookup is code work, not a semantic judgment.
Dictionary-dependent contextual checks declare `requiresDictionaryEntries: true` and must abstain when the deciding entry evidence is not available.
The catalog does not contain the dictionary or claim an automatically verified complete approved vocabulary.

The 20-word procedural limit includes safety instructions, while notes are descriptive and use 25 words.
Use explicit local writing-mode metadata and section overrides for mixed pages.
The parser must distinguish counting units from actual prose sentences, particularly in lists and parentheses.
Apply all section 8 counting methods together, including number/unit combinations, fixed quoted text, specified proper names, and numbering exclusions.
Do not use a naive whitespace or punctuation regex to establish compliance.
The [execution guide](running.md) defines the supported metadata and conservative unresolved outcomes.

The numeric portions of 1.9 and 2.1–2.2 require matched literal `ste.nounGroups` and engine-computed counts.
These checks declare `requiresNounGroupCounts: true` and defer without decidable local count evidence.
A model may judge noun relations, clarity, or applicability but must not supply missing counts.
The declared kind, source, group boundary, and actual technical identity still require contextual verification.
Only declared local literal matches are counted, so neither a successful count nor a model pass certifies that every noun group has been discovered or reviewed.
Noun-group counts do not turn ordinary technical phrases into single sentence-count tokens under 8.6.
Audit literal `wordGroups` and measurement units against their actual roles, rather than treating arbitrary declarations as proof.

## Supplements and superseded FAQ checks

Retain the seven supplementary decisions about reader purpose, audience, substantive representations, consequential limitations, focused units, local navigation, and visual roles.
They fill documentation needs not settled by the language standard and must not become extra STE rules.
`code-fence-language` remains the project Markdown convention check.
The optional `prohibited-terms` kind remains available for exact project restrictions, not as a substitute for the contextual STE dictionary.

The four former FAQ-only IDs are superseded, not duplicated:

| Former FAQ check                  | Numbered source-backed check                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `ste-faq-procedural-instructions` | `ste-5-3`                                                           |
| `ste-faq-active-description`      | `ste-3-6`                                                           |
| `ste-faq-condition-first`         | `ste-5-4`                                                           |
| `ste-faq-one-topic`               | `ste-4-1`, with descriptive development also addressed by `ste-6-1` |

Use the [FAQ migration note](rules/ste-faq.md) to update saved manifests.
Do not run both definitions against the same passage.

## Acceptance claims

Report the selected page/range, rule, actual evidence, correction, and unresolved remainder.
Keep demonstrated defects, contextually justified `not_applicable`, `insufficient_context`, excluded scope, parser gaps, request errors, and uncalibrated model results distinct.
A mechanical pass proves the configured property only.
A contextual judgment must be verified and calibrated for the task before it can support automated acceptance.
No test of evaluator schema or behavior establishes universal semantic accuracy or full STE compliance.

Cross-page duplication, ownership, destination content, translation fidelity, working links, external API accuracy, and runnable behavior need separate workflows.
Any applicable cross-page standard obligation, such as naming consistency or rewrite effects, remains required despite exclusion from this evaluator.
Operational exception proposals need the affected rule, exact passage, unavoidable constraint, and smallest proposed relaxation.
Leave those passages unchanged until the exception is approved.
