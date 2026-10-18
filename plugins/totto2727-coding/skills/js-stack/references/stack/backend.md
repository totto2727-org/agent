# Backend Composition

Use Effect HTTP with Alchemy for new services.
Apply [shared hosting policy](../../../share-stack/SKILL.md#select-a-service-host) before selecting an adapter.

## HTTP and infrastructure

Define HTTP contracts with Effect `HttpApi`, `HttpApiGroup`, `HttpApiEndpoint`, and request/response types.
Alchemy resource declarations own infrastructure and bindings, not Effect dependency injection.

Use [Alchemy](https://alchemy.run/) and its documented initialization path for [Better Auth](https://www.better-auth.com/docs).
Check that integration against the installed Alchemy version before selecting an initializer.
Do not substitute guessed APIs or custom initialization as the standard path.

## Data access and transactions

Use [Kysely](https://kysely.dev/docs/intro) for new database access, not Drizzle.
Keep existing Drizzle applications during unrelated maintenance.

| Database      | Selection condition                                                   | Official API                                                                    |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Cloudflare D1 | A predetermined batch meets the consistency and rollback requirements | [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) |
| Turso/libSQL  | Interactive transactions need decisions between operations            | [Turso documentation](https://docs.turso.tech/)                                 |

D1 batch is not an interactive transaction API.
Check read-after-write requirements, rollback, concurrent updates, and client lifetime against the selected API.
Initialize the installed Kysely dialect from Alchemy bindings at the I/O service boundary.

The reusable Kysely Effect facade is future work in [Issue #62](https://github.com/totto2727-org/agent/issues/62).
Its API and implementation location are not established.
Do not present `Kysely.LibSQL` or another hypothetical facade as available.
Until then, keep the Effect adapter limited to checked APIs from installed packages.

## Schema ownership and migration application

Apply [shared database policy](../../../share-stack/SKILL.md#own-database-schemas-and-migrations) for Atlas Schema First and migration application.
`atlas-to-kysely` generates TypeScript table and DB interfaces, not an ORM runtime or Effect facade.
Use the installed [Alchemy D1](https://alchemy.run/cloudflare/data/d1/) migration-directory contract for reviewed SQL.
