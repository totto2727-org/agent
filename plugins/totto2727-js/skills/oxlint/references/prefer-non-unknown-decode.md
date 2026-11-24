# rules/prefer-non-unknown-decode

Use typed Schema decoders for input that matches the encoded type.

## Purpose and behavior

The rule reports Schema.decodeUnknownEffect and Schema.decodeUnknownExit calls. If the input type matches the schema’s encoded type, use decodeEffect or decodeExit. The rule does not infer types. For unknown external data, give a suppression reason.

## Options

No configurable options. Enable with `"rules/prefer-non-unknown-decode": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
Schema.decodeUnknownEffect(Schema.String)("ready");
```

## Valid example

```tsx
Schema.decodeEffect(Schema.String)("ready");
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/prefer-non-unknown-decode -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[prefer-non-unknown-decode.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-non-unknown-decode.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/prefer-non-unknown-decode.test.ts)
