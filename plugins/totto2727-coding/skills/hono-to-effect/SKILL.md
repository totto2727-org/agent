---
name: hono-to-effect
description: >-
  Migrate Hono applications, middleware, helpers, and utilities to Effect HTTP, effront, and @totto2727/effect-http.
  Use for "replace Hono", "Hono to Effect", import-path migration maps, or audits of missing middleware.
  Produce concrete replacements, behavior differences, and verification steps for each supplied Hono import.
  Do not use for ordinary Hono maintenance, Effect-only questions, or implementing excluded Hono internals and host adapters.
---

# Hono to Effect

For developers who know Hono and need to move an application to Effect 4.
This is a migration workflow, not an API-name substitution list or a Hono compatibility layer.
It covers all 81 non-excluded public import paths in the pinned 104-path inventory.
The remaining 23 paths have explicit exclusion reasons.
No OO service, account, or hosted tool is required to use this skill.

## Establish the boundary

1. Inspect the application's imports, Hono version, Effect version, host, middleware order, and observable HTTP behavior.
2. Match each Hono import against [the complete import-path map](references/import-paths.md).
   Include dynamic imports and re-exports when they can be resolved statically.
   Do not silently infer a concrete import from an unresolved expression.
3. Use Effect 4.1.4 as this skill's verified API baseline.
   Do not translate these imports into Effect 3's `@effect/platform` APIs without a separate version-specific investigation.
   For another installed version, verify its actual public exports and signatures before changing code.
4. Separate standalone HTTP endpoints from effront application, rendering, Server Function, assets, and host integration.
   Keep effront-owned behavior in effront, even when Effect has a lower-level equivalent.
5. For an excluded path, state its exclusion reason and the application decision it leaves open.
   An exclusion is not permission to remove a used feature without the user's agreement.
   For a path outside the pinned inventory, investigate it and identify the version difference rather than calling it supported or excluded by default.

## Select and apply a recipe

Read the map first, then load the relevant references directly:

| Reference                                                          | Read when migrating                                                                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Core](references/core.md)                                         | Requests, typed failures, validation, clients, routing, testing, generic streaming, or WebSocket upgrades.                                            |
| [Middleware](references/middleware.md)                             | Authentication, request policies, middleware composition, response transforms, cookies, or proxy forwarding.                                          |
| [Utilities](references/utilities.md)                               | Byte/text conversion, encoding, cryptography, JOSE, IP networks, URL/header/status helpers, or utility aliases.                                       |
| [effront](references/effront.md)                                   | Applications, JSX, HTML, CSS, static assets, Workers, Node, Bun, or host bindings.                                                                    |
| [Standalone policies](references/standalone-policies.md)           | Accept negotiation, Cache-Control, response caching, conditional requests, CSRF, or security headers.                                                 |
| [Implementation proposals](references/implementation-proposals.md) | A primitive composition needs reusable middleware or other substantial policy glue. This is a separate proposal document, not a list of shipped APIs. |

For each non-excluded import, apply the documented sequence and preserve the required observable behavior.
Record the exact target import, configuration, request/response boundary, service requirements, and important differences.
Do not report an API name alone as a completed migration.
Use references as version-bound evidence, not as permission to add every dependency in them.
For standalone Effect HTTP middleware, follow the [route scope and startup rules](references/middleware.md#composition-and-error-boundaries).
For application authentication, follow the [Better Auth migration policy](references/middleware.md#authentication) instead of writing replacement middleware.

### Distinguish availability from integration work

Classify the result for each used feature:

- **Ready API**: an existing public API directly provides the required behavior with configuration.
- **Composition**: ordinary local composition is sufficient, but name the steps and HTTP error mapping.
- **Implementation candidate**: primitives exist, but reusable middleware or substantial policy code does not.
  Link the matching item in the separate proposal document and describe the implementation still needed.
- **effront-owned**: use its public application or host boundary, without duplicating the runtime.
- **Excluded**: use the map's explicit reason and obtain an application decision when removal would change behavior.

An Effect timeout is not an HTTP timeout response policy.
An IP parser is not an access-control middleware.
A cryptographic MAC is not a signed-cookie protocol.
Do not label these compositions as ready middleware or import a proposed API as if it already existed.

## Preserve safety and lifetime

- Keep cryptographic services and host layers caller-provided at the application composition root.
  Never create a runtime or provide a crypto implementation inside a reusable decoder, policy, or identifier generator.
  Initialize shared state during application layer construction and run the application once from its entry point.
- Check authorization, CSRF, and write preconditions before an operation that changes state.
  Response middleware cannot undo a mutation.
- Do not share request services, request scopes, private page output, or Server Function responses across requests.
- Preserve cancellation, resource finalizers, body limits, and response-stream lifetime.
  A timeout around handler construction does not bound later stream consumption.
- Treat forwarded headers as untrusted unless the immediate peer is an explicitly trusted proxy.
- Keep public cache keys and declared `Vary` inputs aligned.
  Do not cache identity-dependent output as public or replace effront's HTML/Flight selection.
- Preserve response transformation order, including Effect's deferred pre-response hooks.
  A strong ETag must identify the final selected representation, not a different pre-compression body.

## Verify the migration

1. Type-check the changed application against its actual dependencies.
2. Exercise real HTTP requests through its public Fetch handler or native test server.
   Compare status, relevant headers, body bytes, and whether rejected requests reached side effects.
3. Test negative paths relevant to the used feature: invalid input, unauthorized requests, unsupported negotiation, cache isolation, timeout interruption, and stream cancellation.
4. For effront changes, run the application's actual Vite build and browser or host acceptance path.
   A TypeScript example alone does not prove RSC, hydration, static serving, or Workers behavior.
5. Report verified behavior separately from untested behavior, implementation proposals, and user-controlled blockers.
   Do not publish packages, deploy infrastructure, change repository visibility, or invoke external services just to execute this skill.

Return a migration table with one row per discovered import and a concrete recipe or exclusion reason.
Include the code changes, meaningful behavior differences, test results, and links to any implementation candidates.
When asked to audit all Hono APIs, include all 104 map rows and do not omit aliases or wildcard exports.

## Maintain the inventory

Run the local checker from any directory with Node.js 24 or newer:

```sh
node /path/to/hono-to-effect/scripts/check-coverage.mjs --hono-root /path/to/pinned-hono --compatibility /path/to/effect-http/docs/hono-compatibility.md
```

It reads local files and Git metadata only.
It does not clone repositories, install dependencies, or call a hosted API.
It requires the exact pinned Hono commit, expands its real public wildcard modules, checks all 104 rows and 81 recipe links, and compares classifications with the maintained effect-http correspondence table.
When changing the upstream baseline, update the map, recipes, checker baseline, and proposal evidence together.
