# Shared JavaScript Toolchain

Use this reference for JS/TS development, dependency, task, and distribution decisions.
Apply [share-stack](../../../share-stack/SKILL.md) without duplicating its cross-language policy.

## Scope and targets

Follow explicit repository instructions and its adopted template before new-project defaults.
Keep upstream-first forks on upstream tools unless a demonstrated requirement needs divergence.
Use the repository's pinned Node.js environment for development tooling where its template specifies Node.js.
Keep application hosts, build runtimes, and a library's supported consumer runtimes separate.
Preserve an existing Deno/JSR profile instead of changing its runtime support to adopt pnpm.
For hosted TS/JS services, select Workers first and Containers second under the [service-host policy](../../../share-stack/SKILL.md#select-a-service-host).
Select another host only with evidence that both Cloudflare targets cannot satisfy a mandatory requirement.

## Package manager

Use pnpm as the dependency-manager default and Vite+ `vp` as the task and dependency interface.
Keep `pnpm-lock.yaml` authoritative in a pnpm workspace and do not introduce a competing lockfile.
An adopted template that explicitly uses Bun for dependency management is a repository exception, not a new global default.
Do not change an existing manager or lockfile during unrelated maintenance.
Use Bun for JS/TS application builds inside Nix, while preserving the authoritative dependency manager.
This build choice does not select Bun as a production host.
Do not apply Bun compile mechanically to library packages or host builds owned by Alchemy.
Use [nix-stack](../../../nix-stack/SKILL.md) for flake, package, sandbox, and output mechanics.
Run non-interactive commands through the pinned environment, for example `nix develop --command vp check`.
Use direnv only when the repository needs its automatic environment loading.

## Dependency versions

Use caret ranges such as `^1.2.3` for external declarations unless an unavoidable compatibility requirement needs an exact version.
Record the requirement and its evidence when an exact version is necessary.
Keep concrete lockfile resolutions, the package's own version, and internal `workspace:` protocols distinct from external ranges.
Select the newest compatible version eligible under the existing release-age and supply-chain safeguards.
Check peer dependencies across Effect, Alchemy, Effront, Vite+, and their adapters before changing versions.
Preserve the effective waiting duration when changing managers, including unit conversion such as 86400 seconds to 1440 minutes.
On supported pnpm versions, enable [minimumReleaseAgeStrict](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict) when using the built-in age to prevent fallback to younger releases.
Do not disable or shorten waiting periods or add age exclusions for routine updates.
Limit an urgent exception to the evidenced requirement under [shared dependency safeguards](../../../share-stack/SKILL.md#keep-environments-and-dependencies-explicit).
Preserve explicit repository age exceptions without copying them to other projects.

Do not add overrides or resolutions without an unavoidable requirement and concrete evidence.
For an official Vite+ toolchain requirement, retain a caret range for the direct `vite-plus` dependency.
Map the `vite` override to `npm:@voidzero-dev/vite-plus-core@<installed-vite-plus-version>` and pin the `vitest` override to the exact bundled version.
Check that bundled version with the local `vp toolchain vitest` command and update both overrides with Vite+.
Use the official [migration](https://viteplus.dev/guide/migrate) and [upgrade](https://viteplus.dev/guide/upgrade-project) guides for manager-specific configuration.

## Tasks, checks, and deliverables

Use Vite+ for the JS workspace task graph and interface.
Read [task orchestration](../../../share-stack/references/task-orchestration.md) for task names, dependency edges, exclusions, caches, and CI aggregation.
Register recurring tasks in `vite.config.*` and invoke declared tasks with `vp run`.
Use `vp exec` or `vpx` when a package runner is required, not `npx` or `bunx`.
Keep versions and concrete configuration in the repository manifests, lockfiles, and template instead of copying them into skills.

- Formatting and lint: use the Vite+ formatter and linter through `fix` and non-mutating `check` entry points.
- Types: use the template's compatible TypeScript checker in `check`, without emitted application artifacts.
- Application build: use the repository's Vite/Effront/Alchemy build for its selected target, or Bun for a Nix application build.
- Library build: use `vp pack` when configured for the package's bundle and declaration outputs.
- Unit tests: use Vitest through `vp test run` or the declared `vp run test` task.
- Integration and E2E: use explicitly selected suites with isolation and cache boundaries defined by share-stack.
- CI: use the same public check, build, and test entry points as local development.

Use [js-test](../../../js-test/SKILL.md) for cases, assertions, and fixture design.
For libraries, check packed contents, declarations, exports, and supported consumer runtimes.
For Nix applications, build and execute the real artifact in its promised runtime environment before calling it standalone.
Keep package generation separate from publishing and deployment authorization.

## Official guidance

Prefer the installed official [vite-plus skill](https://github.com/voidzero-dev/vite-plus) for exact CLI and configuration details.
If it is unavailable, use the [official Vite+ guide](https://viteplus.dev/guide/).
Use [pnpm settings](https://pnpm.io/settings) and [Bun build documentation](https://bun.sh/docs/bundler) for version-specific manager and build behavior.
