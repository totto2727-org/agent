# Dock Queue maintenance

Use dependency-free Node 24 ESM and run `node --test test/*.test.mjs`.
Keep the public `render` and `authorize` functions and their signatures.
The release check contract in `ci-contract.mjs` is intentional: Node 24 and the builtin test runner, without install steps.
Preserve authorization even when rendering empty input. Keep authentication and release-check changes out of a formatting fix.
Document output semantics in README.md and docs/output.md.
