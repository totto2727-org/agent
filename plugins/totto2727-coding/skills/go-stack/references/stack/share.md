# Shared Go Stack

For developers who maintain Go development, CI, and distribution commands.
Apply [shared stack policy](../../../share-stack/SKILL.md) without changing an existing application or fork solely to match a new-project default.
Read [task orchestration](../../../share-stack/references/task-orchestration.md) before changing task graphs or caches.

## Compiler and modules

- Use the applicable Go template for new projects and retain an existing module's supported minimum version.
- Treat the `go` directive in `go.mod` as a language and minimum-toolchain requirement, not an exact pin of the running compiler.
- Check any `toolchain` directive and automatic toolchain selection against the intended Nix compiler.
- Keep dependencies in `go.mod` and checksums in `go.sum` when dependencies exist.
- `go.sum` verifies module content but is not a complete dependency lockfile.
- Review dependency changes and `go mod tidy` output deliberately, not as a hidden mutating check.
- Apply the repository's release-age safeguards when selecting dependencies, even if the Go tooling has no matching manager setting.
- Pin the Nix inputs that supply Go, golangci-lint v2, and any required Just executable.
- Use `nix develop --command <command>` from the project root rather than an ambient compiler.
- Check `go version`, selected modules, `GOOS`, `GOARCH`, and CGO requirements for each supported artifact.
- A library's consumer compatibility is separate from the development compiler version.

## Native task mapping

Use native Go commands for standalone projects.
Use a project-local Justfile when a recurring procedure needs multiple steps or complex options.
Do not add Node.js or Vite+ solely to give a native project uniform task names.
An existing mixed workspace can aggregate these native commands under the shared task policy.

- `fix`: Run `golangci-lint fmt` with gofmt enabled in the version 2 configuration.
- `check`: Run `golangci-lint fmt --diff` and fail on formatting differences, then run `golangci-lint run`.
- `build`: Run `go build ./...` for package compilation, or select the actual main package with `go build -o <artifact> <main-package>`.
- `test`: Run `go test ./...`, using `go test -race ./...` on supported targets where the required toolchain and CGO support are available.

Check the installed golangci-lint v2 CLI before assigning exit-code behavior to the formatting-diff command.
If it does not fail on differences, make the project check fail when its diff output is nonempty.
Keep `check` non-mutating, with the same formatter selection used by `fix`.
Use [standard testing](https://pkg.go.dev/testing) for native suites.
The race detector checks executed paths, not the absence of all races.
Keep Docker or live-system E2E separately selected and report unsupported race targets explicitly.
Use the same declared commands locally and in CI.
When a recipe is needed, invoke `nix develop --command just --justfile ./Justfile <recipe>`.
Keep the Just default limited to listing recipes.

## Nix package boundary

Use `buildGoModule` for installable Go applications.
Keep its source, selected main packages, build flags, and compiler compatible with the native build contract.
Maintain `vendorHash` when external modules are required, and update it with reviewed dependency changes.
Use `vendorHash = null` only when the package's dependency or vendoring arrangement supports it, such as a dependency-free module.
Do not copy a hash from an unrelated package or disable verification to accept a mismatch.
Use [nix-stack](../../../nix-stack/SKILL.md) for flake, overlay, and package mechanics.

Build the real package with `nix build` when packaging changes, then run its executable on the promised target.
Check dynamic-library and CGO requirements before claiming the binary is standalone or cross-compilable.
Keep package publication and service deployment separate from build validation and require explicit authorization.

## Official references

- [Go modules](https://go.dev/ref/mod)
- [golangci-lint configuration](https://golangci-lint.run/docs/configuration/)
- [Race detector](https://go.dev/doc/articles/race_detector)
- [Nixpkgs Go packages](https://nixos.org/manual/nixpkgs/stable/#sec-language-go)
