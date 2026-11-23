# MoonBit Baseline

| Selected technology                                                                                | Responsibility                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Nix](https://nixos.org/) with [moonbit-overlay](https://github.com/totto2727-org/moonbit-overlay) | Compiler and package environment fixed by `flake.lock` |
| [Moon](https://docs.moonbitlang.com/en/latest/toolchain/moon/index.html)                           | Build, test, dependencies, and manifest tooling        |

## Toolchain

| Selection                         | Contract                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `pkgs.moonbit-bin.moonbit.latest` | Compiler from the locked overlay revision, not today's online release |
| `moonPlatform.buildMoonPackage`   | Native package builder from the locked overlay                        |
| `moon.mod`, `moon.pkg`            | New project configuration                                             |
| Manifest operations               | Pinned Moon tooling, not JSON parsing of new-syntax manifests         |

- Run tests separately when builder tests are disabled.
- Retain supported legacy manifest formats during unrelated maintenance.

## Target capability proof

| Target selection     | Required evidence                                                                  |
| -------------------- | ---------------------------------------------------------------------------------- |
| Wasm                 | Future direction, not a current migration requirement or a selected runtime        |
| Native or JS         | Current targets for required dependencies or host APIs                             |
| Each promised target | Package restrictions and host-behavior tests, including process-dependent packages |

- Record the capability that requires native or JS.
- Module declarations alone do not prove package target support.

## Capability additions

| Selected technology                                                                             | Add when                                                                         |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Admiral](https://mooncakes.io/docs/totto2727/admiral)                                          | [CLI composition](cli.md)                                                        |
| [Standard `FromJson` and `ToJson`](https://docs.moonbitlang.com/en/latest/language/derive.html) | Fixed-shape JSON                                                                 |
| [Lens](https://mooncakes.io/docs/totto2727/lens)                                                | [Dynamic or presence-sensitive JSON](../knowledge/json.md) with path diagnostics |
| [moonbitlang/async](https://github.com/moonbitlang/async)                                       | [Async I/O](../knowledge/async.md)                                               |
| [Workgraph](https://github.com/totto2727-org/workgraph)                                         | Sequential task graphs with reduction before routing                             |
| Existing typed path library                                                                     | [Filesystem path boundaries](../knowledge/json.md#path-boundaries)               |

- Manual codec only when derivation cannot express the wire contract.

## Project README

- New projects: canonical `README.mbt.md`, with `README.md` as a relative symbolic link for literate examples and conventional discovery.
- Existing projects: retain mandatory layouts.

## Semantic navigation

| Selected technology                                                             | Entry points                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [Moon IDE](https://docs.moonbitlang.com/en/latest/toolchain/moonide/index.html) | `moon ide outline`, `doc`, `peek-def`, `find-references` |

- Use the pinned release's location flags for ambiguous symbols.
- Audience: advanced MoonBit stack consumers.
