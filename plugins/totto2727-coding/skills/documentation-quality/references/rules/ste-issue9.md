# Issue 9 operational rule map

These are original review rubrics, not a replacement for ASD-STE100 or a reproduction of its dictionary, examples, or explanatory text.
The source is ASD-STE100 Issue 9, dated 2025-01-15, supplied privately by the user.
Printed pages identify the standard's own pagination, while PDF pages are one-based physical pages.
All Part 1 numbered rules and their explanations were read, including the eight separate general recommendations.
The verified normative inventory is **53 rules**: section counts **14, 2, 7, 5, 5, 6, 3, 7, 4**.
Apply every applicable requirement, not a selection of convenient tips.

The [executable catalog](../rules.json) contains 49 numbered check entries.
Rules 8.4 through 8.7 are required counting methods used by 5.1 and 6.3, not four duplicate count questions.
Their mapping and rubrics appear below and in `source.requiredRules` on both checks.
The dictionary candidate adapter is supporting machinery, not a 54th normative rule.

## Evidence and engine boundaries

- **Decision:** assess an actual contextual role, meaning, relation, or applicability using local evidence.
- **Mechanical:** compute a decidable property using the verified counting model and conservative parsing.
- **Bounded unavailable:** keep missing dictionary entries, naming authority, term counts, ambiguous syntax, and unseen context unresolved.
- **Excluded from scripts:** review cross-page and document-set consistency, external authority, risk analysis, and rewrite effects separately when applicable.

An excluded or unavailable requirement is not a pass.
A local finding cannot establish that a whole publication complies.
`not_applicable` requires evidence that the rule's preconditions do not hold, not merely that the check is inconvenient.
Use `insufficient_context` for a missing deciding fact, and retain any independent proven defect.
A high-confidence model result does not replace source verification or task-specific calibration.
Use [decision-model](../../../../../external-information/skills/decision-model/SKILL.md) for the bounded judgment design and [cloudflare-ai](../../../../../external-information/skills/cloudflare-ai/SKILL.md) for the selected execution route.

Dictionary-dependent judgments need privately supplied matched Issue 9 entries with their approved forms, meanings, and grammatical roles.
The adapter can locate candidates deterministically but does not approve their contextual use.
Do not infer a missing entry from general English or model memory.
Do not send the complete dictionary to inference or commit it to the repository.
A technical noun or verb must have its own actual domain meaning and category evidence, not an asserted whitelist escape.
The numerical term limits in 1.9, 2.1, and 2.2 need verified term boundaries and deterministic counts.
These three checks declare `requiresNounGroupCounts: true`.
Declare literal `ste.nounGroups` with the actual kind and source evidence, and use only the engine's matched `nounGroupCounts`, `wordCount`, and `hyphenComponentCounts`.
The engine computes numbers, while contextual review verifies the head noun, constituent relationships, official identity, and declared role.
Undeclared or ambiguous groups cannot be filled in by model counting.
Until the necessary evidence exists, the numeric portions are unavailable, even when clarity can be assessed.

Exact executable syntax is not English prose, but inline code styling does not automatically exempt an English phrase.
Classify the actual role of identifiers, quoted text, formulas, labels, and prose.
Fixed quotations and official names have specific allowances, not permission to hide editable prose inside quotation marks.
Preserve required template structure and correct its prose within that structure.
An operational constraint beyond a standard allowance is only an exception proposal pending approval, not a silent waiver.

## Section 1

Decision scopes are paragraphs except 1.11, which compares the whole supplied page.
Dictionary membership and inflection lookup are deterministic prerequisites, not model recall.

