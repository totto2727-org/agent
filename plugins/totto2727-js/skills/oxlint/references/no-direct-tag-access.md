# rules/no-direct-tag-access

Use predicates or pattern matching instead of reading `_tag`.

## Purpose and behavior

Reports dot and literal bracket access, optional chaining, destructuring, and `"_tag" in value`. It checks syntax, not receiver types. Use Option, Result, or Exit predicates, or `Match.tag` for domain values.

## Options

No configurable options. Enable with `"rules/no-direct-tag-access": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (opt._tag === "Some") {
}
```

## Valid example

```tsx
if (Option.isSome(opt)) {
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-direct-tag-access -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-direct-tag-access.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-direct-tag-access.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-direct-tag-access.test.ts)
