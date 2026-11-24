# rules/no-let

Use const bindings instead of let.

## Purpose and behavior

The rule reports each `let` declaration once. It ignores `var`. If you reassign a variable, refactor the code or give a reason for an exception.

## Options

No configurable options. Enable with `"rules/no-let": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
let x = 1;
```

## Valid example

```tsx
const x = 1;
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-let -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-let.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-let.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-let.test.ts)
