# Shared Haskell Stack

## Compiler and dependency authorities

Use pinned Nix inputs for GHC, cabal-install, hpack, Fourmolu, and HLint.
Use one compatible Nix Haskell package set for development and package builds unless the repository specifies a verified difference.
Do not add GHCup or a second compiler pin.
Keep the selected GHC 9.12 template unless the product needs the conditional [Iris profile](cli.md#iris-compatibility-profile).
A library's supported GHC and `base` range is separate from the development compiler.

### Cabal and hpack ownership

For the hpack profile, keep the hpack input as the source of truth.
Keep the generated `.cabal` file in version control, not as a second editable source.
Keep a valid `hpack.yaml` coexistence profile instead of assuming that every project uses `package.yaml`.

Make CI fail on generated-manifest drift without changes to the source tree.
If hpack has no suitable read-only mode, generate in a disposable copy for comparison with the committed manifest.
Order generation before manifest consumers.
Do not run concurrent Cabal writes to a shared `dist-newstyle` directory.

### Dependency plans

Use an explicit `index-state` in `cabal.project` for the package-index snapshot.
Keep `cabal.project.freeze` for the repository's reproducible application or test plan.
Neither file pins GHC or replaces `flake.lock`.
For libraries, keep compatibility bounds separate from the frozen contributor test plan.

Keep immutable dependency revisions consistent between Cabal and Nix when both resolve the same dependency.
Apply release-age safeguards separately from the index snapshot and frozen plan.
Do not use global `allow-newer` to bypass compiler incompatibility.

## Native tasks

Use native Cabal tasks, with a project-local Justfile where orchestration is necessary.
Do not add Node.js or Vite+ only to standardize task names.
Use Fourmolu for formatting, HLint for lint checks, and Hspec for native tests.
Use `hspec-discover` for new template suites without replacing valid manual registration in existing projects.
For Nix packages, use the selected package set's `callCabal2nix` or the repository's established Haskell derivation.
Use [nix-stack](../../../nix-stack/SKILL.md) for Nix package mechanics.

## Official references

- [Cabal project configuration](https://cabal.readthedocs.io/en/stable/cabal-project.html)
- [hpack](https://github.com/sol/hpack)
- [Fourmolu](https://fourmolu.github.io/)
- [HLint](https://github.com/ndmitchell/hlint)
- [Hspec](https://hspec.github.io/)
- [Nixpkgs Haskell packages](https://nixos.org/manual/nixpkgs/stable/#haskell)
