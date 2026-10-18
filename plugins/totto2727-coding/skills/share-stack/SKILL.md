---
name: share-stack
description: >-
  Select and maintain shared toolchain, dependency, task, CI, hosting, GUI, and distribution policies. Use when choosing a standard stack, native GUI framework, or service host, aligning development and CI commands, or organizing build and test tasks across languages. Keep language-specific choices in the language profile. Not for application-code design or library API lookup alone.
---

# Shared Stack Policy

Use this guidance when maintaining a project's development and distribution setup.
Read the repository instructions, template, manifests, lockfiles, task configuration, and CI before proposing changes.

## Keep one owner for each policy

| Owner                                                                 | Responsibility                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `share-stack`                                                         | Shared selection rules, environment boundaries, dependency safeguards, task execution, CI, and distribution checks.                     |
| A language stack's `references/stack/share.md`                        | That language's compiler, runtimes, package manager, formatter, linter, build and test tools, concrete commands, and supported targets. |
| A language stack's use-case references                                | Frontend, backend, CLI, desktop, and library composition, with their selection conditions.                                              |
| A language stack's `references/knowledge/`                            | Library-specific conventions, compatibility constraints, and links to official documentation or skills.                                 |
| [`share-coding`](../share-coding/SKILL.md) and language coding skills | Types, boundaries, effects, abstractions, and implementation anti-patterns.                                                             |
| [`share-test`](../share-test/SKILL.md) and language test skills       | Test implementation, assertions, isolation, and fixtures.                                                                               |

Apply shared policies by reference rather than copying them into each language profile.
Keep language-specific compiler versions, tool invocations, and library APIs in the language profile.
Link official library guidance instead of creating one skill per library.
When an official skill exists, prefer its installed copy and provide its official source and documentation fallback.
Do not distribute a copy of that skill's documentation.
Keep temporary migration plans and progress in project issues rather than permanent stack references.
Keep reusable target architecture and library guidance in the stack.

## Select a language profile

Read only the profile needed for the requested work.
Use its coding counterpart for implementation principles rather than treating stack selection as code-design guidance.

| Scope                     | Stack                                      | Coding                                               |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| JavaScript and TypeScript | [JS stack](../js-stack/SKILL.md)           | [JS coding](../js-coding/SKILL.md)                   |
| MoonBit                   | [MoonBit stack](../mbt-stack/SKILL.md)     | [MoonBit coding](../mbt-coding/SKILL.md)             |
| Rust                      | [Rust stack](../rust-stack/SKILL.md)       | [Rust coding](../rust-coding/SKILL.md)               |
| Go                        | [Go stack](../go-stack/SKILL.md)           | [Go coding](../go-coding/SKILL.md)                   |
| Haskell                   | [Haskell stack](../haskell-stack/SKILL.md) | [Haskell coding](../haskell-coding/SKILL.md)         |
| Nix infrastructure        | [Nix stack](../nix-stack/SKILL.md)         | [Shared coding principles](../share-coding/SKILL.md) |

Nix owns flake, package, overlay, and module mechanics.
The language profile still owns its compiler declaration, package manager, supported targets, and application architecture.

## Select a baseline without forcing a migration

Follow explicit user requirements and repository instructions before shared defaults.
Use the applicable workspace template and approved language profile as the baseline.
If no approved language profile exists, retain the repository and template baseline and report the missing profile.
Do not invent a profile or treat its absence as permission to standardize existing tools.
Keep its compiler, runtime, formatter, linter, test tools, and pinned environment.
Add only what the requested behavior requires.

Distinguish a new-project default from an existing application's maintenance profile and an upstream-first fork.
Do not replace a working stack merely to make repositories look alike.
For an upstream-first fork, preserve upstream tools and runtime behavior unless a demonstrated requirement needs a change.
Record required divergence in the repository's maintained divergence record.

When repositories use different package managers, database libraries, UI libraries, compiler sources, or targets, show the alternatives and constraints.
Ask the user before unifying them unless that specific decision is already approved.
Do not ask again about an approved decision or treat it as approval for unrelated migrations.

## Select a service host

Use Cloudflare as the default for hosted application services.
Apply this priority before selecting a server runtime or deployment provider:

| Service implementation   | Required hosting priority                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| TypeScript or JavaScript | Cloudflare Workers first. Use Cloudflare Containers only when Workers cannot satisfy a required capability. |
| Other languages          | Cloudflare Containers as the default for serverless service operation.                                      |

Use an environment outside this priority only when the required behavior cannot be achieved on the applicable Cloudflare targets.
For TypeScript or JavaScript, establish why both Workers and Containers cannot meet the requirement before selecting another environment.
Name the requirement, the relevant platform constraint, the evidence, and the smallest necessary exception before making that choice.
Familiarity with another host or a preferred framework alone is not sufficient.
Check current platform capabilities instead of assuming a limitation from an old version.

