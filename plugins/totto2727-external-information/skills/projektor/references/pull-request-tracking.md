# Reconcile open pull requests

Use this procedure when the user requests PR tracking or an audit, within the authorized repository and workspace scope.
A PR needs at least one corresponding task, not exactly one task per PR.
One task may cover several PRs when their actual work belongs to the same scope.

1. Apply the user's scope exclusions before identifying PRs that need tasks.
   For the workspace slug `projektor`, use the [named-workspace policy](projektor-workspace.md#dependency-maintenance-exclusion).
   Enumerate the complete requested open-PR scope through the connected repository service, including all result pages.
   Record the full repository owner/name and canonical PR URL, then deduplicate by that identity.
   Do not restrict an all-open-PR audit to the current repository or the first search page.
   Record excluded PRs and the reason for exclusion separately, and do not count them as missing tasks.
   Report inaccessible owners, repositories, truncated searches, and permission limits as uncovered scope.
2. Enumerate all ticket pages in the selected workspace, including completed and duplicate records needed to understand existing links.
   Read full bodies for candidate matches because list responses omit them by default.
   Select the project by the actual repository identity and project scope, not a shared repository basename across different owners.
3. Compare each PR's actual changes and remaining work with candidate tasks.
   Reuse a relevant task only when it directly tracks that scope.
   An incidental PR mention, historical reference, or duplicate ticket does not count as active tracking.
   Follow duplicate links to the canonical task and assess that task itself.
   A completed task with no remaining tracking for an open PR is not sufficient merely because it contains the URL.
4. For uncovered PRs, create a scoped task when writes are authorized, or report the missing task in a read-only audit.
   Update or reopen an existing canonical task only when its actual scope and remaining work justify that change.
   Preserve history rather than deleting duplicates or replacing prior evidence.
   Do not create or reopen tasks for excluded PRs without an explicit request that covers that work.
5. Record the canonical PR URL in each corresponding task.
   When supported and authorized, add the ticket URL or reference to the PR so that tracking works in both directions.
   Preserve unrelated PR text and report any link that could not be saved.
6. Set state and assignment from the next actual actor under the applicable workspace policy, then verify each saved change with a read.
   Report the PR-to-task mapping, reused or created tickets, remaining gaps, and assignment or verification blockers.
   Do not claim complete coverage while any requested scope remains inaccessible or unexamined.