| Rule | Printed pages    | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                 |
| ---- | ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | 1-1-2            | 46        | Establish a permitted vocabulary basis for each prose use: approved entry, valid technical noun, or valid technical verb. Missing evidence remains unresolved.                                                                                      |
| 1.2  | 1-1-2 to 1-1-3   | 46–47     | Match actual grammatical role to the supplied entry's approved roles. Multiple-role entries are possible. A replacement with a different role needs grammatical reconstruction.                                                                     |
| 1.3  | 1-1-4            | 48        | Match actual contextual sense to the supplied approved meaning, not to the word's broader ordinary-English senses.                                                                                                                                  |
| 1.4  | 1-1-4 to 1-1-5   | 48–49     | Use verified approved verb and adjective forms. Analytic adjective comparison does not require an invented inflected entry. Distinguish participial states from verbal actions.                                                                     |
| 1.5  | 1-1-5 to 1-1-9   | 49–53     | Establish an actual domain concept in one of the 22 technical-noun categories below. The examples in the standard are not an exhaustive whitelist. Colors may function adjectivally, but their comparative and superlative forms are not permitted. |
| 1.6  | 1-1-9 to 1-1-10  | 53–54     | A disallowed or absent general word may be permitted as a technical noun or its constituent in that specific technical context. Do not alter an official term by a blind replacement.                                                               |
| 1.7  | 1-1-11           | 55        | Noun permission does not grant verb permission. A noun can modify another technical noun. The same spelling can separately qualify as a technical verb in a valid category and context.                                                             |
| 1.8  | 1-1-11           | 55        | Use the established company, industry, or field name. Compare only with supplied authority, and do not invent approval or inspect an unseen glossary.                                                                                               |
| 1.9  | 1-1-12           | 56        | When no established name exists, choose an intelligible new name of at most three counted words. Preserve enough identification. A referenced illustration only supports shortening when its identifying evidence is available.                     |
| 1.10 | 1-1-12           | 56        | Avoid regional-only names, informal slang, and confined jargon. Specialization or reviewer unfamiliarity alone does not prove a defect.                                                                                                             |
| 1.11 | 1-1-13           | 57        | Use a consistent technical name for the same evidenced item. Respect legitimate introduced short forms. Compare this page only, with cross-page consistency separately required.                                                                    |
| 1.12 | 1-1-13 to 1-1-16 | 57–60     | A necessary technical verb must name a precise process in a permitted category. Prefer an accurate approved verb or approved construction when it suffices. Technical verbs still follow section 3.                                                 |
| 1.13 | 1-1-16 to 1-1-17 | 60–61     | Verb permission does not grant noun permission. Participial adjectives and independently categorized technical nouns can be valid.                                                                                                                  |
| 1.14 | 1-1-17           | 61        | Follow the supplied American spelling unless an applicable official directive requires another. Preserve fixed quoted spelling. Personal preference is not a directive.                                                                             |

### Technical noun categories

These concise category descriptions preserve the category distinctions without copying the standard's vocabulary examples.
For every allowance, record the number, domain meaning, actual grammatical use, and local evidence.

| Category | Domain concept                                                         |
| -------- | ---------------------------------------------------------------------- |
| 1        | Design items named by official part records or drawings                |
| 2        | Vehicles and machines, including their locations                       |
| 3        | Tools and support equipment, including parts and locations             |
| 4        | Materials, expendable supplies, and unwanted substances                |
| 5        | Physical facilities, infrastructure, and logistics                     |
| 6        | System or circuit structure, functions, configurations, and components |
| 7        | Mathematics, science, engineering, and formulas                        |
| 8        | Navigation and geography                                               |
| 9        | Numbers, measurement, and time, including symbols                      |
| 10       | Fixed wording on displays, signs, labels, and markings                 |
| 11       | Roles, persons, organizations, groups, and geopolitical entities       |
| 12       | Body parts and anatomical functions                                    |
| 13       | Everyday personal items, food, and drinks                              |
| 14       | Medicine and medical conditions or procedures                          |
| 15       | Official publications, their parts, standards, and guidance            |
| 16       | Environmental factors and operating conditions                         |
| 17       | Colors, with no comparative or superlative forms                       |
| 18       | Defects, damage, and degradation                                       |
| 19       | Computing and communications technology                                |
| 20       | Civil or military operations and lifecycle support                     |
| 21       | Legal and regulatory concepts                                          |
| 22       | Animals, plants, and other organisms                                   |

### Technical verb categories

Four category families permit process-specific verbs, not arbitrary verbs that occur in technical prose.

1. Manufacturing: removal, addition, or attachment of material, and changes to material properties, finish, or shape.
2. Computing: input/output, interface or application operations, and system operations.
3. Applicable subject processes: engineering/mathematics/science, medicine, civil/military operations, navigation, automotive/railway work, and energy/oil/gas work.
4. Legal and regulatory processes, only in corresponding legal or regulatory texts.

The same word can have an allowed technical use and a disallowed general use.
Use an ordinary approved construction when it accurately communicates the same action.

## Section 2

Both rules combine contextual noun-group analysis with deterministic counting prerequisites.
Rule 2.1 has paragraph scope, and 2.2 has page scope for visible introductions and reuse.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                                                                                                           |
| ---- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | 1-2-1 to 1-2-2 | 63–64     | Identify a head noun and its modifiers, and keep the group within three counted words. Explain relationships with prepositions or clauses. Official long terms need 2.2's handling, not an automatic exemption.                                                                                                                                               |
| 2.2  | 1-2-2 to 1-2-4 | 64–66     | Introduce a long official term in full, then give a clear shorter form or approved abbreviation when feasible, or use meaningful hyphen groups. Preserve official hyphens, do not group more than three words with added hyphens, and do not abbreviate or hyphenate short names unnecessarily. Do not assert a document-wide first occurrence from one page. |

