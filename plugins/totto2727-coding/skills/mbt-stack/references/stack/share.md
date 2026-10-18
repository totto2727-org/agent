# MoonBit Toolchain and Target Selection

## Toolchain

Use Nix with [moonbit-overlay](https://github.com/totto2727-org/moonbit-overlay).
`flake.lock` fixes the overlay revision.
Thus, `pkgs.moonbit-bin.moonbit.latest` selects that revision's compiler, not today's online release.
For native packages, use the locked overlay's `moonPlatform.buildMoonPackage` interface.
A package build does not prove that tests ran when builder tests are disabled.

Use `moon.mod` and `moon.pkg` for new configuration, but keep supported legacy formats during unrelated maintenance.
Use the pinned toolchain's manifest tooling, not a JSON parser for new-syntax manifests.
See the [official Moon manual](https://docs.moonbitlang.com/en/latest/toolchain/moon/index.html) for native commands.
Do not add Node.js or another runner only for common task names.

## Target capability proof

Wasm-based execution is the future direction, not a current migration requirement.
Native and JS remain valid when dependencies or host APIs need them.
An omitted target declaration does not prove backend support.
Module-level support does not prove support for a process-dependent package.

For each promised target, examine package restrictions and do host-behavior tests on that target.
Record the capability that needs native or JS instead of wasm.
This policy selects no WASI generation, wasm runtime, browser environment, or universal HTTP client.

## Project README

For new projects, keep `README.mbt.md` as the canonical README, with `README.md` as a relative symbolic link.
This supports literate examples and the conventional repository entry point.
Keep existing mandatory layouts.
See [Moon project setup](https://docs.moonbitlang.com/en/latest/toolchain/moon/package-manage-tour.html#setup-moonbit-project).

## Semantic navigation

Use [Moon IDE](https://docs.moonbitlang.com/en/latest/toolchain/moonide/index.html) for compiler-aware symbol queries.
Its entry points include `moon ide outline`, `doc`, `peek-def`, and `find-references`.
Use the pinned release's location flags for ambiguous symbols.

## Library selection

| Capability                         | Choice                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| CLI                                | [Admiral](cli.md)                                                                 |
| Fixed-shape JSON                   | Standard `FromJson` and `ToJson` through [JSON guidance](json.md)                 |
| Dynamic or presence-sensitive JSON | [Lens](json.md#official-lens-guidance)                                            |
| Async I/O                          | [moonbitlang/async](async.md)                                                     |
| Explicit task graphs               | [Workgraph](async.md#task-graphs), with sequential execution                      |
| Provider integration               | [SDK adapters](async.md#sdk-and-provider-boundaries), not a universal runtime     |
| Filesystem locations               | The existing typed path library, with [path constraints](json.md#path-boundaries) |
