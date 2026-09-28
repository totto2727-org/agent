---
name: documentation-quality
description: >-
  Evaluate technical documentation against explicit writing rules, including many small pages or sections in parallel with Jev through OOMOL/OpenConnector.
  Use for documentation quality checks, history-calibrated reviews, and before/after regression checks.
  Use documentation-principles for writing principles and share-artifact for README, AGENTS.md, and ADR structure.
compatibility: Node.js 22 or later and curl for the optional evaluator. Live checks require an OOMOL/OpenConnector instance with the TypeSafe AI Actions enabled.
---

# Documentation Quality

Review meaningful units against explicit rules, not document length or a single overall quality score.
Use [documentation-principles](../documentation-principles/SKILL.md) as the source of writing principles.
This skill owns the evaluation workflow, not a competing set of writing principles.

> [!WARNING]
> Use the bundled Jev rubric as review assistance, not an unattended approval gate.
> Historical calibration found high-confidence acceptance of some corrected-away passages, including in the separate revision-family holdout.
> A `pass` is a model judgment, not proof that the document meets the reviewed standard.

## Establish the reference

1. Identify the audience, reader task, and documentation type before choosing rules.
2. When a reviewed branch supplies the reference, inspect its chronological commits, not only its base-to-merge diff.
3. Pair a corrected passage with its corresponding passage at the actual merge commit, retaining the relevant heading, example, warning, and neighboring context.
4. Label the corrected-away passage as a negative example for the specific quality problem that was fixed, and the merged passage as the positive target for that comparison.
5. Separate feature additions, API changes, and factual corrections from writing-quality revisions.
   An old API is not evidence of bad prose, and a changed line is not automatically wrong under every rule.
6. Record commit hashes, paths, source ranges, the affected rule, and why the transition demonstrates it.

Do not tell the evaluator which passage is old, merged, preferred, or expected to pass.
Keep labels and provenance outside its state.
Merged examples are the requested reference standard for these comparisons, not proof that every future question about them should pass.
Read [history evidence](references/history-evidence.md) for the documented revision families behind the initial rules.

## Choose meaningful evaluation units

Use a heading section, coherent paragraph group, or complete small page.
Do not split by a fixed character count, individual line, or arbitrary sentence quota.
Keep code fences, tables, list items, warnings, and the explanation they qualify together.
Include the page purpose, audience, ancestor headings, and surrounding page as context.

A short unit can pass without an introduction, summary, or examples unrelated to its purpose.
Evaluate its responsibility within that context rather than requiring it to function as an isolated complete manual.
When a unit is too large for the model, subdivide it at a meaningful boundary or escalate it, never silently truncate it.

Evaluate local expression on sections and evaluate navigation, ordering, and duplication separately at page or document-set scope.
For cross-page checks, supply the linked material or an explicit inventory as evidence.
A fragment cannot prove that an omitted prerequisite or canonical guide exists elsewhere.

## Run independent judgments in parallel

Prefer the installed official `typesafe-ai` skill for Jev question design and current limits.
If unavailable, consult the [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt).
Use the installed `open-connector` skill for gateway configuration, authentication, and Action discovery.
If it is not installed, see the [gateway skill in this repository](../../../external-information/skills/open-connector/SKILL.md).

The optional [evaluator](scripts/evaluate.mjs) submits independent rule questions for each unit and runs units through a bounded worker pool.
It uses OOMOL/OpenConnector's `typesafe_ai.evaluate` Action, never a direct TypeSafe endpoint or provider credential.
Read [running evaluations](references/running.md) for the manifest, dry run, command, and report contract.
Read [the rule catalog](references/rules.md) when choosing checks, rather than sending every principle to every fragment.

Before sending documents, confirm that the chosen gateway and its configured model provider may receive their contents.
Run a dry run to inspect the units, contexts, rule count, and request count.
Start with limited concurrency and respect the connected account's rate limit.

## Interpret results conservatively

Keep `pass`, `fail`, `not_applicable`, and `insufficient_context` distinct.
Low-confidence answers need review, not automatic acceptance.
Request failures, missing answers, invalid distributions, and unreviewed units are incomplete evaluations, not passing checks.
Do not average a failed critical rule into a passing overall score.

Jev supplies typed judgments, not generated explanations or verified proof.
Report the exact source range, rule, outcome, probabilities, resolved model, and any transport failure.
Have a reasoning model or person inspect failing or uncertain passages in context and propose a specific correction.
Do not invent a quoted rationale that the evaluator did not return.
Source accuracy, runnable examples, working links, and translation equivalence require their own evidence or checks.

## Calibrate without teaching the answers

Use paired historical negatives and merged positives to test whether each rule distinguishes its intended problem.
Freeze the rules, threshold, and model choice before evaluating a held-out revision family.
Keep related translations and nearly identical host variants in the same split.
Do not count them as independent evidence of generalization.

Report false acceptances, false rejections, abstentions, and infrastructure errors separately, per rule and revision family.
Include short merged sections as positive controls so the checker cannot succeed by rejecting brevity.
A rule that flags an accepted reference should be investigated for missing context or overbroad wording before being used as a gate.
Do not relabel the reference merely to improve a score or tune against the held-out set and continue calling it held out.

Passing this corpus shows agreement with these reviewed examples, not universal documentation quality or guaranteed model accuracy.
Keep live run reports under the working repository's ignored `tmp/` directory unless a maintained regression artifact explicitly needs versioning.
