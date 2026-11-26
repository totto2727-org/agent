### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.**

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero).
2. Use [Orca runtime](../references/orca.md) to check whether this run can wait for an event or schedule a wake. Prefer a bounded event wait. If no wake is available, run one foreground iteration and report the resume condition.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
   Sequence the work via the [sequence-verifiable-units](../../principle-sequence-verifiable-units/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/principle-sequence-verifiable-units/SKILL.md)), verifying each unit before the next instead of batching checks at the end.
4. Mid-run discoveries that support the goal are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, orphaned follow-ups, and fixable drift yourself via poteto-mode. Report out-of-scope discoveries instead of opening unrelated PRs. Do not park reversible work for the human. Surface only irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end. Keep the predicate as the main drive, and return to it after each side fix.
5. Checkpoint every iteration via the [show-me-your-work](../../show-me-your-work/SKILL.md), a row for what changed and whether the predicate moved.
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.
