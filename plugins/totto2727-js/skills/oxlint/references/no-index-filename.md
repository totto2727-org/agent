# rules/no-index-filename

Give modules descriptive filenames.

## Purpose and behavior

Checks the basename, not the source text. Only `index.ts` and `index.tsx` are reported. Rename the file and update its importers.

## Options

No configurable options. Enable with `"rules/no-index-filename": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
// Filename: src/feature/index.ts
export const feature = true;
```

## Valid example

```tsx
// Filename: src/feature.ts
export const feature = true;
```

## Fixes and exceptions

No automatic fix.

The rule reports line 1. If a tool requires this filename, turn off the rule for that path in your Oxlint config.

## Source and tests

[no-index-filename.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-index-filename.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-index-filename.test.ts)
