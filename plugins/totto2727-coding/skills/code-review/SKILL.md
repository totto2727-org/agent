---
name: code-review
description: >-
  Review code changes against the task contract with existing compiler, lint, and test tools, bounded contextual JevLint rules, wider LLM review, and actual consumer checks. Use for implementation review or corrective feedback across authorized code artifacts. Do not use for documentation quality or translation review.
---

# Code Review

Review the requested outcome, not only the changed lines.
Use this procedure with the applicable coding and testing skills, not as a replacement for them.
Apply [share-coding](../share-coding/SKILL.md) and the relevant [TypeScript](../js-coding/SKILL.md), [MoonBit](../mbt-coding/SKILL.md), or [Rust](../rust-coding/SKILL.md) guidance.
Keep review proportional to the change and its observable risks.

## Assign each check to the right method

| Method                             | Responsibility                                                                                                                    | Evidence limit                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Existing static tools and tests    | Run exact, known checks with the repository's compiler, formatter, linter, type checker, and test entry points.                   | A passing tool proves only its implemented checks and tested behavior.                                     |
| JevLint custom rules               | Ask a bounded contextual question that static checks cannot decide, using the complete local review packet and explicit evidence. | Missing context is not compliance. Model scores and confidence are not acceptance.                         |
| Wider LLM review                   | Trace repository-wide ownership, architecture, affected artifacts, and tradeoffs that exceed the bounded packet.                  | Verify each finding against actual source and the task contract. An LLM report is not an executed check.   |
| Actual consumer or public workflow | Exercise the affected public interface through its real supported consumer or delivery workflow.                                  | Record external blockers and untested boundaries. A substitute does not establish actual workflow success. |

Do not ask a semantic rule to detect exact syntax, count items, or repeat a known compiler or lint restriction.
Do not build a source-wide scanner or AST wrapper to replace existing static tools.
Use [documentation-quality](../documentation-quality/SKILL.md) for English source documentation and its separate manual cross-page review.
Review translation fidelity against the source separately.
Snapshots, text consistency, and code checks do not prove semantic documentation or translation correctness.

## 1. Establish the smallest useful contract

Read the task, current instructions, relevant source, and latest feedback before judging the diff.
Record the outcome, non-goals, protected behavior, affected artifacts, and observable checks in the [task contract](references/task-contract.md).
Use one row per distinct requirement, not a universal ledger of every coding principle.
Keep source locators where needed, but do not copy private conversations or identities into distributable material.

Classify feedback as a correction, a new requirement, or a question.
A correction updates the existing contract and its checks.
A new requirement can change scope only when authorized.
A question does not authorize an edit.
Keep historical constraints scoped to their original task unless current instructions make them applicable.
Resolve conflicts through instruction priority and current explicit intent.

Map each correction to semantically equivalent artifacts within the authorized scope.
Check those artifacts for the same principle, and state meaningful exceptions.
Do not expand to other repositories or impose a platform-specific rule on unrelated outputs.
Preserve authentication, required tests, supported functionality, and user files during simplification.

## 2. Inspect guarantees and standard contracts

Compare the standard library, framework, and established project facility with the required behavior before proposing a custom mechanism.
Prefer removal when a verified guarantee makes code redundant, reuse when an existing contract fits, and the smallest custom implementation when evidence shows a gap.
Inspect the actual contract and defaults, not only the name of an API.
Record the concrete limitation when retaining a wrapper or fallback.

For an invariant, locate its producer and all relevant creation paths.
Place a single-value guarantee in its canonical constructor or equivalent factory, and a relationship between values in its owning domain policy.
Before removing a downstream check, verify that supported construction paths cannot bypass that guarantee.
Retain validation where hostile external input, deserialization, alternate constructors, or mutable state can violate it.
Do not remove authorization or necessary boundary checks merely to reduce code.