This is a service-hosting policy, not a requirement to deploy every library, development tool, or build artifact as a service.
When a product must execute on a user's device, identify that requirement explicitly rather than treating its language as an exemption.
Keep build tools and package managers separate from the selected production host.
Do not migrate an existing deployment or an upstream-first fork merely to apply the new-project default.

## Select a GUI stack

Use GPUI as the standard for native GUI applications across the workspace, not only for projects whose other components are written in Rust.
Keep Rust-specific GPUI integration and concrete APIs in the Rust stack profile and link official library guidance.
Do not assume that every language has a supported GPUI binding or replace an existing GUI during unrelated maintenance.
Keep this native GUI choice separate from the approved Effront browser application stack and from service-hosting requirements.

## Own database schemas and migrations

For an application-exclusive local database, such as on-device storage, let that application select its schema and migration mechanism.
Do not apply this exception to a local development replica of a remote database.

For remote databases, use Atlas to own the canonical schema and versioned migration generation.
Use a schema-first workflow, with declarative changes for local development replicas and reviewed versioned migrations for remote environments.
Keep generated language types separate from the schema and migration source.
Generating types does not prove that the checked-in migrations reproduce the canonical schema.
Replay migrations and compare the resulting schema when that boundary changes.

Choose one application mechanism and one applied-history owner for each deployed database.
For D1, use Alchemy's existing migration mechanism to apply approved SQL instead of adding an independent runner.
Check the pinned Alchemy version's directory contract before connecting Atlas output.
Keep Atlas checksum validation separate if the application mechanism does not validate `atlas.sum`.
Do not assume that an existing Atlas revision table is adopted by another runner.

SQL-file compatibility does not establish safe execution on every target.
D1 does not provide ordinary SQLite foreign-key disabling through `PRAGMA foreign_keys = off` inside its implicit transactions.
A parent-table rebuild can trigger cascading deletion even when the migration reports success.
Check data preservation as well as the resulting schema and migration history.
An empty foreign-key check alone does not prove that rows were preserved.
Do not replace foreign-key disabling with deferred checking and assume that cascades are disabled.
Reject or require a safe reviewed alternative for generated SQL that cannot preserve the required data.

Use the [Atlas workflow documentation](https://atlasgo.io/) and [D1 foreign-key documentation](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) for the target's current constraints.
Keep DB access-library choices and language-specific type generation in the applicable language stack.

## Keep environments and dependencies explicit

Use the repository's pinned development environment and documented non-interactive entry points.
When the repository uses Nix, use its flake and lockfile rather than an ambient global toolchain.
Separate the development toolchain, build toolchain, application runtime, package manager, and consumer compatibility requirements.
Selecting one does not silently change the others.
Do not add Node.js to a native-language project solely for uniform command names.

Use each ecosystem's manifest and authoritative lockfile for their intended purposes.
Do not duplicate resolved versions in guidance or add another package manager's lockfile.
Select the newest compatible dependency release that satisfies the repository's release-age and supply-chain safeguards.
Preserve the waiting period and its effective duration when changing package managers.
Do not copy a manager-specific setting into a tool that does not support it.
For a genuinely urgent exception, explain its evidence, scope, and risk before changing the safeguard.
Preserve explicit repository exceptions without spreading them to other projects.

Keep version-range syntax, lock generation, platform constraints, and compiler compatibility in the language profile.
Do not infer a universal version-range rule from one ecosystem.
Keep deployment credentials in the established environment or secret store, not in skill examples or committed configuration.

## Share task and CI behavior

Read [task orchestration](references/task-orchestration.md) before selecting a runner or changing task graphs, exclusions, cache boundaries, or CI aggregation.
That reference owns runner selection and the meanings of `fix`, `check`, `build`, `test`, and separately selected E2E tasks.
Keep native language entry points available even when an aggregate runner invokes them.
Use the same declared task entry points locally and in CI, with environment differences made explicit.
Do not rewrite CI triggers, publication workflows, or deployment targets just to apply a stack default.

## Verify the promised result

Use the affected project's public commands rather than adding a separate validation mechanism for one change.
Check the selected compiler and target, dependency resolution, task ordering, and resulting artifacts at the boundaries that changed.
For cache changes, verify restored outputs and invalidation as specified in the task reference.
For application packaging, build the real artifact and run it in its promised consumer environment.
For library packaging, check the published contents and the affected consumer entry points.
Do not claim a standalone executable when it still requires an undeclared external runtime.
Keep publishing, deployment, and live-service checks separate from local validation unless authorized.

Report the selected baseline, retained exceptions, decisions that need approval, and observed checks.
Distinguish an unavailable prerequisite from a failed check.
State unverified platforms and integrations instead of bypassing permissions or treating inspection as execution.
