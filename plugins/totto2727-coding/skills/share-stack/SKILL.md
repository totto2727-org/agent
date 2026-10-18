---
name: share-stack
description: >-
  Select shared stack policies for hosting, native GUI, dependencies, tasks, and database migrations. Use for cross-language stack decisions. Use language stacks for concrete tools and coding skills for implementation principles.
---

# Shared Stack Policy

## Select a service host

| Service                  | First choice          | Fallback condition                                                                    |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------- |
| JavaScript or TypeScript | Cloudflare Workers    | Use Cloudflare Containers only for required capabilities that Workers cannot provide. |
| Other languages          | Cloudflare Containers | Use another host only for required capabilities that Containers cannot provide.       |

- For JavaScript or TypeScript, justify another host against both Workers and Containers.
- Apply this policy to hosted services, not local applications or libraries.

## Select a GUI stack

| Application                  | Stack                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| Native GUI, across languages | GPUI, with [Rust integration](../rust-stack/references/stack/desktop.md). |
| Browser UI                   | [JS frontend](../js-stack/references/stack/frontend.md).                  |

- Do not infer the availability of non-Rust GPUI bindings.

## Own database schemas and migrations

| Database scope                                 | Stack                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Application-exclusive local database           | Application-owned schema and migration mechanism.                                 |
| Remote database                                | [Atlas](https://atlasgo.io/) Schema First and versioned migrations.               |
| Local development replica of a remote database | Atlas declarative workflow.                                                       |
| D1 migration application                       | [Alchemy D1](https://alchemy.run/cloudflare/data/d1/), using Atlas-generated SQL. |

- Keep one applied-history owner per database.
- Verify the selected Alchemy version's SQL-file contract before applying Atlas output.
- Do not assume support for `atlas.sum` or Atlas revision-table adoption.
- Keep generated language types separate from the schema source.

> [!WARNING]
>
> - D1 parent-table rebuilds can delete child rows through `ON DELETE CASCADE`.
> - `PRAGMA foreign_keys = off` does not disable cascades inside D1's implicit transactions.
> - Deferred checking does not disable cascades.
> - Prove row preservation through the actual migration runner, not only its exit status or foreign-key check.
> - Source: [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

## Keep environments and dependencies explicit

- Separate development tools, dependency management, application builds, and production runtimes.
- Select the newest compatible releases that meet release-age and supply-chain safeguards.
- Preserve those safeguards when changing package managers.
- Explain an urgent exception's scope and risk before applying it.

## Select a language profile

| Language                  | Stack                                      | Coding                                    |
| ------------------------- | ------------------------------------------ | ----------------------------------------- |
| JavaScript and TypeScript | [JS stack](../js-stack/SKILL.md)           | [JS coding](../js-coding/SKILL.md)        |
| MoonBit                   | [MoonBit stack](../mbt-stack/SKILL.md)     | [MoonBit coding](../mbt-coding/SKILL.md)  |
| Rust                      | [Rust stack](../rust-stack/SKILL.md)       | [Rust coding](../rust-coding/SKILL.md)    |
| Go                        | [Go stack](../go-stack/SKILL.md)           | [Shared coding](../share-coding/SKILL.md) |
| Haskell                   | [Haskell stack](../haskell-stack/SKILL.md) | [Shared coding](../share-coding/SKILL.md) |

## Keep one owner for each policy

| Owner                                                  | Content                                     |
| ------------------------------------------------------ | ------------------------------------------- |
| `share-stack`                                          | Cross-language selections and exceptions.   |
| A language stack's `references/stack/share.md`         | Language toolchain.                         |
| A language stack's other `references/stack/` pages     | One application stack per page.             |
| A language stack's `references/knowledge/` pages       | Necessary library-specific constraints.     |
| Coding skills                                          | Implementation principles.                  |
| Test skills                                            | Test implementation.                        |
| [nix-stack](../nix-stack/SKILL.md)                     | Nix infrastructure and package definitions. |
| [Task orchestration](references/task-orchestration.md) | Shared task and CI behavior.                |

- List selected technologies before stack-specific constraints.
- Separate fundamentally different stacks into different pages.
- Do not infer a standard from a template's current configuration.
- Link official library guidance instead of copying manuals or creating a skill for each library.
- Keep migration plans and progress in issues.
- Apply defaults to new projects and approved migrations, not unrelated maintenance or upstream-first forks.
- Ask before unifying different stacks unless the user has approved that choice.