Trace the owner, producer, consumers, failure behavior, and observable semantics of each affected boundary.
Preserve order, identity, mutation, normalization, errors, and supported runtime behavior where the contract requires them.
Reuse [composition-root and dependency-injection guidance](../share-coding/SKILL.md#composition-root-and-dependency-injection) for infrastructure selection.
Reuse [workspace toolchains and tasks](../share-coding/SKILL.md#workspace-toolchains-and-tasks) and [task orchestration](../share-coding/references/task-orchestration.md) for native entry points and recurring tasks.
Do not introduce parallel policies, a unified CLI, dependencies, runners, or CI changes merely to perform this review.

## 3. Run existing exact checks

Identify the repository's documented execution environment and existing commands.
Run the smallest set that covers affected behavior, including necessary regression and negative cases.
Use the existing compiler, formatter, linter, type checker, and test tools before semantic evaluation.
Record the exact command, revision or diff state, exit status, and relevant output.
Mark skipped or blocked checks explicitly.
Do not weaken an existing check or delete a required test to obtain a clean result.

Separate verification quality from artifact permanence.
A useful temporary check need not become a committed CI task, script, fixture, or report.
Retain lasting regression tests when the change needs them or the user requests them.
Keep temporary evidence separate from shipped artifacts, and inspect the final changed paths for unintended additions.

## 4. Review bounded contextual questions with JevLint

Use [the JevLint packet and CLI procedure](references/jevlint.md) when a local semantic question remains after exact checks.
It specifies the public fork prerequisite, explicit configuration, draft rule limits, and offline planning commands.
Do not infer unseen source, missing standard contracts, or successful workflow checks.
Keep expected verdicts, hidden labels, and evaluation answers out of the input packet.

Verify each candidate finding against the cited source, contract, and static evidence before editing.
For each applicable question, record `comply`, `violate`, `not_applicable`, or `insufficient_context` with a reason in the review notes.
These are reviewer statuses unless the installed CLI explicitly supports them as primary verdicts.
Do not translate a numeric score or an empty finding list into `comply`.
Do not use uncalibrated scores or guessed confidence thresholds as an approval gate.
If required evidence does not fit a bounded packet, move the question to wider review rather than silently truncating it.

## 5. Perform wider LLM review

Inspect affected callers, exports, configuration, packaging, tests, and equivalent authorized artifacts beyond the local packet.
Review architecture and tradeoffs against the outcome and protected behavior.
Check whether a local concern has moved into shared core semantics without a shared contract, or whether a new abstraction duplicates a standard facility.
Follow the existing composition-root policy rather than prescribing a fixed layer count or DI framework.

Prioritize findings by observable consequence.
For each finding, state the violated requirement, source location, affected consumer, evidence, and smallest correction.
Separate facts from hypotheses and questions.
Discard a proposed finding when the source or an applicable exception disproves it.
An independent reviewer or worker completion label is a report, not verified evidence or user acceptance.

## 6. Exercise the public outcome and close the loop

Run the relevant actual consumer or public workflow, not only a helper, mock, snapshot, or internal unit test.
For a library, use a supported consumer import and the affected public operation.
For an application, exercise the requested user path and its relevant failure path.
For delivery changes, inspect the actual package or supported deployment route when authorized.
Do not publish, merge, change permissions, or perform other consequential operations without the required authorization.

Before declaring an authentication blocker, inspect documented and authorized QA or test configuration that uses the same supported path.
Use an existing authorized route if it covers the requirement.
At a real authentication, permission, or user-controlled prerequisite blocker, stop and report the needed user action.
Do not bypass authentication, reset credentials, or invent a success result.
A mock or offline check can support diagnosis, but it cannot substitute for the blocked actual outcome.

Update the contract rows with observed results and remaining gaps.
After a correction, rerun affected checks and inspect equivalent authorized artifacts again.
Review the final diff for unauthorized changes and task-created temporary artifacts.
Report the changed outcome, exact evidence, and unverified boundaries concisely.
Distinguish a source fact, a tool result, a reviewer report, delivered behavior, and explicit user acceptance.
Do not treat user silence as acceptance.
