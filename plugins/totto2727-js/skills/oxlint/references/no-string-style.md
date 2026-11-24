# rules/no-string-style

Use JSX object styles instead of string styles.

## Purpose and behavior

The rule reports literal string JSX style attributes, such as style="color:red". The rule does not check strings inside braces or string variables. It allows object expressions and does not validate CSS properties.

## Options

No configurable options. Enable with `"rules/no-string-style": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
const el = <div style="color: red" />;
```

## Valid example

```tsx
const el = <div style={{ color: "red" }} />;
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-string-style -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-string-style.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-string-style.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-string-style.test.ts)
