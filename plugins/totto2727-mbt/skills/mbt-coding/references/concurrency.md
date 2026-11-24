# MoonBit Concurrency

Use the [async stack decision](../../mbt-stack/SKILL.md#async-work) to choose between direct structured I/O and a sequential Workgraph executor. Consult [moonbitlang/async](https://github.com/moonbitlang/async) for the API supported by the resolved version.

- Keep work sequential when a later step consumes an earlier result or an externally visible side effect. Scope independent tasks to the operation that owns their results, failures, and cleanup.
- Partition shared outputs by path, checkout, lockfile, or cache entry before scheduling concurrent writes. A concurrency limit alone cannot prevent conflicting writes.
- Collect independent results without concurrently mutating a shared array. Preserve ordering when consumers depend on it.
- Propagate cancellation instead of treating it as an item failure. Recover from an ordinary failure only when skipping or replacing that item is part of the contract. Finish or cancel owned tasks before returning.

Use [mbt-test](../../mbt-test/SKILL.md) to verify observable ordering, conflict resolution, failure propagation, cancellation, and cleanup.
