# rules/no-redundant-alias

Avoid aliases that only rename an existing value or type.

## Purpose and behavior

The rule reports plain type-reference aliases without type parameters or arguments. It also reports exported variables whose identifier initializer only renames a value. Local variables and type transformations are outside its scope. Re-export values directly. Give a suppression reason for aliases at an application boundary.

## Options

No configurable options. Enable with `"rules/no-redundant-alias": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
type SentEmail = SendParams;
export const sentEmail = sendParams;
```

## Valid example

```tsx
export { sendParams as sentEmail } from "./send.ts";
type SentEmail = { id: string };
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-redundant-alias -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-redundant-alias.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-redundant-alias.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-redundant-alias.test.ts)
