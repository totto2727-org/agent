---
name: share-stack
description: >-
  Select shared stack policies for hosting, native GUI, dependencies, tasks, and database migrations. Use for cross-language stack decisions. Use language stacks for concrete tools and coding skills for implementation principles.
---

# Shared Stack Policy

For advanced users who select or change a project's stack.

## Keep one owner for each policy

| Owner                                                               | Content                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| `share-stack`                                                       | Shared defaults and exceptions.                           |
| A language stack's `references/stack/share.md`                      | Compiler, package manager, tools, and targets.            |
| A language stack's other references                                 | Application composition and library-specific constraints. |
| [share-coding](../share-coding/SKILL.md) and language coding skills | Implementation principles.                                |
| [share-test](../share-test/SKILL.md) and language test skills       | Test implementation.                                      |
| [nix-stack](../nix-stack/SKILL.md)                                  | Nix infrastructure and package definitions.               |

Use official library URLs instead of separate library skills or copied manuals.
Prefer an installed official skill when one exists.
Keep migration plans and progress in issues.

## Select a language profile

| Language                  | Stack                                      | Coding                                       |
| ------------------------- | ------------------------------------------ | -------------------------------------------- |
| JavaScript and TypeScript | [JS stack](../js-stack/SKILL.md)           | [JS coding](../js-coding/SKILL.md)           |
| MoonBit                   | [MoonBit stack](../mbt-stack/SKILL.md)     | [MoonBit coding](../mbt-coding/SKILL.md)     |
| Rust                      | [Rust stack](../rust-stack/SKILL.md)       | [Rust coding](../rust-coding/SKILL.md)       |
| Go                        | [Go stack](../go-stack/SKILL.md)           | [Go coding](../go-coding/SKILL.md)           |
| Haskell                   | [Haskell stack](../haskell-stack/SKILL.md) | [Haskell coding](../haskell-coding/SKILL.md) |

## Select a baseline without forcing a migration

These defaults apply to new projects and approved migrations, not unrelated maintenance or upstream-first forks.
Ask before unifying different stacks unless the user has approved that choice.

## Select a service host

| Service                  | Priority                                        |
| ------------------------ | ----------------------------------------------- |
| JavaScript or TypeScript | Cloudflare Workers, then Cloudflare Containers. |
| Other languages          | Cloudflare Containers.                          |

For JavaScript or TypeScript, use Containers only when Workers cannot meet a required capability.
Use another host only when the applicable Cloudflare targets cannot meet a required capability.
For JavaScript or TypeScript, give the evidence against both Workers and Containers.
This policy applies to hosted services, not local applications or libraries.

## Select a GUI stack

Use GPUI for native GUI applications across languages.
The [Rust stack](../rust-stack/references/stack/desktop.md) owns GPUI integration.
This choice does not imply that other languages have GPUI bindings.
Use the [JS frontend stack](../js-stack/references/stack/frontend.md) for browser applications.

## Own database schemas and migrations

| Database scope                                 | Schema and migration policy                                   |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Application-exclusive local database           | The application chooses its mechanism.                        |
| Remote database                                | Atlas Schema First with versioned migrations.                 |
| Local development replica of a remote database | Atlas declarative workflow, not the local-database exception. |

Use Alchemy's existing migration mechanism to apply Atlas SQL to D1.
Keep one applied-history owner per database.
Check SQL-file compatibility against the selected Alchemy version.
Do not assume that Alchemy checks `atlas.sum` or adopts an Atlas revision table.
Keep generated language types separate from the schema source.

> [!WARNING]
> D1 parent-table rebuilds can delete child rows through `ON DELETE CASCADE`.
> `PRAGMA foreign_keys = off` does not disable this behavior inside D1's implicit transactions.
> Deferred checking does not disable cascades.
> Require proof of row preservation through the actual migration runner.
> A successful exit or an empty foreign-key check is insufficient.

References: [Atlas](https://atlasgo.io/), [Alchemy D1](https://alchemy.run/cloudflare/data/d1/), [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

## Keep environments and dependencies explicit

Keep development tools, dependency management, application builds, and production runtimes as separate choices.
Use the newest compatible releases that meet the repository's release-age and supply-chain safeguards.
A package-manager change must preserve those safeguards.
Explain an urgent exception's scope and risk before applying it.

## Share task and CI behavior

Use [task orchestration](references/task-orchestration.md) for runner selection and shared task policy.
