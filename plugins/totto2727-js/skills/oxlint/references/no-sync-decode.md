# rules/no-sync-decode

Keep Schema decoding in Effect or Exit rather than Sync or Promise.

## Purpose and behavior

The rule reports Schema.decodeSync, decodePromise, decodeUnknownSync and decodeUnknownPromise calls. Use decodeEffect or decodeUnknownEffect, or decodeExit when appropriate. The rule ignores other namespaces.

## Options

No configurable options. Enable with `"rules/no-sync-decode": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
Schema.decodeSync(schema)(input);
```

## Valid example

```tsx
Schema.decodeEffect(schema)(input);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-sync-decode -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-sync-decode.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-sync-decode.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-sync-decode.test.ts)
