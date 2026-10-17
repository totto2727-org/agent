# Task Contract

Keep this contract local to the current review.
Use a short task summary and only the rows needed for distinct requirements.
Do not turn it into a permanent incident history or a ledger of every possible principle.

- Outcome: the observable result requested by the user.
- Non-goals: changes outside the authorized task.
- Protected behavior: functionality, authentication, tests, interfaces, runtime support, and user artifacts that must remain intact.
- Scope: affected code and semantically equivalent artifacts already authorized for this task.
- Feedback: classify each item as a correction, a new requirement, or a question, with a source locator when useful.

| Requirement or correction         | Artifacts and owner                                                   | Protected behavior or exception                               | Observable check                                                                             | Evidence and state                                                      |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| State the smallest accepted rule. | Name the implementation, boundary, and equivalent authorized outputs. | State what must remain unchanged and any justified exception. | Name an existing command or actual consumer action, including an absence check where needed. | Record the command, revision or diff state, result, and unverified gap. |

Use `proposed`, `edited`, `checked`, and `delivered` to distinguish progress.
Record explicit user acceptance separately with its actual source.
An acknowledgement is not an edit, an edit is not a check, and a successful check is not user acceptance.

For a guarantee, record the canonical producer, supported construction paths, and bypass risks before removing a redundant check.
For a custom mechanism, record the standard contract considered and the demonstrated gap.
For a temporary artifact, record whether it remains local, is no longer needed, or has lasting project value.
Keep necessary tests and authentication even when reducing implementation size.

## Finding notes

Record each finding with its requirement, source range, affected consumer, observed evidence, consequence, and smallest correction.
Use reviewer statuses with explicit reasons:

- `comply`: the applicable question has enough evidence and no verified violation.
- `violate`: cited evidence contradicts the applicable requirement.
- `not_applicable`: the rule's condition is absent, with supporting context.
- `insufficient_context`: evidence needed to decide is absent, inaccessible, truncated, or unverified.

Separate source facts, tool results, reviewer reports, and actual workflow observations.
If a public workflow is blocked, record the documented authorized QA route considered, the real blocker, and the user action needed.
Do not record a mocked result or numeric model score as actual user acceptance.
