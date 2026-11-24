# rules/force-string-empty

Use String.isEmpty and String.isNonEmpty for empty strings.

## Purpose and behavior

The rule reports equality and inequality comparisons with an empty string on either side. The rule ignores non-empty string literals and numeric comparisons.

## Options

No configurable options. Enable with `"rules/force-string-empty": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (s === "") {
}
```

## Valid example

```tsx
import { String } from "effect";
if (String.isEmpty(s)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/force-string-empty -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[force-string-empty.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-string-empty.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-string-empty.test.ts)
