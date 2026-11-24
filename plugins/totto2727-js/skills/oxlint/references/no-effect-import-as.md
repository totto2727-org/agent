# rules/no-effect-import-as

Keep Effect imports named and unaliased.

## Purpose and behavior

The rule reports namespace imports and renamed named imports from effect and @effect packages. The rule allows direct named imports and does not check other aliases.

## Options

No configurable options. Enable with `"rules/no-effect-import-as": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import * as Effect from "effect";
import { Schema as S } from "effect";
```

## Valid example

```tsx
import { Effect, Schema } from "effect";
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-effect-import-as -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-effect-import-as.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-import-as.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-import-as.test.ts)
