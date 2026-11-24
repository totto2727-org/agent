---
name: share-test
description: Decide where a maintained test belongs and what its assertions should establish.
---

# Maintained tests

## Test implementation boundaries

Use the repository's existing runner, discovery path, and fixture conventions. Do not add a CI job or parallel runner for a single test. If maintained coverage requires a new mechanism, propose it separately for approval. A one-off check in `tmp/` can support the current change but is not regression coverage.

Choose the public observation using [test behavior, not implementation](../principle-test-behavior-not-implementation/SKILL.md). For example, when a write is rejected, its response and the absence of a partial write are two assertions about one outcome. A successful write is a separate case. Keep resource creation and cleanup in the same fixture; avoid shared state that makes another case a prerequisite.

Assert the part of the result callers rely on. Compare a typed failure and its payload rather than rendered text unless the text itself is contractual. Do not widen the production API just for a test.

## Implementation choices

- CLI process boundary: use the installed [cli-e2e](https://github.com/totto2727-org/e2e/blob/main/.agents/skills/cli-e2e/SKILL.md) skill.
- TypeScript runtime: [test tools by host](../js-stack/stack/share.md#testing) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-js/skills/js-stack/stack/share.md#testing)).
