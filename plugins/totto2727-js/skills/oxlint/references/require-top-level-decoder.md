# rules/require-top-level-decoder

Construct and cache schema decoders at module scope.

## Purpose and behavior

The rule reports Schema.decode* and HttpClientResponse.schema* calls inside tracked functions. The rule matches names and prefixes, not types. It checks function declarations, function expressions, and arrow functions. Bracket notation, such as `Schema["decodeEffect"]`, is outside its scope. Create the decoder at module scope and call it in the function.

## Options

No configurable options. Enable with `"rules/require-top-level-decoder": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const f = () => Schema.decodeEffect(schema)(input);
```

## Valid example

```tsx
const decode = Schema.decodeEffect(schema);
const f = () => decode(input);
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/require-top-level-decoder -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[require-top-level-decoder.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-top-level-decoder.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-top-level-decoder.test.ts)
