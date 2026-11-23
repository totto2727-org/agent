# MoonBit Concurrency

This reference serves developers who review MoonBit ordering, task ownership, and cancellation.
Use [async stack guidance](../../mbt-stack/references/knowledge/async.md) for concrete library APIs.

## Concurrency rules

An async call suspends its caller until the call completes.
Async syntax alone does not make a loop or a sequence of calls concurrent.
Identify independent work before introducing concurrency, and preserve intentional sequencing even when operations appear independent.

### Use `@async.all` for homogeneous independent work

Use the stack's [independent I/O guidance](../../mbt-stack/references/knowledge/async.md#independent-io) for homogeneous task composition and resolved API checks.
Do not mutate a shared result array from concurrent tasks.

### Use a task group for heterogeneous independent work

Use a structured scope for work whose result or failure belongs to the current operation.
Follow the stack's [independent I/O guidance](../../mbt-stack/references/knowledge/async.md#independent-io) for task-group APIs.
Do not let owned tasks outlive their scope.

### Keep real dependencies sequential

Keep operations ordered when a later step needs the earlier step's output or side effect.
Examples include creating a directory before writing inside it and writing a lockfile before invoking its consumer.
An explicitly sequential executor is also an ordering contract, not an optimization opportunity.
Use the stack's [task-graph rules](../../mbt-stack/references/knowledge/async.md#task-graphs) when Workgraph owns execution.

### Prevent shared-resource races

Concurrent writes must not target the same mutable resource without an explicit synchronization contract.
Deduplicate identical output paths or resolve deterministic merge rules before writing.
Partition work by output directory, lockfile, checkout, or cache entry and serialize conflicting partitions.
A concurrency limit above one is not proof of race freedom.

### Preserve failure semantics

Keep task failures observable at the owning operation's boundary.
Recover from an ordinary item failure only when skipping or replacing that item is part of the documented contract.
Keep failure identity and structured context instead of logging and discarding the error.

### Preserve cancellation semantics

Propagate cancellation instead of translating it into a successful fallback or a skippable item failure.
Finish or cancel owned tasks and release their resources before their scope returns.
Use the stack's [resource-lifetime guidance](../../mbt-stack/references/knowledge/async.md#process-and-resource-lifetime) for release-specific cleanup mechanisms.

### Review the concurrency contract

Check dependency order, intentional sequential execution, shared targets, deterministic result ordering, resource limits, failure propagation, and cancellation.
Use structured concurrency for independent I/O only when the operation's contract permits it.

### Test the concurrency contract

Use [mbt-test](../../mbt-test/SKILL.md) for tests of observable ordering, conflict resolution, failure propagation, cancellation, and cleanup.
