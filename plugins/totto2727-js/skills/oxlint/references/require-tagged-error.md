# rules/require-tagged-error

Define domain errors with tagged error constructors.

## Purpose and behavior

Reports calls to, construction of, and subclassing of built-in errors and recognized Effect `Data.Error` imports. It does not report shadowed built-in names or ambient class declarations. Use `Data.TaggedError` or `Schema.TaggedErrorClass`.

## Options

No configurable options. Enable with `"rules/require-tagged-error": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
throw new Error("Invalid input");
```

## Valid example

```tsx
class InvalidInput extends Data.TaggedError("InvalidInput")<{ message: string }> {}
Effect.fail(new InvalidInput({ message: "Invalid input" }));
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/require-tagged-error -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[require-tagged-error.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-tagged-error.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-tagged-error.test.ts)
