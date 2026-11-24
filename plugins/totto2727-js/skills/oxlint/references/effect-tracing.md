# rules/effect-tracing

Keep tracing in the application.

## Purpose and behavior

Keep `Effect.gen` generator callbacks anonymous in every mode. Applications use `Effect.fn`. The application mode reports `Effect.fnUntraced` and `Effect.fnUntracedEager`. Libraries use `Effect.fnUntraced`. The library mode reports `Effect.withSpan` and `Effect.withSpanScoped`.

## Options

Set `["error", "application"]` or `["error", "library"]`. The application and library presets set their respective modes. The shared preset leaves the mode unset. Without a mode, only the `Effect.gen` check runs.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { Effect } from "effect";
Effect.gen(function* load() {});
```

## Valid example

```tsx
import { Effect } from "effect";
Effect.gen(function* () {});
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/effect-tracing -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[effect-tracing.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/effect-tracing.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/effect-tracing.test.ts)
