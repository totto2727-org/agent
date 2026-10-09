---
name: js-coding
description: >-
  TypeScript implementation guidance for dependency versions, Effect, Hono, Remix, browser IME input, typed boundaries, and collections. Use when implementing or reviewing these concerns, or changing JavaScript or TypeScript dependencies.
---

# TypeScript Coding Index

All references below are concrete TypeScript implementation guidance or an explicit upstream source index. Use [`share-coding`](../share-coding/SKILL.md) for language-independent design decisions.
Read only the relevant reference; already available principles need not be reloaded.

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

## Hono

- [`hono-handler.md`](references/hono-handler.md) — endpoint Effect boundaries and dependency provision.
- [`hono-middleware.md`](references/hono-middleware.md) — middleware context and authentication boundaries.
- [`hono-subapp.md`](references/hono-subapp.md) — sub-application construction.
- [`hono-errors.md`](references/hono-errors.md) — HTTP error types.
- [`hono-ordering.md`](references/hono-ordering.md) — middleware registration order.

## Browser input

- [`ime-safe-enter-submit.md`](references/ime-safe-enter-submit.md) — read when adding or changing custom Enter-to-submit behavior, or fixing premature submission during IME conversion; routes to official Modern Web Guidance.

## Remix

- [`remix-client-events.md`](references/remix-client-events.md) — client event Effect boundaries.

## @totto2727/fp

- [`totto2727-fp.md`](references/totto2727-fp.md) — package-specific reference index.

## Related skills

- `vite-plus` — repository toolchain and build orchestration.
- `remix` — Remix application structure and framework conventions.
- [`js-test`](../js-test/SKILL.md): TypeScript test implementation.
