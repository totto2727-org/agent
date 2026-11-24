# rules/require-disable-reason

Require a reason for each Oxlint suppression.

## Purpose and behavior

The rule requires a non-empty reason after -- in oxlint-disable, oxlint-disable-line and oxlint-disable-next-line comments. A rule list alone does not satisfy the rule. Write the reason yourself.

## Options

No configurable options. Enable with `"rules/require-disable-reason": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
// oxlint-disable-next-line no-fetch
fetch("x");
```

## Valid example

```tsx
// oxlint-disable-next-line no-fetch -- external API boundary
fetch("x");
```

## Fixes and exceptions

No automatic fix.

## Source and tests

[require-disable-reason.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-disable-reason.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-disable-reason.test.ts)
