# Nix Toolchain

| Choice         | Policy                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Input versions | Flakes with committed `flake.lock`.                                             |
| Shared inputs  | `follows` only for compatible dependencies that must use one source.            |
| Formatter      | nixfmt. Keep an existing treefmt setup when it coordinates multiple formatters. |
| Task runner    | [Shared task policy](../../../share-stack/references/task-orchestration.md).    |

Language stacks own compiler declarations, including [Rust's toolchain file](../../../rust-stack/references/stack/share.md) and [MoonBit's overlay](../../../mbt-stack/references/stack/share.md).
`flake.lock` does not prove that the development shell and package builder use the same compiler.

References: [Nix manual](https://nix.dev/manual/nix/latest/), [Nixpkgs manual](https://nixos.org/manual/nixpkgs/stable/).
