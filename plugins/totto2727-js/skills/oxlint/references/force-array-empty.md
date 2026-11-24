# rules/force-array-empty

Use Effect Array predicates for empty and non-empty checks.

## Purpose and behavior

The rule reports .length comparisons with 0 or 1 that test emptiness, including reversed operands. The rule ignores other thresholds, impossible negative checks and always-true checks. It checks syntax, not whether the receiver is an array.

## Options

No configurable options. Enable with `"rules/force-array-empty": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (arr.length === 0) {
}
```

## Valid example

```tsx
import { Array } from "effect";
if (Array.isArrayEmpty(arr)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/force-array-empty -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[force-array-empty.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-array-empty.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-array-empty.test.ts)
