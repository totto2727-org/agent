# rules/force-predicate

Replace direct null, undefined and typeof comparisons with predicates.

## Purpose and behavior

The rule reports null/undefined equality checks and supported typeof string comparisons. The rule ignores numeric comparisons. With prefer-is-nullish enabled, use Predicate.isNullish or isNotNullish unless you need to distinguish null from undefined.

## Options

No configurable options. Enable with `"rules/force-predicate": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (typeof x === "string") {
}
```

## Valid example

```tsx
if (Predicate.isString(x)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/force-predicate -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[force-predicate.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-predicate.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-predicate.test.ts)
