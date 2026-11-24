# rules/no-fetch

Use Effect HttpClient instead of calling global fetch.

## Purpose and behavior

The rule reports fetch(), globalThis.fetch(), window.fetch() and self.fetch(). The rule ignores other client.fetch calls and references without a call. Use HTTP services that preserve typed errors.

## Options

No configurable options. Enable with `"rules/no-fetch": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
fetch("https://example.com");
```

## Valid example

```tsx
httpClient.get("https://example.com");
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-fetch -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-fetch.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-fetch.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-fetch.test.ts)
