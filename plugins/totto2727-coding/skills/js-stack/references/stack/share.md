# Shared JavaScript Toolchain

## Package manager

Use pnpm for dependency management and Vite+ `vp` for task and dependency commands.
Keep `pnpm-lock.yaml` authoritative.
An adopted Bun dependency-management template is a repository exception.
Keep an existing Deno/JSR profile's consumer runtime support.

Use Bun for JS/TS application builds inside Nix, not as an implicit production host or replacement dependency manager.
This requirement does not apply to library packages or Alchemy-owned host builds.

## Dependency versions

Use caret ranges for external dependencies unless a concrete compatibility requirement makes an exact version necessary.
Lockfile resolutions, package versions, and internal `workspace:` protocols are separate concerns.
Check Effect, Alchemy, Effront, Vite+, and adapter peer dependencies together.

Apply [shared dependency safeguards](../../../share-stack/SKILL.md#keep-environments-and-dependencies-explicit).
For pnpm's built-in release age, enable [minimumReleaseAgeStrict](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict) on supported versions to prevent younger-release fallback.
When changing managers, keep the effective waiting period, including conversion from seconds to minutes.

Do not add overrides or resolutions without a concrete requirement.
For the official Vite+ toolchain override:

- Keep a caret range for the direct `vite-plus` dependency.
- Map `vite` to `npm:@voidzero-dev/vite-plus-core@<installed-vite-plus-version>`.
- Pin `vitest` to the exact bundled version from `vp toolchain vitest`.
- Update both overrides with Vite+.

Use the official [migration](https://viteplus.dev/guide/migrate) and [upgrade](https://viteplus.dev/guide/upgrade-project) guides for manager-specific configuration.

## Tasks, checks, and deliverables

Use Vite+ for the workspace task graph under [shared task orchestration](../../../share-stack/references/task-orchestration.md).
Declare recurring tasks in `vite.config.*` and invoke them with `vp run`.
Use `vp exec` or `vpx`, not `npx` or `bunx`, for package runners.

| Concern                         | Tool                                          |
| ------------------------------- | --------------------------------------------- |
| Format and lint                 | Vite+ formatter and linter                    |
| Types                           | Template-compatible TypeScript checker        |
| Host application build          | Vite/Effront/Alchemy for the selected target  |
| Nix application build           | Bun                                           |
| Library bundle and declarations | `vp pack` when configured                     |
| Unit tests                      | Vitest through `vp test run` or `vp run test` |

## Official guidance

Use [@totto2727/fp](https://jsr.io/@totto2727/fp) only for an existing integration or an explicit requirement, not as a prerequisite for Effect.

If installed, use the official [vite-plus skill](https://github.com/voidzero-dev/vite-plus).
Otherwise, use the [Vite+ guide](https://viteplus.dev/guide/).
Use [pnpm settings](https://pnpm.io/settings) and [Bun build documentation](https://bun.sh/docs/bundler) for manager and build behavior.
