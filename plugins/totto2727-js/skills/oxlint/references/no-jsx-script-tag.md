# rules/no-jsx-script-tag

Avoid native script elements in JSX.

## Purpose and behavior

The rule reports lowercase `<script>` JSX elements. It allows components such as `<Script>`. Use your framework’s script integration.

## Options

No configurable options. Enable with `"rules/no-jsx-script-tag": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const el = <script>alert(1)</script>;
```

## Valid example

```tsx
const el = <Script />;
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-jsx-script-tag -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-jsx-script-tag.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-jsx-script-tag.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-jsx-script-tag.test.ts)
