# rules/no-eslint-disable-comments

Use Oxlint suppression directives instead of ESLint directives.

## Purpose and behavior

The rule detects eslint-disable, eslint-disable-line and eslint-disable-next-line in line and block comments. Fixes replace the directive name and keep the rule list and reason. To require a reason for each suppression, also enable [require-disable-reason](require-disable-reason.md).

## Options

No configurable options. Enable with `"rules/no-eslint-disable-comments": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
// eslint-disable-next-line no-console
console.log(1);
```

## Valid example

```tsx
// oxlint-disable-next-line no-console -- boundary logging
console.log(1);
```

## Fixes and exceptions

Review the automatic fix before applying it.

Add `// oxlint-disable-next-line rules/no-eslint-disable-comments -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-eslint-disable-comments.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-eslint-disable-comments.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-eslint-disable-comments.test.ts)
