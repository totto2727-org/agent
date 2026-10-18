---
name: share-stack
description: >-
  Select and maintain shared toolchain, dependency, task, CI, hosting, and distribution policies. Use when choosing a standard stack or service host, aligning development and CI commands, or organizing build and test tasks across languages. Keep language-specific choices in the language profile. Not for application-code design or library API lookup alone.
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
