# Backend Composition

Use this reference to compose HTTP contracts, business Effects, infrastructure, authentication, and databases.
The new-service baseline is Effect HTTP plus Alchemy.
Use [shared JS toolchain](share.md) for dependencies and [Effect knowledge](../knowledge/effect.md) for version-specific APIs.
Follow Workers first, Containers second, and another host only after demonstrating that both cannot meet the mandatory requirements.

## Own each boundary once

- Define request, response, endpoint, and error contracts with the installed Effect HTTP `HttpApi`, groups, endpoints, and request/response types.
- Decode untrusted transport input into wire models at ingress, then validate semantic invariants through domain conversion.
- Keep business workflows as Effects with typed failures and service requirements, without runtime execution.
- Give database and outbound network I/O services domain operations and structured failures.
- Select concrete dependencies and their lifecycle at the application composition root through Layers and the host integration.
- Keep infrastructure, stage, bindings, and secret references in Alchemy declarations, separate from application dependency injection.
- Map failures to HTTP and report final diagnostics at the HTTP application boundary, without repeated inner-layer logging.

Use [boundary conversion](../../../js-coding/references/boundary-conversion.md) and [error handling](../../../js-coding/references/error-handling.md) for implementation principles.
Use [services and runtime](../knowledge/effect/services-runtime.md) as the sole owner of reusable service exports, Layer composition, and lifetime conventions.
This backend reference owns the wiring between those services, HTTP contracts, and infrastructure.
Keep native `Request`, `Response`, and Promise conversion inside the minimal verified host adapter when it is required.
Do not add a Hono server around Effect HTTP for new implementations.

## Authentication and infrastructure

Use [Alchemy](https://alchemy.run/) for infrastructure declaration and its documented initialization path for Better Auth.
Verify the installed Alchemy version's official integration API before writing any resource name, import, or initializer call.
Do not substitute a guessed Better Auth initializer or present direct custom initialization as the standard path.
If the integration cannot be verified, report that missing prerequisite rather than inventing code.
Use [Better Auth documentation](https://www.better-auth.com/docs) for supported session and authentication behavior.

Keep stage selection, resource state, configuration, secret references, and application bindings in the infrastructure entry point.
Pass established bindings into application services through the composition root.
Keep session lookup and user decoding in the authentication boundary, and domain authorization in the policy that owns the operation.
Authenticate a request without treating authentication alone as authorization.
Do not put secrets in source, examples, generated client code, or diagnostic output.
Do not confuse Alchemy resource declaration with Layer construction or runtime execution.

## Data access and transactions

Use [Kysely](https://kysely.dev/docs/intro) for new database access rather than Drizzle.
Do not rewrite an existing Drizzle application during unrelated maintenance.
Choose the database from the required consistency and rollback contract, not the query-builder API.

- Select Cloudflare D1 when a predetermined batch meets the consistency requirement, after checking batch and failure behavior.
- Select Turso/libSQL for interactive transactions with decisions between operations, after checking transaction and lifecycle APIs.

D1 batch is not an interactive transaction API.
Check read-after-write needs, decision points, rollback, and concurrent updates before selecting either path.
Use the [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [Turso documentation](https://docs.turso.tech/) for exact capabilities.
Initialize the installed Kysely dialect/client at the I/O service boundary from verified Alchemy bindings.
Keep connection disposal, transaction scope, query errors, and returned domain values explicit in that service.

The reusable Kysely Effect facade for initialization, queries, results, and transactions is future work in [Issue #62](https://github.com/totto2727-org/agent/issues/62).
Its API and implementation location are not established.
Do not teach `Kysely.LibSQL` or another hypothetical facade as an available API.
Until that integration exists, use only verified installed APIs and keep the required Effect adapter small.

## Schema ownership and migration application

Apply [shared database schema and migration policy](../../../share-stack/SKILL.md#own-database-schemas-and-migrations) for Atlas Schema First, local replicas, remote versioned migrations, application-exclusive local DB exceptions, and data-preservation checks.
Keep JS-specific generated TypeScript table and DB interfaces separate from database runtime access.
`atlas-to-kysely` produces those interfaces, not an ORM runtime or an Effect facade.

For D1 composition, connect reviewed Atlas-generated SQL to [Alchemy D1](https://alchemy.run/cloudflare/data/d1/) through the installed version's existing migration directory contract.
Numeric-prefix SQL files can fit that format, but do not assume the runner validates `atlas.sum` or adopts another runner's migration history.
Do not present format compatibility as proof that an Atlas-generated D1 rebuild is safe.
In particular, a `foreign_keys = off` rebuild can silently cascade child-row deletion despite a successful exit.
Apply the shared policy's data-preservation checks to representative parent and child data through the actual runner before approving the SQL.

## Verify the composition

Check request decoding, semantic validation, authentication, authorization, typed failure rendering, and the selected I/O service contracts.
Exercise resource cleanup and request isolation with the installed host adapter.
Use isolated database fixtures for migration and transaction checks, and report any runner or host not actually exercised.
Use [js-test](../../../js-test/SKILL.md) for test implementation rather than duplicating its test rules here.
Track existing Hono and Remix replacement tasks in [Issue #60](https://github.com/totto2727-org/agent/issues/60).
