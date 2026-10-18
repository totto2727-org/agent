# Shared Go Stack

## Compiler and modules

- Keep the module's supported minimum Go version distinct from the development compiler.
- Check `go.mod` and automatic toolchain selection against the Nix compiler.
- Use pinned Nix inputs for Go and golangci-lint v2.
- Apply the repository's release-age safeguards to dependency selection.

The `go` directive specifies the language version and minimum toolchain, not an exact compiler pin.
A `toolchain` directive can change the compiler selection.
`go.sum` verifies module content, but it is not a complete dependency lockfile.

## Native tasks

Use native Go tasks, with a project-local Justfile for procedures that need orchestration.
Do not add Node.js or Vite+ only to standardize task names.
Use gofmt through golangci-lint v2 for formatting and golangci-lint v2 for lint checks.

If a check uses `golangci-lint fmt --diff`, check the installed version's exit behavior.
Make the check fail on a nonempty diff if the command does not fail itself.
Keep the same formatter selection in checks and fixes.

## Nix package boundary

Use `buildGoModule` for installable applications and [nix-stack](../../../nix-stack/SKILL.md) for package mechanics.
Keep `vendorHash` aligned with external module changes.
Use `vendorHash = null` only when the dependency or vendoring arrangement supports it.
Do not assume that a CGO binary is standalone or cross-compilable.
