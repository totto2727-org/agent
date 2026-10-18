# Systems and Modules

Use this reference for system and user-environment configuration.
Read the existing module tree, target host, and flake outputs before changing configuration.

## Keep configuration ownership explicit

Use NixOS modules for NixOS hosts, nix-darwin for macOS system configuration, and Home Manager for its declared user-environment scope.
Do not assume that an option exists in all three module systems.
Separate reusable modules from host-specific selections and user-specific values.
Keep shared policy in the smallest module that owns it rather than duplicating a host configuration.

Use an overlay for package additions or overrides that need package-set composition.
Do not use an overlay as a substitute for a module option or a project's application configuration.
Preserve the selected package set's platform and dependency relationships when applying an override.
Avoid implicit dependencies on a developer's home directory or machine-specific checkout path.

## Inspect before activation

Evaluate the actual host or user configuration through its documented entry point.
Build or inspect the intended activation artifact before a live switch when the project supports that workflow.
Evaluation alone does not prove that activation, services, or device permissions work.
Do not switch a live system, change access controls, or restart services without task authorization.
Report unavailable privileges or host access rather than bypassing them.

Keep credentials in the established secret-management boundary.
Do not put secret values into generated files, Nix expressions, derivation arguments, or examples that can enter the store.

## Official references

- [NixOS manual](https://nixos.org/manual/nixos/stable/)
- [nix-darwin](https://github.com/nix-darwin/nix-darwin)
- [Home Manager manual](https://nix-community.github.io/home-manager/)
- [Nixpkgs overlays](https://nixos.org/manual/nixpkgs/stable/#chap-overlays)

Verify options against the repository's pinned inputs before selecting them.
