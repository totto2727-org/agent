# rules/no-unused-internal

Read the diagnostic before removing a declaration. The rule checks production use of `@internal` exports and whether they leak through public re-exports or public type signatures.

- **Unused export:** remove the export if the declaration is private to the file. Delete the declaration if nothing needs it.
- **Public re-export:** remove the re-export instead of importing the symbol just to silence the diagnostic.
- **Public signature:** expose a public type that describes the caller's contract. If a type is intentionally public, review its API and remove the `@internal` designation rather than leaking it accidentally.

Run lint from the project workspace. A single isolated snippet cannot demonstrate whether production sources use an export.

[Implementation](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/no-unused-internal.ts) · [Multi-file acceptance cases](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/rules.test.ts)
