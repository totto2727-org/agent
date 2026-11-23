# Nix Toolchain

| Choice         | Policy                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Input versions | Flakes with committed `flake.lock`.                                             |
| Shared inputs  | `follows` only for compatible dependencies that must use one source.            |
| Formatter      | nixfmt. Keep an existing treefmt setup when it coordinates multiple formatters. |

- Keep compiler declarations in the language stack.
- Verify the development-shell and package-builder compilers separately from `flake.lock`.