## Section 3

All executable checks have paragraph decision scope, with dictionary forms supplied as prerequisites.
Do not convert a suffix or a short auxiliary pattern into a grammatical verdict.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                      |
| ---- | -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | 1-3-1 to 1-3-2 | 67–68     | Match the observed verb form to verified entry forms, including irregular forms. This is the verb application of 1.4.                                                                                                                                    |
| 3.2  | 1-3-2          | 68        | Use infinitives, commands, simple present/past/future, and permitted participial adjectives. Perfect, progressive, and other complex tense constructions are not added allowances.                                                                       |
| 3.3  | 1-3-2 to 1-3-3 | 68–69     | Use an approved participle adjectivally to state a condition, before a noun or after forms of be, become, or stay. A standalone approved adjective can be valid even when its related verb is not. State adjectives are not automatically passive voice. |
| 3.4  | 1-3-3          | 69        | Avoid auxiliary chains that produce unapproved perfect or complex passive constructions. Do not ban valid simple future, active modal uses, or state adjectives merely because an auxiliary occurs.                                                      |
| 3.5  | 1-3-4 to 1-3-5 | 70–71     | A verbal -ing form needs a technical-noun role or a functional modifier role inside a technical noun. Independently approved dictionary words with that ending remain valid in their approved roles.                                                     |
| 3.6  | 1-3-5 to 1-3-8 | 71–74     | Use active voice. Descriptive passive is permitted only for an unknown true actor or cause. Omitted known actors are not unknown, and a rewrite must not invent causation. Distinguish approved state adjectives.                                        |
| 3.7  | 1-3-9          | 75        | Express actions with accurate approved verbs instead of avoidable nominalized wording. Do not convert a noun into an unapproved verb to achieve directness.                                                                                              |

## Section 4

Rules 4.1, 4.2, and 4.5 use paragraph decision scope.
Rules 4.3 and 4.4 use section scope to retain complete lists and related sentences.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | 1-4-1 to 1-4-2 | 77–78     | Communicate concrete accurate actions or one descriptive idea per sentence. Descriptions do not command. Judge clarity separately from the mechanical length limits.                                                                                                                                                                                                                                                 |
| 4.2  | 1-4-3          | 79        | Keep necessary sentence components and write contractions in full. Understood imperative subjects and valid headings or list fragments are not omissions. Possessives are not contractions.                                                                                                                                                                                                                          |
| 4.3  | 1-4-4 to 1-4-6 | 80–82     | Use a readable vertical list for a complex series. Supply a colon lead-in, marked capitalized items, applicable articles, and accurate lead-in connections. Full sentences take periods, fragments do not except the final item. Do not end items in commas or semicolons. Keep procedural and descriptive lists distinct and avoid unclear embedded lists. Repeat necessary safety negatives on the affected items. |
| 4.4  | 1-4-7          | 83        | Make established relations between related sentences clear with accurate connectors or demonstratives. Do not invent sequence or causation, or require a connector in every sentence.                                                                                                                                                                                                                                |
| 4.5  | 1-4-8 to 1-4-9 | 84–85     | Use applicable articles or demonstratives. General statements and abstract concepts can omit them. A noun followed by its alphanumeric identifier does not take the definite article. In a series, article repetition can control modifier scope.                                                                                                                                                                    |

## Section 5

Rule 5.1 is mechanical at paragraph scope, inheriting an explicitly selected section's writing mode.
Rules 5.2 and 5.5 are section decisions, while 5.3 and 5.4 are paragraph decisions.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                                                                                               |
| ---- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | 1-5-1 to 1-5-2 | 87–88     | Limit procedural sentences, including warnings and cautions, to 20 words using section 8's counting methods. Notes are descriptions and instead have the 25-word limit.                                                                                                                                                                           |
| 5.2  | 1-5-2 to 1-5-3 | 88–89     | Separate independent sequential instructions. Simultaneous actions can share a sentence. One work step can contain multiple sentences for coupled simultaneous work or an immediate result, including its required limit.                                                                                                                         |
| 5.3  | 1-5-3 to 1-5-4 | 89–90     | Give reader actions as imperative commands. Avoid modal emphasis unless justified by an important safety instruction or condition. Automatic system behavior is not a reader command.                                                                                                                                                             |
| 5.4  | 1-5-4          | 90        | Put a condition that must be known before action first, then separate the command with a comma whose placement preserves modifier meaning. This is not a universal fronting rule for all conditionals.                                                                                                                                            |
| 5.5  | 1-5-5 to 1-5-7 | 91–93     | Notes are dispensable descriptive help, not work instructions, mandatory requirements, tolerances, limits, or required results. Keep necessary operational content with its action and safety content in safety instructions. Test that a procedure works without its notes. Descriptive notes are limited to necessary illustration/table notes. |

