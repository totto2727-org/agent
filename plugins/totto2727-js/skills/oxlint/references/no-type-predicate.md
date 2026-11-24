# rules/no-type-predicate

Use Schema validation instead of handwritten type predicates.

## Purpose and behavior

Reports TypeScript type predicate syntax, including `value is User` and `asserts value`. A `boolean` return annotation is allowed. Use `Schema.is` if you need validation and type narrowing.

## Options

No configurable options. Enable with `"rules/no-type-predicate": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const isUser = (value: unknown): value is User => true;
```

## Valid example

```tsx
const isUser = Schema.is(User);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-type-predicate -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-type-predicate.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-type-predicate.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-type-predicate.test.ts)
