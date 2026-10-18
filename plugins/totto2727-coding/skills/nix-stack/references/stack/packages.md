# Nix Packages

## JavaScript applications

Use Bun for the Nix application build, with [pnpm as the default dependency manager](../../../js-stack/references/stack/share.md#package-manager).
Select a dependency fetcher that supports the authoritative lockfile.
Do not add a second lockfile or dependency-resolution flow for Nix.
Existing Bun-managed projects can retain bun2nix.

> [!CAUTION]
> A copied dependency cache can retain read-only permissions from the Nix store.
> Apply necessary permission changes only to the build-local copy, never the store or a user's global cache.

Reference: [Nixpkgs builders](https://nixos.org/manual/nixpkgs/stable/).
