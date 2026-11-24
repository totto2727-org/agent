# rules/require-vitest-hooks

Run shared test setup and cleanup in hooks.

## Purpose and behavior

Checks standalone expressions at test module scope and in suite callback blocks. Recognizes imports from `vitest`, `vite-plus/test`, and `@effect/vitest`. Test, suite, hook, and mock registrations are allowed. Keep per-test values inside tests.

## Options

No configurable options. Enable with `"rules/require-vitest-hooks": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { test } from "vitest";
resetDb();
test("reads data", run);
```

## Valid example

```tsx
import { beforeEach, test } from "vitest";
beforeEach(resetDb);
test("reads data", run);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/require-vitest-hooks -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[require-vitest-hooks.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-vitest-hooks.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-vitest-hooks.test.ts)
