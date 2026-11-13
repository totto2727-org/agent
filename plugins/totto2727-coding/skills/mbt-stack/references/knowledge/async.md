# MoonBit Async and Integration

- Audience: advanced consumers composing [moonbitlang/async](https://mooncakes.io/docs/moonbitlang/async) with task graphs or provider processes.
- Selection: [MoonBit baseline](../stack/share.md#capability-additions).

## Independent I/O

- Homogeneous independent work: `all`.
- Heterogeneous work: structured task group.
- Verify ordering, failure, cancellation, and concurrency-limit semantics in the resolved release.

## Process and resource lifetime

- Process streams and reader tasks: pinned release's cancellation-safe cleanup API.
- Verify process readiness, exit status, stream decoding, and application success separately.
- Process and filesystem support: [target-specific evidence](../stack/share.md#target-capability-proof), not only a module declaration.

## Task graphs

- [Workgraph](https://github.com/totto2727-org/workgraph): sequential executor, with reduction before routing.
- No parallel node execution inferred from async APIs or independent nodes.
- Independent I/O within a node must preserve the executor sequence and invocation-local resource ownership.

## SDK and provider boundaries

- Existing [agent-core-sdk](https://mooncakes.io/docs/totto2727/agent-core-sdk/cli) consumers: core owns process lifecycle.
- Provider adapters own event decoding and request formats.
- Application selects concrete providers.
- Verify native-only provider packages separately from module-level target declarations.
