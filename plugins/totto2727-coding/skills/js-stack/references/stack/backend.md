# Effect HTTP and Alchemy Backend

| Concern                     | Selected technology                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| HTTP contracts and server   | Effect HTTP `HttpApi`                                                   |
| Infrastructure and bindings | Alchemy                                                                 |
| Authentication              | Better Auth through Alchemy's documented initialization                 |
| Database access             | Kysely                                                                  |
| Database                    | D1 for predetermined batches, Turso/libSQL for interactive transactions |
| Schema and generated types  | Atlas Schema First + `atlas-to-kysely`                                  |

## Composition constraints

- Keep Alchemy resource declarations separate from Effect dependency injection.
- Match Better Auth initialization to the installed Alchemy version, not a custom initializer.
- Initialize the installed Kysely dialect from Alchemy bindings at the I/O service boundary.
- Use [Effect service and runtime conventions](../knowledge/effect/services-runtime.md) and [transport Schema guidance](../knowledge/effect.md#transport-codecs).

## Database choice within this stack

| Database     | Transaction requirement                                   | Checks                                                  |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| D1           | Predetermined batch, no decisions between operations      | Batch consistency and rollback                          |
| Turso/libSQL | Interactive transaction with decisions between operations | Interactive transaction support in the installed client |

- Keep Effect HTTP, Alchemy, Better Auth, and Kysely unchanged across these database choices.
- Check read-after-write behavior, rollback, concurrent updates, and client lifetime.
- D1 batch is not an interactive transaction API.
- The Kysely Effect facade in [Issue #62](https://github.com/totto2727-org/agent/issues/62) is not available.
- Use installed package APIs, not a hypothetical `Kysely.LibSQL` facade.

## Schema ownership

- Apply [shared schema and migration policy](../../../share-stack/SKILL.md#own-database-schemas-and-migrations).
- Use `atlas-to-kysely` for TypeScript table and DB interfaces, not an ORM runtime or Effect facade.
- Apply reviewed SQL through the installed [Alchemy D1 migration-directory contract](https://alchemy.run/cloudflare/data/d1/).
