# MoonBit Toolchain and Target Selection

This reference serves developers who maintain MoonBit project setup and distribution.
Use [share-stack](../../../share-stack/SKILL.md) for common policy and [task orchestration](../../../share-stack/references/task-orchestration.md) for runner selection and task contracts.
Repository instructions and adopted templates take precedence over new-project defaults.
Preserve existing compatibility requirements and upstream-first fork behavior unless a requested change requires otherwise.

## Toolchain

Use Nix with [moonbit-overlay](https://github.com/totto2727-org/moonbit-overlay) to supply the MoonBit toolchain.
The repository's `flake.lock` fixes the overlay revision, so `pkgs.moonbit-bin.moonbit.latest` means the toolchain selected by that locked revision, not the current online release or a neighboring overlay checkout.
Keep Nix-specific flake, overlay, and package rules in [nix-stack](../../../nix-stack/SKILL.md).
Use the same pinned compiler for development, CI, and packaging, and align targets with the promised capabilities below.
Add Node.js only when the selected JS target requires it, and add provider executables only to environments that run those integrations.
Do not introduce Node.js or another task runner merely to standardize command names.

Use `moon.mod` and `moon.pkg` as the current module and package configuration entry points.
Preserve a maintained repository's supported manifest format rather than converting it during unrelated work.
Read dependency constraints and the authoritative resolution files supported by the pinned Moon toolchain before changing a dependency.
Keep concrete versions in those project files rather than in this skill.
Apply the release-age and supply-chain safeguards in [share-stack](../../../share-stack/SKILL.md#keep-environments-and-dependencies-explicit).
Use the pinned toolchain or overlay's supported manifest tooling rather than treating new-syntax manifests as JSON.

## Target capability proof

The future direction is wasm-based execution, but this is not a requirement to force wasm on current applications.
Determine the actual target from dependency support, package-level restrictions, process and host APIs, and the intended runtime.
Native and JS remain valid when those constraints require them.
Synchronous backend-neutral libraries need not pin a target merely for consistency.
An omitted target declaration is not evidence that every backend works.

For each promised target, check the resolved dependency interfaces and compile, test, and exercise the required host behavior in its actual environment.
Record the concrete capability constraint when choosing native or JS instead of wasm.
Do not infer a particular WASI generation, wasm runtime, browser environment, or migration deadline.
Module-level support does not prove that a process-dependent package supports the same targets.
Apply the service-hosting policy in [share-stack](../../../share-stack/SKILL.md#select-a-service-host) when building a hosted service, not when distributing a local CLI or library.
No universal MoonBit HTTP client or application runtime is selected here.

## Format, check, test, and build

Keep Moon's native commands as the baseline entry points.
Run non-interactively from the project root in the pinned environment:

```sh
nix develop --command moon fmt
nix develop --command moon check
nix develop --command moon test
nix develop --command moon build
```

`moon fmt` writes formatted files, so use it only when edits are permitted.
Use the pinned Moon release's supported non-writing format-check mode for CI and review-only checks.
Pass explicit targets using that release's documented flags when testing or building a target matrix.
Keep warnings and compiler checks aligned with repository policy rather than inventing a separate lint framework.
Use Moon's built-in tests and [mbt-test](../../../mbt-test/SKILL.md) for assertions, test layout, isolation, and fixtures.
Keep integration and E2E execution separately selectable when they require external services or provider processes.
Existing aggregate tasks can call these native commands under the shared orchestration policy.

For native distribution, use the adopted overlay's `moonPlatform.buildMoonPackage` interface and check its behavior at the locked revision.
Verify the built artifact on the promised host with only its declared runtime dependencies available.
A Nix package build does not establish that tests ran, particularly when the package disables builder tests.
Keep publication and deployment separate from local checks and require explicit authorization.

## Project README

For a new project, keep the canonical README in `README.mbt.md` and expose `README.md` as a relative symbolic link to it.
This supports MoonBit's literate examples and the conventional repository entry point.
Retain a maintained repository's required documentation layout when this default does not fit.
See [Moon project setup](https://docs.moonbitlang.com/en/latest/toolchain/moon/package-manage-tour.html#setup-moonbit-project).

## Semantic navigation

Use `moon ide` for compiler-aware investigation of MoonBit symbols.
Use text search for paths, comments, string literals, and initial discovery.

| Need                  | Moon IDE entry point                |
| --------------------- | ----------------------------------- |
| List declarations     | `moon ide outline <path>`           |
| Inspect an API        | `moon ide doc '<query>'`            |
| Find a definition     | `moon ide peek-def <symbol>`        |
| Find affected callers | `moon ide find-references <symbol>` |

Check supported location flags in the pinned toolchain when a symbol is ambiguous.
Check affected references before a caller-visible change and run the repository's actual check entry point afterward.
See the [official Moon IDE documentation](https://docs.moonbitlang.com/en/latest/toolchain/moonide/index.html).

## Library selection

| Need                               | Default or boundary                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Command-line application           | [Admiral CLI composition](cli.md)                                                                      |
| Fixed-shape JSON                   | Standard `FromJson` and `ToJson`, with [JSON boundary rules](json.md)                                  |
| Dynamic or presence-sensitive JSON | Lens through its official skill and [JSON routing](json.md)                                            |
| Async I/O                          | [moonbitlang/async composition](async.md)                                                              |
| Explicit task graph                | Workgraph only when graph execution is needed, with [sequential execution rules](async.md#task-graphs) |
| Provider integration               | [SDK and provider adapters](async.md#sdk-and-provider-boundaries), not a universal runtime             |
| Filesystem locations               | Preserve typed paths in the selected path library and use [path boundaries](json.md#path-boundaries)   |

Use the locally installed official [MoonBit skills](https://github.com/moonbitlang/skills), including [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md), when available.
Otherwise use the [official documentation](https://docs.moonbitlang.com/en/latest/) and [source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md).
Treat official examples as version-dependent evidence, not permission to override resolved interfaces or repository constraints.
