# MoonBit Async and Integration

This reference serves developers who compose MoonBit async I/O, task graphs, and provider adapters.
Use `moonbitlang/async` for async I/O and [MoonBit concurrency principles](../../../mbt-coding/references/concurrency.md) for ordering, ownership, and cancellation decisions.
Read the resolved dependency's public interface and tests before using concurrency limits, task handles, cancellation checks, or cleanup APIs.
Use the [official async repository](https://github.com/moonbitlang/async) and [API documentation](https://mooncakes.io/docs/moonbitlang/async) rather than version-pinned snippets in this skill.

## Independent I/O

For homogeneous independent work, use the resolved API's `all` operation rather than a sequential loop disguised as concurrent work.
Check its ordering, failure, cancellation, and concurrency-limit contract for that release.
Collect results without mutating shared output buffers, then apply deterministic merge and conflict rules.
For heterogeneous independent work, use a structured task group and wait for owned task results before leaving its scope.
Keep dependent operations and conflicting writes sequential.
Cap resource pressure when the workload can be large, but do not treat a concurrency limit greater than one as race prevention.
Keep the boundary's failures observable and never recover from cancellation as if it were an ordinary skippable item failure.

## Process and resource lifetime

Keep a child process, its input and output streams, and their reader tasks under one explicit owner.
Finish or cancel owned tasks before their scope returns and close resources on success, failure, and cancellation.
Do not create background work for a result that belongs to the current operation.
Use the pinned async release's documented cancellation-safe cleanup mechanism.
Keep process readiness, exit status, stream decoding, and application-level success as separate contracts.
A process that prints an address has not thereby proven HTTP health.
Verify process and filesystem capabilities on the actual target instead of inferring them from an async module declaration.

## Task graphs

Choose [Workgraph](https://github.com/totto2727-org/workgraph) only when the application needs explicit task-graph execution and routing.
Do not introduce a graph framework for a straightforward sequence of function calls.
Workgraph's executor is intentionally sequential: preserve node execution order, reduction before routing, and invocation-local resource ownership.
Do not parallelize graph nodes merely because the implementation uses async APIs or its graph appears independent.
An individual node can use independent I/O only when that preserves the node contract and the executor's sequencing guarantees.
Keep dynamic heterogeneous storage limited to a real graph or extension requirement rather than replacing explicit domain fields everywhere.

## SDK and provider boundaries

Use a provider-neutral contract with provider-owned adapters when multiple SDK providers must integrate.
Keep shared process lifecycle in the core SDK, provider event decoding and request formats in the provider SDK, and concrete provider selection in the consuming application.
Use the existing [core SDK CLI API](https://mooncakes.io/docs/totto2727/agent-core-sdk/cli) as an entry point when that SDK is already selected.
Do not turn this boundary into a universal MoonBit runtime or mandate one SDK for unrelated applications.
Keep provider executables and credentials at the application or integration-test boundary.
Check each provider package's target restrictions, especially native-only process-lifecycle packages, independently of the module's declared targets.

## Verification

Use [mbt-test](../../../mbt-test/SKILL.md) for observable tests of ordering, deterministic conflict handling, failure propagation, cancellation, and cleanup.
Use local process fixtures for lifecycle tests and isolate tests that require provider executables or external services.
For Workgraph, assert sequential execution and reduction/routing order rather than using concurrency as the success criterion.
For each SDK adapter, verify the event conversion and the process ownership contract on the promised target.
