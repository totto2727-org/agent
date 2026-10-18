---
name: js-coding
description: >-
  Effect-TS-first JavaScript and TypeScript implementation guidance. Prefer Effect APIs over standard APIs for collections, strings, dates, typed effects, and HTTP. Use when implementing or reviewing these concerns, dependencies, package managers, or existing Hono and Remix integrations.
---

# Effect-TS Coding Index

## Write Effect-TS, not plain TypeScript

Write Effect-TS rather than plain TypeScript with occasional Effect wrappers.
Prefer Effect-TS APIs over all corresponding JavaScript, TypeScript, and Web standard APIs.
Apply this rule to pure data operations as well as I/O, not only asynchronous code or error handling.

| Concern                       | Prefer                                                                                                                                    | Do not select by default                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Array operations              | Effect `Array`                                                                                                                            | Native array methods or custom array helpers                        |
| String operations             | Effect `String`                                                                                                                           | Native string methods or custom string helpers                      |
| Dates and time                | Effect `DateTime` and `Clock`                                                                                                             | Native `Date`, `Date.now()`, or manual date arithmetic              |
| Outbound HTTP                 | Effect HTTP `HttpClient`, `HttpClientRequest`, and `HttpClientResponse`                                                                   | Direct `fetch`, native `Request`, or native `Response`              |
| Server HTTP and API contracts | Effect HTTP `HttpServerRequest` and `HttpServerResponse`, with `HttpApi`, `HttpApiGroup`, and `HttpApiEndpoint` for typed API definitions | Native request/response classes or hand-written transport contracts |

Choose the Effect API first whenever it provides the required operation.
Do not choose a standard API merely because it is shorter or familiar.
Keep native objects only at host or third-party boundaries that require them, and convert there to or from Effect types.
Use the modules and import paths supported by the project's installed Effect version; confirm them in its official documentation or source.
Do not invent an Effect replacement for an unsupported platform capability.
Keep any necessary native operation in the smallest boundary adapter and explain why no applicable Effect API can satisfy it.
For a new JavaScript or TypeScript CLI, or an explicitly approved CLI migration, always use Effect CLI as its foundation.
Do not replace an existing CLI foundation during unrelated maintenance; preserve its command-line contract until the migration is authorized.

Do not wrap a pure Effect `Array` or `String` operation in an `Effect` merely to make it look effectful.
Keep real failures, dependencies, and resource lifetimes explicit through Effect's types and services.

## Reference routing

All references below are concrete TypeScript implementation guidance or an explicit upstream source index. Use [`share-coding`](../share-coding/SKILL.md) for language-independent design decisions.
Read only the relevant reference; already available principles need not be reloaded.

## Package manager

- Preserve the workspace template's language settings and toolchain, and extend them only as needed. Use [`share-stack`](../share-stack/SKILL.md) for shared toolchain policy and [task orchestration](../share-stack/references/task-orchestration.md) for runner selection, dependencies, project-local scripts, and cache boundaries.
- Use the workspace template's pinned runtime for development tooling. For deployed services, follow the [Cloudflare hosting priority](../share-stack/SKILL.md#select-a-service-host); a development runtime does not select the production host.
- Keep pnpm as the underlying package-manager default unless the workspace template specifies otherwise.
- Use the Vite+ CLI (`vp`) as the default interface for dependency operations and project tasks.
- When using pnpm, keep it as the only package manager and `pnpm-lock.yaml` as the authoritative dependency lockfile.
- Use Bun to build JavaScript and TypeScript applications inside Nix. This selects a build tool, not a production server runtime or a different package manager. Preserve the workspace's authoritative dependency manager and lockfile.
- When changing package managers, preserve the existing release-age window. Convert units without reducing the duration, for example, 86400 seconds to 1440 minutes for pnpm.
- Package-manager choice is separate from runtime support. Do not change a library's supported runtimes or its Deno design merely to adopt pnpm.

## Dependency versions

