# Go Toolchain Stack

| Area                    | Selection                            | Configuration                                                                                             |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Development environment | Nix                                  | Locked inputs for Go and golangci-lint v2.                                                                |
| Dependencies            | Go modules                           | Minimum Go version in `go.mod`, toolchain selection aligned with Nix.                                     |
| Formatting              | gofmt through golangci-lint v2       | Same formatter selection for checks and fixes.                                                            |
| Lint                    | golangci-lint v2                     | Nix-managed version.                                                                                      |
| Tests                   | `go test`                            | Native Go test runner.                                                                                    |
| Task orchestration      | Native Go commands, Just when needed | Project-local Justfile for multi-step tasks.                                                              |
| Application packaging   | Nix `buildGoModule`                  | `vendorHash` aligned with module changes, [nix-stack](../../../nix-stack/SKILL.md) for package mechanics. |
