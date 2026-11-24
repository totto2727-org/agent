---
name: js-test
description: >-
  Implement or review TypeScript tests with Vitest and Vite+. Not for manual QA or test reports.
---

# TypeScript tests

Run `vp test run <test-file>` or `vp test related <source-file>` for a focused check. Use the repository's test task for broader coverage, such as `vp run --filter <project> test`.
Import test APIs from the entry point used by the project.

- Compare the whole returned value when every field is contractual. When other fields may vary, assert only the part the caller relies on.
- If callers branch on a typed failure, test its distinguishing fields. A test that only observes rejection cannot catch a change in error identity.
- Give each test or fixture ownership of the resources it creates, including timers and mocks. A hook can be in the correct place and still leak state between cases.

Use [share-test](../share-test/SKILL.md) for test quality and [share-test-design](../share-test-design/SKILL.md) to choose evidence. For a shared setup diagnostic, use the installed oxlint skill or open its [require-vitest-hooks rule page](https://github.com/totto2727-org/oxlint/blob/main/skills/oxlint/references/require-vitest-hooks.md).

If the linked skills are not installed, read the source: [share-test](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-test/SKILL.md), [share-test-design](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-test-design/SKILL.md).
