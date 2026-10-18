# Nix Packages

Use this reference when a project must produce a Nix-consumable artifact.
Keep [shared distribution checks](../../../share-stack/SKILL.md#verify-the-promised-result) and the selected language stack authoritative for the promised consumer behavior.

## Select the existing builder

Prefer the ecosystem builder already supported by the repository's pinned Nixpkgs or overlay.
Examples include `buildGoModule`, `rustPlatform.buildRustPackage`, and the repository's Haskell package set.
Do not replace upstream dependency declarations or compilers merely to use a preferred local builder.
Keep dependency sources, lockfiles, and output hashes consistent with the chosen builder.
When a hash changes, establish the expected source change instead of accepting an unexplained value.

For JavaScript and TypeScript application packages, use Bun to build the application.
This does not change the [JS stack's](../../../js-stack/SKILL.md) pnpm dependency-management default.
Keep the project's authoritative package manager and dependency lock.
Use a dependency-fetching method that matches that lock and the repository's pinned builder.
An existing Bun-managed project can retain its Bun lock and bun2nix configuration, but that is not a reason to migrate other projects' package managers.

## Build isolation

Declare required build inputs, environment variables, dependency sources, and install outputs.
Do not depend on a global package cache, an undeclared executable, network access in a sandboxed build, or secrets embedded in the derivation.
Keep generated dependency-source files aligned with their authoritative lockfile.
Do not create a second independent dependency-resolution flow to satisfy the Nix builder.

If a builder copies an immutable dependency cache into its writable build directory, apply a required permission fix only to that build-local copy.
Never make the Nix store or a user's global cache writable as a workaround.
Do not disable dependency-age safeguards to obtain a build.

## Install and exercise the artifact

Install only the outputs promised to consumers.
Keep native executables, npm distributions, source artifacts, and development shells distinct.
For a claimed standalone executable, run the installed binary without undeclared language runtimes on `PATH`.
For a library, check the package contents and its actual supported consumer entry point.
Run the check for each supported platform affected by the change, or report the unverified platforms.
Keep publication and live deployment outside a local build unless separately authorized.

Use the [Nixpkgs builder reference](https://nixos.org/manual/nixpkgs/stable/) and the selected builder's official documentation for exact options.
