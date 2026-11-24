# rules/no-instanceof-error

Avoid normalizing caught values using instanceof Error.

## Purpose and behavior

The rule reports instanceof when its right operand is the Error identifier. The rule ignores other constructors, including TypeError. Store unknown caught values unchanged in a structured error field.

## Options

No configurable options. Enable with `"rules/no-instanceof-error": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const isError = error instanceof Error;
```

## Valid example

```tsx
new ConfigFileError({ error });
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-instanceof-error -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-instanceof-error.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-instanceof-error.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-instanceof-error.test.ts)