- Use caret ranges such as `^1.2.3` for external dependency declarations. Do not use exact versions unless an unavoidable compatibility requirement needs them. Record the reason and its supporting evidence.
- Select the newest compatible version that the package manager can install with its default minimum release age and supply-chain waiting period in force. Do not select an ineligible release merely because it is the latest published version.
  On pnpm versions that support [`minimumReleaseAgeStrict`](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict), set `minimumReleaseAgeStrict: true` when using the built-in age to prevent fallback to younger releases. This enforces the existing waiting period without changing its duration, and must not be copied to package managers that do not support it.
- Do not disable or shorten those waiting periods, or add `minimumReleaseAgeExclude`, for routine updates. Permit only a genuinely urgent exception, such as a critical security fix. Record the urgency, evidence, and smallest necessary scope before applying it.
- Do not use `overrides` or `resolutions` by default. Use them only for an unavoidable requirement, such as an official Vite+ toolchain requirement. Record the reason, affected packages, and official source or other concrete evidence.
  For Vite+, keep the direct `vite-plus` declaration as a caret range. In package-manager overrides, map `vite` to `npm:@voidzero-dev/vite-plus-core@<installed-vite-plus-version>` and pin `vitest` to the exact bundled version. Use the project's local CLI to check it with `vp toolchain vitest`. Update both overrides whenever `vite-plus` changes. Follow the [official migration guide](https://viteplus.dev/guide/migrate) and [update guide](https://viteplus.dev/guide/upgrade-project) for package-manager-specific forms.
- These rules concern external dependency declarations, not a package's own `version`, concrete lockfile resolutions, or internal `workspace:` references. Preserve those values and protocols unless the task requires their change.

## Type boundaries

- [`boundary-conversion.md`](references/boundary-conversion.md) — decode weak external values into wire models, validate domain models, and encode request models.
- [`state-modeling.md`](references/state-modeling.md) — discriminated unions, exhaustive transitions, and impossible-state elimination.
- [`error-handling.md`](references/error-handling.md) — typed Effect failures, propagation, recovery, and error translation.
- [`collections.md`](references/collections.md) — unique collection choices and boundary conversion.

## Effect

- [`effect-layer.md`](references/effect-layer.md) — service tags and Layer definitions.
- [`effect-layer-composition.md`](references/effect-layer-composition.md) — dependency provision and Layer exposure.
- [`effect-runtime.md`](references/effect-runtime.md) — managed runtimes, disposal, and environment selection.
- [`effect-sources.md`](references/effect-sources.md) — live upstream migration and Schema sources.

## Existing Hono integrations

Use these references only to maintain existing Hono code.
Use Effect HTTP for new backend implementations; track Hono replacement in the project's issues rather than a permanent migration reference.

- [`hono-handler.md`](references/hono-handler.md) — endpoint Effect boundaries and dependency provision.
- [`hono-middleware.md`](references/hono-middleware.md) — middleware context and authentication boundaries.
- [`hono-subapp.md`](references/hono-subapp.md) — sub-application construction.
- [`hono-errors.md`](references/hono-errors.md) — HTTP error types.
- [`hono-ordering.md`](references/hono-ordering.md) — middleware registration order.

## Browser input

- [`ime-safe-enter-submit.md`](references/ime-safe-enter-submit.md) — read when adding or changing custom Enter-to-submit behavior, or fixing premature submission during IME conversion; routes to official Modern Web Guidance.

## Existing Remix integrations

Use this reference only to maintain existing Remix code.
Use Effront for new Web applications; track replacement of Remix + Hono in the project's issues.

- [`remix-client-events.md`](references/remix-client-events.md) — client event Effect boundaries.

## @totto2727/fp

- [`totto2727-fp.md`](references/totto2727-fp.md) — package-specific reference index.

## Related skills

- [`vite-plus`](https://github.com/voidzero-dev/vite-plus): official repository toolchain and build orchestration skill. Prefer the installed skill; otherwise use the [official Vite+ guide](https://viteplus.dev/guide/).
- `remix` — Remix application structure and framework conventions.
- [`js-test`](../js-test/SKILL.md): TypeScript test implementation.
