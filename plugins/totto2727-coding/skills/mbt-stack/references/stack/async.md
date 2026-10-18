# MoonBit Async and Integration

Use [moonbitlang/async](https://github.com/moonbitlang/async) for async I/O and its [API documentation](https://mooncakes.io/docs/moonbitlang/async) for the resolved release.
Use [concurrency principles](../../../mbt-coding/references/concurrency.md) for language-level contracts.

## Independent I/O

Use `all` for homogeneous independent work and a structured task group for heterogeneous work.
Before API selection, examine the resolved release's ordering, failure, cancellation, and concurrency-limit semantics.
A concurrency limit greater than one does not prevent races.

## Process and resource lifetime

Use the pinned async release's cancellation-safe cleanup API for process streams and reader tasks.
Process readiness, exit status, stream decoding, and application success are separate contracts.
An address printed by a child process does not prove HTTP health.
Process and filesystem support need [target-specific evidence](share.md#target-capability-proof), not only a module declaration.

## Task graphs

Use [Workgraph](https://github.com/totto2727-org/workgraph) only for explicit task-graph execution and routing.
Its executor is intentionally sequential, with reduction before routing.
Async APIs and apparently independent nodes are not grounds for parallel node execution.
Independent I/O within a node must keep that sequence and invocation-local resource ownership.

## SDK and provider boundaries

For multiple providers, keep process lifecycle in the core SDK and event decoding and request formats in provider adapters.
The consuming application selects concrete providers.
When already selected, use the [core SDK CLI API](https://mooncakes.io/docs/totto2727/agent-core-sdk/cli).
This is not a universal MoonBit runtime or a mandatory SDK choice.
Examine native-only provider packages separately from their module's declared targets.
