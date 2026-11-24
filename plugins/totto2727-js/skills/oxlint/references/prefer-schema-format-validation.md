# rules/prefer-schema-format-validation

Put input format checks in a named Schema.

## Purpose and behavior

Reports regex literal `.test()` checks in `if` guards that throw or use `return yield* new …`. It also recognizes negation and `||`, but not a regex stored in a variable. Keep related length or range constraints in the same schema.

## Options

No configurable options. Enable with `"rules/prefer-schema-format-validation": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
if (!/^[a-z]+$/u.test(input)) throw new InvalidInput();
```

## Valid example

```tsx
const Slug = Schema.String.check(Schema.isPattern(/^[a-z]+$/u));
const decodeSlug = Schema.decodeUnknownEffect(Slug);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/prefer-schema-format-validation -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[prefer-schema-format-validation.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-schema-format-validation.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-schema-format-validation.test.ts)
