### Worktree and simulator cleanup

1. Record free space on the target volume. Run the [local worktree audit](../scripts/worktree-audit.sh) with `-b <base-ref> <repo-path>`. The output is a local snapshot, not permission to delete. A squash merge need not be an ancestor.
2. Check the current PR and remote head with the configured forge, and compare each path with active or pinned Orca workspaces and assigned workers via [Orca runtime](../references/orca.md). Unknown usage, unpushed commits, open PRs, locks, detached heads, or local files are reasons to hold.
3. Show the proposed paths, evidence, size, and exact state to the operator. Do not discard tracked, untracked, or ignored files without explicit approval. Recheck immediately before removing an approved clean worktree through the owning workspace manager. Do not force removal if the check fails.
4. Inventory simulator devices, runtimes, or build caches separately only when in scope. Name each proposed target, recoverability, and expected benefit before asking for removal approval.

**Reply:** free space before and after, removed paths, and why each remaining candidate was held.