## Section 6

Rules 6.1, 6.2, and 6.4 use section decision scope, while 6.5 uses paragraph decision scope.
Rule 6.3 and 6.6 are paragraph mechanical checks, inheriting any explicitly selected section's writing mode.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                      |
| ---- | -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | 1-6-1 to 1-6-2 | 95–96     | Develop descriptive information gradually, with one subject or idea per sentence and no reader commands. Do not add redundant introductions to self-contained facts.                                     |
| 6.2  | 1-6-2 to 1-6-4 | 96–98     | Reuse stable key terms and phrases to build accurate sentence and paragraph connections. Necessary reference repetition is not clutter. Cross-page cohesion remains separate review.                     |
| 6.3  | 1-6-4          | 98        | Limit descriptive sentences, including procedural notes, to 25 words under section 8's counting methods.                                                                                                 |
| 6.4  | 1-6-5          | 99        | Group related descriptive information in meaningful paragraphs whose opening sentence establishes the topic developed by the rest.                                                                       |
| 6.5  | 1-6-6          | 100       | Develop one topic per descriptive paragraph and connect its topic sentence to the preceding local account where relevant. Related consequences and supporting facts can belong to that topic.            |
| 6.6  | 1-6-7          | 101       | Use at most six actual sentences in a descriptive paragraph. A fragment list attached to its lead-in is not automatically multiple prose sentences. Unresolved paragraph/list boundaries require review. |

## Section 7

All three rules use section decision scope to preserve the whole safety instruction.
The risk analysis and governing publication specification must be evidenced, not invented by the model.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                           |
| ---- | -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | 1-7-1 to 1-7-2 | 103–104   | Immediately identify the applicable risk level. The aerospace/defense convention distinguishes harm to people from object damage, with combined risk at the human-harm level. Other domains can use prescribed words or symbols. STE does not prescribe uppercase formatting. |
| 7.2  | 1-7-3          | 105       | Open with a clear preventive action or necessary condition and action, rather than delaying it behind abstract hazard discussion.                                                                                                                                             |
| 7.3  | 1-7-4          | 106       | Where possible, explain the specific risk or possible consequence of disobeying the instruction. Missing hazard evidence is unresolved, not permission to invent a consequence or silently waive the explanation.                                                             |

## Section 8

Rule 8.1 mechanically checks prose semicolons at page scope.
Rules 8.2 and 8.3 are paragraph decisions about actual word relations and parenthetical purpose.
Rules 8.4 through 8.7 are mechanical counting dependencies at the paragraph scope of 5.1 and 6.3.
They define the word-count units within each selected paragraph.
They are not independently sent to a model or run four times against the same sentences.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1  | 1-8-2          | 108       | Do not use a prose semicolon. Split the independent statements without changing their meaning. General punctuation still needs editorial review, not a semicolon-pass compliance claim.                                                                                                                                                                                                                                                                             |
| 8.2  | 1-8-2          | 108       | Use hyphens to join truly related units in compound modifiers, written numbers/fractions, configuration names, compound technical verbs, and applicable prefix/root boundaries. Preserve official spelling. Dashes that separate ideas or show ranges are not joining hyphens.                                                                                                                                                                                      |
| 8.3  | 1-8-3 to 1-8-4 | 109–110   | Parentheses may supply a reference, item or step identification, abbreviation, singular/plural notation, explanation, or alternative. Judge their actual role and preserve clear action and alternative applicability.                                                                                                                                                                                                                                              |
| 8.4  | 1-8-4          | 110       | For word-count limits, a list-introducing colon closes the lead-in unit, and each following item has its own 20- or 25-word limit. An arbitrary colon is not a sentence boundary. These count units are not automatically paragraph sentences under 6.6.                                                                                                                                                                                                            |
| 8.5  | 1-8-5          | 111       | Collapse parenthetical content to one word in its enclosing count, then separately count the parenthetical sentence. Identifiers and abbreviations inside parentheses count as one outer word without inventing an internal sentence. Resolve malformed or unclear nesting before claiming a count.                                                                                                                                                                 |
| 8.6  | 1-8-5 to 1-8-8 | 111–114   | Count a number, number-plus-unit, abbreviation, alphanumeric identifier, quoted text, fixed title/heading/placard/label text, or specified personal/group/organization/geopolitical proper name as one word. Formulas are quoted text. Exclude paragraph and step numbering. Quotation can be marked by capitals or font, so role evidence is necessary. Do not collapse arbitrary phrases, all capitalized terms, or ordinary system names into proper-name units. |
| 8.7  | 1-8-8          | 114       | Count a genuine hyphenated group as one word. Its semantic validity remains subject to 2.2 and 8.2, so artificial hyphen padding cannot establish compliance.                                                                                                                                                                                                                                                                                                       |

