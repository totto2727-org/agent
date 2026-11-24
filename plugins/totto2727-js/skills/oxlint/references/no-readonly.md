# rules/no-readonly

Derive immutable data types from Effect Schema.

## Purpose and behavior

Reports `readonly` on class and type members, constructor parameter properties, mapped types (including `-readonly`), and array or tuple type operators. It does not report the `Readonly<T>` utility type.

## Options

No configurable options. Enable with `"rules/no-readonly": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
type User = { readonly name: string };
```

## Valid example

```tsx
const UserSchema = Schema.Struct({ name: Schema.String });
type User = typeof UserSchema.Type;
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-readonly -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-readonly.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-readonly.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-readonly.test.ts)
