# rules/no-error-property-access

Pass raw error values through without inspecting their properties.

## Purpose and behavior

Reports dot or bracket access on a `catch` binding or the first `catch` callback parameter in a recognized `Effect.try` or `Effect.tryPromise` call. It tracks bindings, not names. Keep the original value as a tagged error’s `cause`.

## Options

No configurable options. Enable with `"rules/no-error-property-access": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
try {
  load();
} catch (cause) {
  log(cause.message);
}
```

## Valid example

```tsx
try {
  load();
} catch (cause) {
  throw new ConfigFileError({ cause });
}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-error-property-access -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-error-property-access.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-error-property-access.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-error-property-access.test.ts)