Use explicit local `ste.writingMode` to establish the applicable limit and `sections[].ste` for mixed writing.
A procedural page's note is still descriptive, and a descriptive page's safety instruction still needs the procedural safety limit.
Missing mode, unsupported Markdown, uncertain sentence boundaries, or unestablished composite word groups remain unresolved.
Locally declared `wordGroups` and `measurementUnits` are literal evidence to audit, not authority to manipulate the count.
For the exact supported metadata and parser behavior, read [running evaluations](../running.md).

## Section 9

Rules 9.1 and 9.4 use section and page decision scopes respectively.
Rules 9.2 and 9.3 use paragraph decision scope with privately supplied dictionary evidence.

| Rule | Printed pages  | PDF pages | Original operational rubric and required boundaries                                                                                                                                                                                                                          |
| ---- | -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1  | 1-9-1 to 1-9-5 | 115–119   | Reconstruct a sentence when direct substitution changes meaning, mismatches grammatical role, or produces defective English. Preserve the true action and conditions, and check local effects on representations and related prose. Cross-page effects need separate review. |
| 9.2  | 1-9-5 to 1-9-7 | 119–121   | Apply each supplied approved sense and role to its actual context. Physical-motion or position meanings do not automatically describe abstract states or numerical limits. This reinforces 1.2 and 1.3, not a second blacklist.                                              |
| 9.3  | 1-9-7 to 1-9-8 | 121–122   | Do not create an unapproved idiomatic meaning by combining otherwise approved words. Literal relations, independently approved restricted phrases, and valid categorized technical verbs retain their distinct bases.                                                        |
| 9.4  | 1-9-8 to 1-9-9 | 122–123   | Reuse stable wording for the same operation and meaning. Different operations need not have identical sentences. Compare this page only, with cross-page/document-set consistency separately required.                                                                       |

## General recommendations

Part 1 explicitly distinguishes these eight recommendations from the 53 numbered rules.
They are editorial aids, not eight additional normative rule IDs or new automated pass gates.
Apply the related normative rule when a recommendation identifies an actual approved-meaning, vocabulary, or clarity defect.

| Recommendation | Printed page | PDF page | Original review aid and normative relationship                                                                                                                                                                                                                                                                                                |
| -------------- | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-1           | 1-9-9        | 123      | Retain a clause-introducing conjunction when it makes the main/dependent clause boundary clear. Use 4.1 and 4.2 for actual ambiguity or missing necessary content, not a mandatory conjunction in every sentence.                                                                                                                             |
| GR-2           | 1-9-10       | 124      | Resolve whether a relation expresses association, joint action, or instrument, and show the primary action directly. Ambiguous attachment belongs to 4.1 and restricted meaning to 1.3/9.2.                                                                                                                                                   |
| GR-3           | 1-9-11       | 125      | Give pronouns clear antecedents and use only their evidenced approved roles. Replace an ambiguous pronoun with the actual referent rather than guessing it.                                                                                                                                                                                   |
| GR-4           | 1-9-11       | 125      | Make a demonstrative's referent or causal condition explicit when several interpretations are possible. Do not require redundant noun repetition where the reference is already clear.                                                                                                                                                        |
| GR-5           | 1-9-12       | 126      | Check apparent cross-language equivalents against the intended English meaning. Translation fidelity remains a separate workflow.                                                                                                                                                                                                             |
| GR-6           | 1-9-12       | 126      | Prefer understandable English wording to unfamiliar Latin abbreviations, or omit the abbreviation when it adds nothing. Do not relabel this recommendation as a separate numbered prohibition.                                                                                                                                                |
| GR-7           | 1-9-13       | 127      | Use neutral, respectful language. The source disallows gender-specific personal pronouns. Its context-dependent allowances for gender-specific nouns, such as necessary medical terminology, do not create a pronoun allowance. Establish entries and category evidence under section 1 rather than applying an unconditional noun-token ban. |
| GR-8           | 1-9-13       | 127      | Possessives are permitted when correct and clear. Follow the applicable official publication guidance rather than inventing a possessive ban.                                                                                                                                                                                                 |
