# Parcel Peek maintenance

This is a dependency-free Node 24 ESM fixture, not the parent repository's toolchain.
Run `node --test test/*.test.mjs` from this repository.
Keep the injected transport boundary in `runtime.mjs` and the exported CLI parser in `cli.mjs`.
Preserve timeout validation, managed-profile concurrency, and authorization forwarding.
Change consumer guidance in README.md when CLI options change.
