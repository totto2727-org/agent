# Shared Rust Stack

Use this reference when maintaining Rust development, CI, or distribution configuration.
Apply [share-stack](../../../share-stack/SKILL.md) instead of duplicating shared environment, dependency, hosting, and publication rules.
Repository instructions and adopted templates take precedence over new-project defaults.
Do not migrate existing compiler sources, dependencies, or deployments solely to match this profile.

## Compiler and targets

Use rustup first for Rust toolchain supply.
Declare the compiler channel, required components, and supported targets in `rust-toolchain.toml`.
Include rustfmt and Clippy components when the project's checks use them, and declare only the targets the project supports.
For strict reproducibility, set `channel` to the concrete Rust release selected by the repository.
The `stable` channel moves and is not a strict compiler version pin.
Do not invent a release number or copy the host target into every project.

Keep the edition and supported consumer compiler requirements in `Cargo.toml` explicit.
Use edition 2024 for new projects when their required dependencies and supported compiler permit it.
Do not infer a library's minimum supported Rust version from the developer's installed compiler.
Test the declared minimum compiler and supported target matrix when publishing a library.

## Dependencies and compatibility

`Cargo.toml` owns package metadata, features, and dependency requirements.
`Cargo.lock` records resolved Rust dependencies, not the compiler or native system libraries.
Keep application lockfiles and use `--locked` in CI and distribution checks to reject unintended resolution changes.
Retain the repository's library lockfile policy, and test consumers without assuming the repository lockfile constrains their resolution.
Prefer Cargo-compatible version ranges rather than exact `=version` requirements unless a concrete constraint requires them.
Select the newest compatible release that satisfies the repository's release-age and supply-chain safeguards.
For temporary Git dependencies, pin a commit, document the missing registry capability, and return to a registry release when practical.
Review public APIs, feature flags, release notes, compiler compatibility, and target support before upgrading fast-moving dependencies.
Add only the crate features needed by the application.

## Nix environment and package compiler

In a Nix repository, run tasks from the repository root with `nix develop --command <command>`.
Use the pinned development shell to supply rustup and required native libraries rather than relying on ambient tools.
Keep direnv optional unless the repository requires it.
`flake.lock` pins Nix inputs and does not by itself make a Nix package compiler match `rust-toolchain.toml`.
Check `rustup show active-toolchain`, `rustc -Vv`, and `cargo -V` inside the actual development environment.
Inspect the package's selected Rust toolchain separately, including any compiler override used by its builder.
Where development and package builds require compiler alignment, provision the declared compiler in the package build and compare actual compiler versions and targets.
Do not assume rustup downloads work in a Nix sandbox or that the development shell compiler is the package compiler.
Verify sandbox dependency acquisition, components, native libraries, and cross-compilation tools through the real package build.
Record an unavailable build as unverified rather than claiming alignment from configuration alone.

Use [nix-stack](../../../nix-stack/SKILL.md) for flake, package, overlay, module, and sandbox mechanics when it is available.
If that skill is not installed, follow the repository's Nix configuration and the [Nixpkgs Rust reference](https://nixos.org/manual/nixpkgs/stable/#rust).
This profile owns Rust compiler and Cargo compatibility, not generic Nix implementation guidance.

## Native tasks and checks

Read [task orchestration](../../../share-stack/references/task-orchestration.md) before selecting an aggregate runner.
Keep Cargo entry points for standalone Rust projects.
Use project-local Just recipes for complex reusable native procedures, not mandatory wrappers for simple commands.
When Just is present, its default recipe must list recipes, and invoke it explicitly with `just --justfile ./Justfile <recipe>`.
Do not add Node.js or Vite+ to standalone Rust solely to standardize task names.
A mixed workspace can aggregate native commands through its existing runner without changing Rust's implementation dependencies.

| Task    | Native baseline                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix`   | `cargo fmt --all`, plus explicitly configured safe lint fixes                                                                                        |
| `check` | `cargo fmt --all -- --check`, `cargo check --workspace --all-targets --locked`, and `cargo clippy --workspace --all-targets --locked -- -D warnings` |
| `build` | `cargo build --workspace --locked`, with the project's release and target flags for distribution                                                     |
| `test`  | `cargo test --workspace --locked`, including rustdoc tests where applicable                                                                          |

These commands are baselines for a Cargo workspace, not claims that a specific project has passed them.
Retain documented single-package entry points where no workspace exists.
Select feature and target combinations deliberately, since `--all-features` can combine mutually exclusive features and host checks do not prove other targets work.
Keep live-service integration and end-to-end suites explicitly selected rather than hiding them in the lightweight test task.
Use [rust-test](../../../rust-test/SKILL.md) for test layout, assertions, and targeted Cargo checks.

## CI and distribution

Run the same declared native tasks in local development and CI with the same compiler, components, targets, and lock policy.
Build and smoke-test the actual release artifact on its promised platform, including native libraries, assets, and configuration discovery.
For published crates, use `cargo package --locked` and inspect the resulting contents and consumer entry points before authorized publication.
Keep release upload, publishing, signing, and deployment separate from local validation and require explicit authorization.
CLI and desktop execution on a user's device does not require introducing a hosted service.
If a separate hosted Rust service is required, follow [shared hosting policy](../../../share-stack/SKILL.md#select-a-service-host) without inventing a Rust Web profile.

## Capability-specific libraries

These are standards for matching capabilities, not a universal dependency list.

| Capability               | Standard and ownership                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command-line parsing     | [clap](cli.md) at the executable input boundary                                                                                                                                         |
| Async I/O                | [Tokio](cli.md) when an async runtime is required                                                                                                                                       |
| Native GUI               | [GPUI](desktop.md), with Rust integration owned by the desktop profile                                                                                                                  |
| LLM integration          | [Rig](llm.md), behind an application boundary                                                                                                                                           |
| Wire formats             | [Serde](../knowledge/capabilities.md#serde-garde-then-domain-construction) with a format-specific parser                                                                                |
| Semantic validation      | [garde](../knowledge/capabilities.md#serde-garde-then-domain-construction) after structural decoding                                                                                    |
| Code-defined workflows   | [graph-flow](../knowledge/capabilities.md#workflows-with-graph-flow) with separate definitions and run state                                                                            |
| Structured observability | [tracing](../knowledge/capabilities.md#logging-with-tracing) with explicit redaction                                                                                                    |
| Error implementation     | [thiserror](https://docs.rs/thiserror/latest/thiserror/) for typed errors, [anyhow](https://docs.rs/anyhow/latest/anyhow/) for application-level contextual reporting where appropriate |

Keep recoverable library and domain errors typed rather than exposing an opaque application report as every public contract.

## Official sources

- [rustup toolchain files](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file)
- [Cargo manifest](https://doc.rust-lang.org/cargo/reference/manifest.html)
- [Cargo lockfiles](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html)
- [Cargo commands](https://doc.rust-lang.org/cargo/commands/index.html)
- [rustfmt](https://github.com/rust-lang/rustfmt)
- [Clippy](https://doc.rust-lang.org/clippy/)
- [Just manual](https://just.systems/man/en/)
