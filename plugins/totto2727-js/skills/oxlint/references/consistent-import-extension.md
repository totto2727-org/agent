# rules/consistent-import-extension

Normalize code-module import extensions for your runtime.

## Purpose and behavior

The rule checks relative paths and # subpath aliases containing a slash in static imports, re-exports and literal dynamic imports. In ts mode, .js/.jsx become .ts/.tsx, .mjs becomes .mts and .cjs becomes .cts. In js mode, .js/.jsx/.ts/.tsx become .js, .mjs/.mts become .mjs and .cjs/.cts become .cjs. Use [require-import-extension](require-import-extension.md) for missing extensions. The rule ignores asset extensions, bare packages and absolute paths. Fixes preserve query strings, fragments and quotes. Slashless aliases such as #utils are outside its scope.

## Options

`{ mode: "ts" }` is the default. Use `{ mode: "js" }` for emitted JavaScript. Example: `["error", { "mode": "js" }]`. The import examples below use ts mode. Check runtime module resolution before applying fixes.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { foo } from "./foo.js";
```

## Valid example

```tsx
import { foo } from "./foo.ts";
```

## Fixes and exceptions

Review the automatic fix before applying it.

Add `// oxlint-disable-next-line rules/consistent-import-extension -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[consistent-import-extension.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/consistent-import-extension.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/consistent-import-extension.test.ts)
