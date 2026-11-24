### Feature

**You own the design. Plan, review, verify.** Delegate implementation. Stay in the lead.

1. Trace the affected subsystem.
2. [architect](../../architect/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/architect/SKILL.md)) for the shape.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target (the [separate-before-serializing-shared-state](../../principle-separate-before-serializing-shared-state/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/principle-separate-before-serializing-shared-state/SKILL.md))). Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why.
4. Give each available worker the owned paths, data model, and acceptance check via [Orca runtime](../references/orca.md). For genuinely competing designs, compare independent implementations using [arena](../../arena/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/arena/SKILL.md)). If independent workers are unavailable, implement the selected design in the current session and report the missing comparison. Recheck shared primitives against every affected consumer.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
6. Rebase into small, ordered commits. Stack follow-ups.
   Use the [sequence-verifiable-units](../../principle-sequence-verifiable-units/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/principle-sequence-verifiable-units/SKILL.md)), building, verifying, and committing each small unit before the next.
7. If the design is contested, [interrogate](../../interrogate/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/interrogate/SKILL.md)) before shipping.
8. When publication is in scope, follow [Opening a PR](opening-a-pr.md).

Code-coupled work (one feature, one migration) goes to a single owner with the checkpoint inline. A coordinator can assign independent follow-up tasks after the blocking phase. Workers return their changes without assuming nested delegation. Parent-level fan-out is for slices that produce independent artifacts (audits, cross-subsystem investigations, competing experiments). Rewrite the checkpoint at phase boundaries. Spawn a fresh owner rather than chaining interrupts.

**Reply:** what you built, what you chose and why, the throughput checkpoint, open decisions. Tables for design alternatives.
