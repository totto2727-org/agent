# rules/prefer-is-nullish

Treat null and undefined uniformly unless the distinction is intentional.

## Purpose and behavior

The rule reports Predicate.isNull, isNotNull, isUndefined and isNotUndefined member access, including references without calls. Use isNullish or isNotNullish. Give a suppression reason when a boundary requires the distinction between null and undefined.

## Options

No configurable options. Enable with `"rules/prefer-is-nullish": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (Predicate.isNull(x)) {
}
```

## Valid example

```tsx
if (Predicate.isNullish(x)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/prefer-is-nullish -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[prefer-is-nullish.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-is-nullish.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-is-nullish.test.ts)
