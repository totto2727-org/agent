# rules/no-bigint-literals

Replace a BigInt literal with a `BigInt()` call. Use a string argument so a value beyond JavaScript's safe integer range never passes through a `number`.

For example, change `9_007_199_254_740_993n` to `BigInt("9007199254740993")`. Review the automatic fix when the original spelling uses another radix or a unary minus.

[Implementation](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/no-bigint-literals.ts) · [Acceptance cases](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/rules.test.ts)
