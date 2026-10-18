# Shared Haskell Stack

For developers who maintain Haskell development, CI, and package distribution.
Apply [shared stack policy](../../../share-stack/SKILL.md) and [task orchestration](../../../share-stack/references/task-orchestration.md).
Keep existing application and upstream-first fork constraints instead of forcing a template migration.

## Compiler and dependency authorities

- Use the repository's pinned Nix inputs to supply GHC, cabal-install, hpack, Fourmolu, HLint, and any required Just executable.
- Select one compatible Nix Haskell package set for development and package builds, or document and verify an intentional difference.
- Check `ghc --numeric-version`, the selected `base`, and package bounds before updating the compiler.
- Retain the GHC 9.12 template profile where selected rather than replacing it globally with the Iris-compatible GHC 9.4 profile.
- Keep the Iris profile conditional as described in the [CLI stack](cli.md#iris-compatibility-profile).
- Do not mandate GHCup or introduce a second compiler pin alongside the Nix-managed compiler.
- Use `nix develop --command <command>` from the project root.
- A library's supported GHC and base range is a consumer contract, not merely the current shell compiler.

Maintain hpack input as the source and commit the generated `.cabal` file when using this profile.
Use the repository's input name, commonly `package.yaml`, without renaming a valid `hpack.yaml` coexistence profile.
Regenerate with `hpack` or `hpack hpack.yaml` as appropriate.
Do not edit the generated file as a second source of truth.
CI must detect generation drift without leaving source files modified.
Generate into a disposable copy and compare it with the committed manifest when hpack has no suitable non-mutating mode.

Use `cabal.project` for project settings and an explicit `index-state` for the package-index snapshot.
Maintain `cabal.project.freeze` for the reproducible application or test plan required by the repository.
Neither file pins the GHC executable or replaces `flake.lock`.
For reusable libraries, keep declared compatibility bounds distinct from the frozen contributor test plan.
Align immutable source revisions between Cabal and Nix when both resolve the same dependency.
Review freeze changes together with manifest and compiler changes.
Apply release-age safeguards separately, because index-state and a frozen plan do not themselves establish a waiting period for every package.
Do not bypass incompatible bounds with global `allow-newer` merely to upgrade a compiler.

## Native task mapping

Keep Cabal commands native, with a project-local Justfile for repeated multi-step procedures.
Do not add Node.js or Vite+ solely to standardize a native Haskell project's command names.
An established mixed workspace can aggregate native tasks under shared orchestration rules.

- `fix`: Regenerate the Cabal manifest after hpack changes and run `fourmolu --mode inplace` on selected source files.
- `check`: Check generation drift, run `cabal check`, `fourmolu --mode check`, and `hlint` on declared source roots, then compile the required components with `cabal build all`.
- `build`: Generate required metadata and run `cabal build all`, then produce the declared deliverable.
- `test`: Run the project's native Hspec suites with `cabal test`, selecting only default suites.

Pass actual source paths to Fourmolu and HLint rather than scanning generated directories.
Use the repository's warning policy, normally including `-Wall` and `-Wcompat`, and preserve any declared CI warning-as-error setting.
Use `--offline` only after the chosen dependency plan and sources are available locally.
Do not hide network resolution or dependency updates inside checks.
Use Hspec for native tests, with `hspec-discover` for new suites following that template.
Keep valid manual suite registration in existing projects.
Use [share-test](../../../share-test/SKILL.md) for assertions and isolation rather than duplicating those principles here.
Keep Docker or live-system E2E explicitly selected outside default tests unless the repository requires otherwise.

Order hpack generation before consumers of the generated manifest.
Serialize or isolate Cabal operations that share `dist-newstyle` instead of running competing writes concurrently.
Use the same declared commands locally and in CI.
For complex recipes, use `nix develop --command just --justfile ./Justfile <recipe>` and keep the default limited to listing recipes.

## Nix package and release checks

Use the selected Haskell package set's `callCabal2nix` or the repository's established Haskell derivation for installable packages.
Ensure the package source includes the generated Cabal file and all required source and data files.
Check development and package compiler compatibility independently from Cabal's frozen plan.
Use [nix-stack](../../../nix-stack/SKILL.md) for flake, overlay, and package mechanics.
Keep `nix build` in a separate CI job or explicit task when its cost or dependency path differs from routine Cabal checks.
A successful Cabal build does not establish a successful Nix package build.
When packaging changes, build and run the real artifact on its supported target and check required dynamic libraries.
For libraries, inspect `cabal sdist` contents and verify the packaged source can build.
Keep publication and deployment separate from these checks and require explicit authorization.

## Official references

- [Cabal project configuration](https://cabal.readthedocs.io/en/stable/cabal-project.html)
- [hpack](https://github.com/sol/hpack)
- [Fourmolu](https://fourmolu.github.io/)
- [HLint](https://github.com/ndmitchell/hlint)
- [Hspec](https://hspec.github.io/)
- [Nixpkgs Haskell packages](https://nixos.org/manual/nixpkgs/stable/#haskell)
