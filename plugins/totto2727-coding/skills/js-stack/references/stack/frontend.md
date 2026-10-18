# Frontend Composition

Use this reference for new browser applications built with Effront.
Effront is the application composition for React RSC, SSR, browser interaction, and Effect HTTP, not only a UI component library.
Read [Effront integration](../knowledge/effront.md) for conditional imports and adapter evidence.
Use [backend composition](backend.md) for authentication, data access, HTTP contracts, and infrastructure wiring instead of duplicating those choices.

## Separate execution environments

- React Server Components own server-only data access and composition of values that may cross the serialization boundary.
- SSR renders the application response with the installed Effront server contract.
- The browser owns user interaction, local UI state, and client navigation through supported entry points.
- Server Functions own validated client-to-server operations with server-side authentication and authorization.

Use the installed Effront version's exports for each environment.
Do not mix RSC, SSR, and browser conditional imports or let server bindings and secrets enter a browser bundle.
Treat Server Function input as untrusted transport input and return serializable contract values rather than service instances.
Keep business workflows in services that both HTTP endpoints and Server Functions can call.
Use supported Effront navigation behavior for transitions instead of inventing a separate router.
Verify navigation, mutation failures, and rendering across server and browser boundaries.

## Services and hosting

Effront core provides native Effect HTTP, while its Alchemy adapter is a separate integration package.
Compose that verified adapter rather than layering a second independent HTTP server over Effront.
Use [services and runtime](../knowledge/effect/services-runtime.md) for reusable Layer and lifetime conventions.
Provide request-scoped authentication and request values at the server composition boundary.
Do not retain those values in a process-wide runtime or reuse one user's request service for another request.
Keep shared resource lifetime separate from request-scoped lifetime and close each at its owning boundary.

Select Workers first and Containers only when a mandatory capability cannot be met on Workers.
Use a non-Cloudflare host only after establishing why both targets cannot meet that requirement.
The existence of a Node or Bun adapter does not make that runtime the standard service host.
Verify the installed adapter supports the selected target instead of assuming every Effront adapter is interchangeable.

## UI components and existing applications

Use the Base UI-based variant of [shadcn/ui](https://ui.shadcn.com/docs), not its Radix-based variant, for new browser UI.
Confirm the selected generator or registry output actually uses [Base UI](https://base-ui.com/react/overview/quick-start).
Do not assume a generic shadcn/ui initialization command selects Base UI, and do not invent its flags.
Do not replace existing Radix components during unrelated maintenance.
Form and client-state library choices require their own demonstrated need rather than following implicitly from this UI baseline.

Maintain existing Remix and Hono implementations only within their current contracts.
They are not defaults for new applications.
Track replacement work in [Issue #60](https://github.com/totto2727-org/agent/issues/60) rather than creating a permanent migration guide.
For custom browser Enter-to-submit behavior, use [IME-safe submission](../../../js-coding/references/ime-safe-enter-submit.md).
Use [js-test](../../../js-test/SKILL.md) for UI and integration test implementation.
