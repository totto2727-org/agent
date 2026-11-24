# Shared JavaScript Toolchain

| Concern                         | Selected technology                                      |
| ------------------------------- | -------------------------------------------------------- |
| Dependency management           | pnpm, `pnpm-lock.yaml`                                   |
| Task and dependency commands    | Vite+ `vp`                                               |
| Format and lint                 | Vite+ formatter and linter                               |
| Types                           | TypeScript checker compatible with the selected packages |
| Application build               | Vite/Effront/Alchemy for the selected target             |
| Nix application build           | Bun                                                      |
| Library bundle and declarations | `vp pack` when configured                                |
| Unit tests                      | Vitest through `vp test run` or `vp run test`            |

## Lint configuration

For first-party Effect projects, use the [shared Oxlint package](https://github.com/totto2727-org/oxlint): `@totto2727/oxlint/preset/application` for applications and `/preset/library` for libraries. The modes differ in where they permit tracing.
Loading the plugin without extending a preset enables only the custom rules selected by the project. Inspect file overrides before assuming the full preset applies.
For a reported `rules/<id>`, look up the [rule and its remedy](../../../oxlint/SKILL.md).

## Package manager

- Use pnpm for dependencies and Vite+ for task and dependency commands.
- Keep `pnpm-lock.yaml` authoritative.
- Preserve consumer runtime support in existing Deno/JSR profiles.
- Limit Bun to Nix application builds, not dependency management or production hosting.
- Exclude library packages and Alchemy-owned host builds from the Bun build requirement.

## Dependency versions

- Use caret ranges for external dependencies unless compatibility requires an exact version.
- Keep lockfile resolutions, package versions, and internal `workspace:` protocols separate.
- Check Effect, Alchemy, Effront, Vite+, and adapter peer dependencies together.
- Apply [shared dependency safeguards](../../../share-stack/SKILL.md#keep-environments-and-dependencies-explicit).
- Enable pnpm [minimumReleaseAgeStrict](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict) on supported versions to prevent younger-release fallback.
- Preserve the effective waiting period across managers, including seconds-to-minutes conversion.
- Require a concrete compatibility need for overrides or resolutions.

| Vite+ toolchain entry         | Required value                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| Direct `vite-plus` dependency | Caret range                                                      |
| `vite` override               | `npm:@voidzero-dev/vite-plus-core@<installed-vite-plus-version>` |
| `vitest` override             | Exact bundled version from `vp toolchain vitest`                 |
| Vite+ update                  | Update both overrides together                                   |

## Task configuration

- Declare recurring tasks in `vite.config.*` and invoke them with `vp run`.
- Follow [shared task orchestration](../../../share-stack/references/task-orchestration.md).
- Use `vp exec` or `vpx`, not `npx` or `bunx`, for package runners.
- Prefer the installed official [vite-plus skill](https://github.com/voidzero-dev/vite-plus), with the [Vite+ guide](https://viteplus.dev/guide/) as fallback.
- Use [`@totto2727/fp`](https://jsr.io/@totto2727/fp) only for an existing integration or an explicit requirement, not as an Effect prerequisite.

If the linked skills are not installed, read the source: [share-stack](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-stack/SKILL.md#keep-environments-and-dependencies-explicit), [share-stack: task-orchestration](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-stack/references/task-orchestration.md).
