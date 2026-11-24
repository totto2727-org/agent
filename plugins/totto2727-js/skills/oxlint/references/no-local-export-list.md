# rules/no-local-export-list

Export bindings at their declarations.

## Purpose and behavior

Reports nonempty export lists without `from`, including type exports and previously imported bindings. Use `export` on local declarations or re-export directly from another module. Empty `export {}` is allowed.

## Options

No configurable options. Enable with `"rules/no-local-export-list": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const limit = 10;
export { limit };
```

## Valid example

```tsx
export const limit = 10;
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-local-export-list -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-local-export-list.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-local-export-list.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-local-export-list.test.ts)
