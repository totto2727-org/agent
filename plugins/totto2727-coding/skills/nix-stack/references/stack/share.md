# Shared Nix Toolchain

Use this reference to maintain development and build environments.
Use [shared task policy](../../../share-stack/references/task-orchestration.md) for task names, dependencies, caching, and CI ownership.

## Inputs and toolchain authority

Use the repository's flake and commit `flake.lock` with intentional input changes.
Do not replace a pinned input with an ambient channel or an unreviewed latest revision.
Reuse an existing input with `follows` when it is intended to supply the same dependency.
Do not force distinct inputs to follow one another when their compatibility requirements differ.

Keep the compiler declaration, resolved dependency lock, and Nix input lock distinct.
For Rust, use the [Rust stack](../../../rust-stack/SKILL.md) for rustup and `rust-toolchain.toml` policy.
For MoonBit, use the [MoonBit stack](../../../mbt-stack/SKILL.md) for its overlay and supported targets.
For other languages, follow their stack's `references/stack/share.md`.
If the shell and package builder supply different compilers, verify the required compatibility instead of assuming that the development build proves package behavior.

## Shells and tasks

Expose the existing documented development shell without adding another task runner.
Run repository commands non-interactively with `nix develop --command <command>` when that is the declared entry point.
Keep shell setup separate from test, build, release, and deployment actions.
Do not make entering a shell publish an artifact, alter a remote service, or update dependencies.
Do not add Node.js solely to orchestrate a standalone native-language project.

Use nixfmt as the Nix formatter through the repository's pinned toolchain.
Retain treefmt only when the project uses it to coordinate useful formatter scopes.
Do not add a second formatting orchestrator merely for one Nix file.

## Verification boundaries

Check the affected flake outputs and the actual target systems.
Use evaluation to check output structure, not as a substitute for a derivation build.
Run the selected package's real `nix build` and consumer check when package behavior changes.
Use the repository's declared checks for development-shell or module changes.
Keep expensive package, integration, and platform checks explicit rather than silently expanding every fast CI task.
Do not claim Linux or another architecture from a successful local macOS build.

See [Nix command reference](https://nix.dev/manual/nix/latest/command-ref/new-cli/nix) and the [Nixpkgs manual](https://nixos.org/manual/nixpkgs/stable/) for the pinned tool's behavior.
