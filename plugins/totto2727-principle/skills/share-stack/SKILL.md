---
name: share-stack
description: Choose a deployment host or migration owner across workspace languages.
---

# Shared stack decisions

Use these defaults for new projects and approved migrations, not to rewrite working applications or upstream-first forks.

## Deployment

Choose Cloudflare Workers for hosted TypeScript services. Use Cloudflare Containers when a process, sandbox, or runtime capability rules out Workers; start with Containers for other languages. This choice does not apply to a local binary or library.

## Database migrations

Keep one owner of applied migration history. A local database used by one application can use its own migration mechanism. For a remote SQL-first database, Atlas owns the schema and versioned SQL; for D1, Alchemy applies that SQL. Generated query types do not own the schema.

For a D1 parent-table rebuild with cascading deletes, assert that existing child rows survive the actual deployment runner. A successful migration and clean foreign-key check do not prove this. See [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

## Development and release

Keep release-age and supply-chain safeguards when changing package managers. Document the urgency, scope, and risk before making an exception. For shared CI and task ownership, see [task orchestration](references/task-orchestration.md).
