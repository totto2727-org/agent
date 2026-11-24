# rules/no-for-loops

Use collection or Effect combinators for iteration.

## Purpose and behavior

The rule reports classic `for`, `for...of`, `for await...of`, and `for...in`, but not `while`. Use Array or Iterable combinators for synchronous iteration, `Effect.forEach` for effects, or `Stream.runForEach` for streams. Use `Object.keys` or `Object.entries` for own properties.

## Options

No configurable options. Enable with `"rules/no-for-loops": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
for (const value of values) visit(value);
```

## Valid example

```tsx
import { Iterable } from "effect";

Iterable.forEach(values, visit);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-for-loops -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-for-loops.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-for-loops.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-for-loops.test.ts)
