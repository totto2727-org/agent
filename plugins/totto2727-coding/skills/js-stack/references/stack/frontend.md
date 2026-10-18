# Frontend Composition

Use Effront for React Server Components, SSR, Server Functions, browser navigation, and native Effect HTTP.
Use [Effront integration](../knowledge/effront.md) for conditional exports and adapter compatibility.

## Services and hosting

Compose Effront's separate Alchemy adapter with its native Effect HTTP integration, not a second HTTP server.
Apply [shared hosting policy](../../../share-stack/SKILL.md#select-a-service-host) when selecting the adapter.
A Node or Bun adapter does not change that policy.
Keep request-specific services outside a process-wide runtime under [runtime conventions](../knowledge/effect/services-runtime.md#managedruntime).

## UI components and existing applications

Use the Base UI-based variant of [shadcn/ui](https://ui.shadcn.com/docs), not its Radix-based variant, for new browser UI.
Check that generator or registry output uses [Base UI](https://base-ui.com/react/overview/quick-start).
Generic shadcn/ui initialization does not establish that selection.
Form and client-state libraries are not implicit parts of this baseline.

Keep existing Radix, Remix, and Hono contracts during unrelated maintenance.
Track replacement work in [Issue #60](https://github.com/totto2727-org/agent/issues/60).
Use [IME-safe submission](../../../js-coding/references/ime-safe-enter-submit.md) for custom Enter-to-submit behavior.
