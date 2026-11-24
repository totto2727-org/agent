# rules/no-node-imports

Prefer Effect Platform services over direct Node built-ins.

## Purpose and behavior

The rule checks static imports and re-exports beginning with node:. The allowlist matches exact names after node:, so fs does not allow fs/promises. The rule ignores bare fs, dynamic imports and require calls.

## Options

Without options, the rule allows no node: imports. Set a string array, `{ allow: string[] }` or `{ allowed: string[] }`. The rule combines allow and allowed. Example: `["error", { "allow": ["path", "fs/promises"] }]`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { readFile } from "node:fs/promises";
```

## Valid example

```tsx
import { FileSystem } from "effect";
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-node-imports -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-node-imports.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-node-imports.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-node-imports.test.ts)
