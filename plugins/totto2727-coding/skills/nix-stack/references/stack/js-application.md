# Nix JS Application Stack

| Role                   | Selection                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Dependencies           | [pnpm](../../../js-stack/references/stack/share.md#package-manager), with `pnpm-lock.yaml`. |
| Dependency acquisition | A fetcher compatible with the authoritative pnpm lockfile.                                  |
| Application build      | [Bun](https://bun.sh/docs/bundler).                                                         |
| Package                | Nix derivation.                                                                             |

- Do not add a second lockfile or dependency-resolution flow for Nix.
- Treat the package build as unverified until the selected fetcher and Bun build pass in the Nix sandbox.
- Scope: JS/TS application packages, not library packages or Alchemy-owned host builds.

> [!CAUTION]
>
> - Store-derived caches can retain read-only permissions.
> - Change permissions only on the build-local copy, not the Nix store or a user's global cache.
