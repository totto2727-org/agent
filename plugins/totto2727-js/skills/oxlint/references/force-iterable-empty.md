# rules/force-iterable-empty

Use Iterable.isEmpty rather than size-based emptiness checks.

## Purpose and behavior

The rule checks Iterable.size calls compared with 0 or 1 using the [force-array-empty](force-array-empty.md) criteria. The rule ignores bracket calls, other namespaces and other thresholds. Use `!Iterable.isEmpty(xs)` for a non-empty check.

## Options

No configurable options. Enable with `"rules/force-iterable-empty": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (Iterable.size(xs) === 0) {
}
```

## Valid example

```tsx
if (Iterable.isEmpty(xs)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/force-iterable-empty -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[force-iterable-empty.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-iterable-empty.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/force-iterable-empty.test.ts)
