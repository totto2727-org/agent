# rules/require-tagged-data

Use Effect constructors to define tagged data.

## Purpose and behavior

Reports hand-written `_tag` keys in objects, classes, and type members, including literal brackets. Use `Data.TaggedClass`, `Data.taggedEnum`, `Schema.TaggedClass`, or `Schema.TaggedStruct` to generate the tag.

## Options

No configurable options. Enable with `"rules/require-tagged-data": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
type State = { _tag: "Ready"; value: string };
```

## Valid example

```tsx
class Ready extends Data.TaggedClass("Ready")<{ value: string }> {}
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/require-tagged-data -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[require-tagged-data.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-tagged-data.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/require-tagged-data.test.ts)
