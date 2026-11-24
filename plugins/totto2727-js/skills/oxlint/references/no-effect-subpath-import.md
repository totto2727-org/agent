# rules/no-effect-subpath-import

Prefer public Effect package roots over deep subpaths.

## Purpose and behavior

Use `effect`, an `@effect/<package>` root, or a [category entry](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-subpath-import.ts#L7-L17) such as `effect/http` or `effect/unstable/cli`. The rule reports other Effect paths except `effect/schema/SchemaJITCompiler/enable`. It ignores re-exports and dynamic imports.

## Options

No configurable options. Enable with `"rules/no-effect-subpath-import": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { Schema } from "effect/Schema";
```

## Valid example

```tsx
import { Schema } from "effect";
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-effect-subpath-import -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-effect-subpath-import.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-subpath-import.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-subpath-import.test.ts)
