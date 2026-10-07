---
name: documentation-quality
description: >-
  Review English source documentation against ASD-STE100 and supplementary documentation principles.
  Use local mechanical checks for decidable rules and Cloudflare Decision Models only for contextual judgments.
  Exclude cross-page judgments from scripted review and review translations separately.
compatibility: Node.js 22 or later. Semantic evaluation additionally requires curl and the configured Cloudflare environment from cloudflare-ai.
---

# Documentation Quality

Apply [documentation-principles](../documentation-principles/SKILL.md) with ASD-STE100 as the strict default, not an optional selection of writing tips.
Apply all applicable, verified rules to the content within the required document structure.
Preserve template headings, order, sections, identifiers, and exact executable or quoted material.
A structural constraint is not a blanket exemption for the prose inside it.

> [!IMPORTANT]
> The bundled catalog currently implements verified public STE FAQ guidance and supplementary principles, not the complete Issue 9 standard.
> Read the [coverage record](references/coverage.md) before reporting compliance.
> Do not invent standard rule numbers, dictionary entries, word limits, or exceptions when the complete source is unavailable.

## Review workflow

1. Establish the English source, intended task, audience, and imposed template constraints.
   Distinguish beginner, intermediate, and advanced users from developers of the subject itself.
   Split subject developers into contributors and maintainers when their tasks differ.
   A programmer who consumes a library or API is its user.
2. Load the [rule index](references/rules.md) and executable catalog.
   Apply all applicable verified rules; use `not_applicable` only with a contextual justification, not to make the document pass.
   Keep unimplemented standard requirements visible as coverage gaps.
3. Run mechanical checks first for properties that code can decide.
   Do not ask a Decision Model to count, look up a known restriction, or detect syntax that deterministic code can detect.
4. Review complete paragraphs, sections, or pages with their local context.
   Keep instructions, conditions, examples, and warnings intact.
   Scripted review must not judge destination pages, cross-page duplication, document-set ownership, or unseen external evidence.
5. Use a Decision Model only for a bounded contextual judgment that remains undecidable by the mechanical checks.
   Verify each finding against its actual passage and relevant source before editing.
   Preserve required structure, technical meaning, public interfaces, and exact representations.
6. Report the rule, source range, evidence, correction, and unresolved coverage.
   Leave proposed exceptions unchanged until the user accepts their minimum scope and operational grounds.
   Missing evidence, model errors, deferred checks, and untranslated exclusions are not passes.

## Rule details and exceptions

The [rule index](references/rules.md) separates standard-derived guidance from supplements.
Open its linked guide only when interpreting a finding or resolving applicability.
Supplementary rules cover audience boundaries, substantive representations, navigation, and visual roles that the language standard does not itself settle.
Do not restate these supplements as new STE requirements.

Record an exception candidate with its affected rule, precise passage, unavoidable operational constraint, and smallest proposed relaxation.
Do not exempt all technical prose, all advanced documentation, or all unfamiliar words.
Treat protected syntax, names, and exact quotations according to their role and the verified standard, not a model's vocabulary guess.

## Scripted and semantic evaluation

Use [running evaluations](references/running.md) for manifests, local execution, Cloudflare routes, and report interpretation.
Use [decision-model](../../../external-information/skills/decision-model/SKILL.md) for typed judgment design and calibration, and [cloudflare-ai](../../../external-information/skills/cloudflare-ai/SKILL.md) for model selection, transport, and authentication.
Never substitute direct Typesafe or another provider's transport for the selected Cloudflare route.
A supported model name is not authorization to operate that provider directly.

> [!WARNING]
> A Decision Model is review assistance, not an unattended approval gate.
> An uncalibrated confidence threshold cannot establish semantic acceptance.
> High confidence does not establish correctness, and absence of a flagged defect does not establish full STE compliance.

Keep labeled examples and expected verdicts out of blind requests.
Run representative public workflows separately to verify runnable examples, rendering, links, source accuracy, and packaging.
Translation fidelity requires a separate review against the English source.
The local tests establish evaluator behavior, not standard coverage or model accuracy.
