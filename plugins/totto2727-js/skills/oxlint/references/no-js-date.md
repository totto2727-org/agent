# rules/no-js-date

Use Effect DateTime and Duration instead of native Date operations.

## Purpose and behavior

The rule reports new Date() and Date.now, Date.parse or Date.UTC member access, including references without calls. The rule allows the Date identifier and Date.prototype. If an external API requires native Date, give a suppression reason.

## Options

No configurable options. Enable with `"rules/no-js-date": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const d = new Date();
```

## Valid example

```tsx
import { DateTime, Effect } from "effect";

const renderDate = Effect.gen(function* () {
  const date = yield* DateTime.now;
  return DateTime.formatIso(date);
});
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-js-date -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-js-date.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-js-date.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-js-date.test.ts)
