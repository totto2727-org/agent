# Policy for the `projektor` workspace

This policy serves agents that maintain tasks in the workspace with slug `projektor` for this user's continuing Projektor operations.
It does not set assignees or operating policy for other Projektor workspaces.

## Open-PR coverage

Keep at least one corresponding active tracking task for every open PR in the user's requested repository scope, after applying the exclusion below.
Audit all existing open PRs and create missing tasks under that authorization, not only tasks for newly opened PRs.
Use the [reconciliation procedure](../SKILL.md#reconcile-open-pull-requests) to reuse tasks by actual scope, exclude incidental references and duplicates from active coverage, and preserve history.
Maintain this coverage when continuing work or handing off a PR.

## Dependency-maintenance exclusion

Exclude routine dependency-maintenance PRs from task creation and active PR-coverage requirements unless the user explicitly requests that work.
This exclusion includes package and lockfile version updates, GitHub Actions version updates, and dependency-update automation setup such as Renovate onboarding.
It applies to human-authored and bot-authored PRs.
A dependency bot, version change, or security label alone does not establish an explicit user request.

Classify the actual scope, not only the title or author.
Do not exclude a substantive implementation, compatibility fix, toolchain migration, or requested security remediation merely because it also changes dependencies.
Record any explicit request that makes a dependency-maintenance PR an exception.
Report excluded PRs separately from uncovered in-scope PRs.

When the user requests closure of tasks created for excluded dependency maintenance, use `cancelled`, not `done`.
Record the exclusion reason, preserve the task history and PR URL, and remove the assignee.
Do not close the PR itself, delete the task, or reopen the cancelled task during a later audit without a new explicit request.

## Assignment by the next actual actor

| Next action                                                                      | Intended member email         |
| -------------------------------------------------------------------------------- | ----------------------------- |
| AI is actively performing the work                                               | `2000.0727.hayato@gmail.com`  |
| A human must review, make a concrete decision, or complete a manual prerequisite | `kaihatu.totto2727@gmail.com` |
| Neither actor is acting and the task is backlog                                  | Unassigned                    |

Base the choice on current evidence and the next actual action, not the PR's draft flag or an old `in_progress` state.
A backlog idea does not require human assignment merely because design decisions could eventually be necessary.
When handing work to the human, state the specific review, decision, or manual action requested, its relevant context, and what it will unblock.
Do not substitute a list of all remaining todos for that concrete request.
Reassess the assignment when the next actor changes.

Resolve the email through `GET /api/workspaces/projektor` before assigning, as described in [task maintenance](../SKILL.md#maintain-tasks).
Read the current membership rather than assuming that either account is available.
If the intended AI member is absent, report the blocked assignment without assigning the human as a substitute.
Do not invite the AI account or change workspace access without explicit user approval.
