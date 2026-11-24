# rules/no-import-from-barrel-package

For a named value or namespace import from a relative index module, import from the defining module instead. For example, replace `import { parse } from "./index.ts"` with `import { parse } from "./parse.ts"` when `parse.ts` owns that export.

Type-only imports are not value imports. The default also recognizes directory imports that resolve to an index. `checkRelativeIndexImports` controls that check. `checkPatterns` can extend the check to package specifiers.
Do not guess a private package subpath. With the shared preset, Effect package roots are allowed by this rule unless the consumer adds a matching pattern.

[Implementation](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/no-import-from-barrel-package.ts) · [Acceptance cases](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/rules.test.ts)
