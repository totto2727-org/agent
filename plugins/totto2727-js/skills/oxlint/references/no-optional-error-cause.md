# rules/no-optional-error-cause

Make a tagged error’s cause required if the error declares one.

## Purpose and behavior

Reports optional `cause` fields on recognized Effect Data and Schema tagged error classes. This includes `cause?` in types or class bodies and Schema fields using `optional` or `optionalKey`. It does not check native error constructor options.

## Options

No configurable options. Enable with `"rules/no-optional-error-cause": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
import { Data } from "effect";
class Failure extends Data.TaggedError("Failure")<{ cause?: unknown }> {}
```

## Valid example

```tsx
import { Data } from "effect";
class Failure extends Data.TaggedError("Failure")<{ cause: unknown }> {}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-optional-error-cause -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-optional-error-cause.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-optional-error-cause.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-optional-error-cause.test.ts)
