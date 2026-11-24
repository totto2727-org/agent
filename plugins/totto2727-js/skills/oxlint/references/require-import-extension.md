# rules/require-import-extension

Require explicit extensions without guessing module resolution.

## Purpose and behavior

The rule reports missing extensions in relative paths and # aliases containing a slash, including directory paths. It checks static imports, re-exports and literal dynamic imports. The rule cannot choose .ts, .tsx or an index filename and provides no fix. It ignores bare packages, absolute paths and slashless aliases such as #utils. It allows explicit asset extensions. Use [consistent-import-extension](consistent-import-extension.md) to normalize extensions.

## Options

No configurable options. Enable with `"rules/require-import-extension": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { foo } from "./foo";
```

## Valid example

```tsx
import { foo } from "./foo.ts";
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/require-import-extension -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[require-import-extension.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-import-extension.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-import-extension.test.ts)
