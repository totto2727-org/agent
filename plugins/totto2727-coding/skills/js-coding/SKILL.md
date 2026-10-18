---
name: js-coding
description: >-
  Apply Effect-TS-first implementation principles when writing or reviewing JavaScript and TypeScript types, boundaries, state, errors, collections, strings, dates, or HTTP operations.
  Use js-stack for toolchain selection and application composition, and js-test for test implementation.
---

# Effect-TS Coding Index

Use this index for implementers who know TypeScript and need language-specific implementation decisions.
Use [share-coding](../share-coding/SKILL.md) for language-independent design and [js-stack](../js-stack/SKILL.md) for toolchains and concrete application composition.
Read only the reference needed for the affected concern.

## Write Effect-TS, not plain TypeScript

Write Effect-TS rather than plain TypeScript with occasional Effect wrappers.
Prefer Effect APIs over all corresponding JavaScript, TypeScript, and Web standard APIs.
Apply this rule to pure data operations as well as I/O, not only asynchronous code or error handling.

- Arrays: use Effect `Array` instead of native array methods or custom helpers.
- Strings: use Effect `String` instead of native string methods or custom helpers.
- Dates and time: use Effect `DateTime` and `Clock` instead of native `Date`, `Date.now()`, or manual date arithmetic.
- Outbound HTTP: use Effect `HttpClient`, `HttpClientRequest`, and `HttpClientResponse` instead of direct `fetch` or native request/response objects.
- Server HTTP: use Effect `HttpServerRequest`, `HttpServerResponse`, `HttpApi`, `HttpApiGroup`, and `HttpApiEndpoint` instead of native classes or unchecked transport contracts.

Choose the Effect API first whenever it provides the required operation.
Do not choose a standard API merely because it is shorter or familiar.
Keep native objects only at host or third-party boundaries that require them, and convert there to or from Effect types.
Use modules and import paths supported by the installed version, verified through [Effect sources](../js-stack/references/knowledge/effect.md).
Do not invent an Effect replacement for an unsupported platform capability.
Keep a necessary native operation in the smallest verified adapter and explain why no applicable Effect API satisfies the requirement.
Do not wrap a pure Effect `Array` or `String` operation in an `Effect` merely to make it appear effectful.
Keep real failures, dependencies, and resource lifetimes explicit through Effect's types and services.

These defaults apply to new application implementation, not automatic rewrites of upstream-first forks.
Preserve upstream behavior unless a demonstrated requirement authorizes divergence.
Do not impose an unnecessary Effect dependency on consumers of a public library.
For a new CLI or an approved CLI migration, follow the required [Effect CLI composition](../js-stack/references/stack/cli.md).
Preserve an existing CLI contract during unrelated maintenance.

## Reference routing

- [Boundary conversion](references/boundary-conversion.md): weak inputs, wire models, domain conversion, and encoding.
- [State modeling](references/state-modeling.md): discriminated unions and exhaustive transitions.
- [Error handling](references/error-handling.md): typed failures, recovery, and error translation.
- [Collections](references/collections.md): collection invariants and boundary conversion.
- [Anti-patterns](references/anti-patterns.md): misuse of Effects, runtime execution, and native APIs.

## Package manager

Use [js-stack package-manager guidance](../js-stack/references/stack/share.md#package-manager).
This section preserves the public entry point while the stack owns concrete tooling choices.

## Dependency versions

Use [js-stack dependency guidance](../js-stack/references/stack/share.md#dependency-versions) for compatible ranges and release-age safeguards.

## Type boundaries

Use the boundary, state, error, and collection references in the routing list above.
They own the language-specific implementation principles rather than application wiring.

## Effect

Use [Effect knowledge](../js-stack/references/knowledge/effect.md) for version checks and [services and runtime](../js-stack/references/knowledge/effect/services-runtime.md) for concrete composition conventions.
The existing `effect-*.md` reference paths remain forwarding entry points.

## Existing Hono integrations

Read these references only when maintaining existing Hono code.
New backend composition belongs to [Effect HTTP plus Alchemy](../js-stack/references/stack/backend.md).

- [Handler boundary](references/hono-handler.md)
- [Middleware context](references/hono-middleware.md)
- [Sub-app construction](references/hono-subapp.md)
- [HTTP error types](references/hono-errors.md)
- [Middleware ordering](references/hono-ordering.md)

## Browser input

Read [IME-safe Enter submission](references/ime-safe-enter-submit.md) only for custom Enter-to-submit behavior or premature submission during IME conversion.

## Existing Remix integrations

Read [Remix client events](references/remix-client-events.md) only for existing Remix maintenance.
Use [Effront composition](../js-stack/references/stack/frontend.md) for new browser applications.

## @totto2727/fp

Read the [package-specific index](references/totto2727-fp.md) only when the repository already uses that package or explicitly requires it.
Do not introduce it as a prerequisite for generic Effect code.

## Related skills

Use [js-stack](../js-stack/SKILL.md) for toolchain and composition decisions and [js-test](../js-test/SKILL.md) for TypeScript test implementation.
