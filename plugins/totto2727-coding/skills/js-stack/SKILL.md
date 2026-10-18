---
name: js-stack
description: >-
  Select and compose JavaScript and TypeScript toolchains and application stacks.
  Use for pnpm and Vite+ setup, dependency compatibility, Bun Nix builds, Effront browser applications, Effect HTTP and Alchemy backends, database composition, or Effect CLI applications.
  Not for language implementation principles, test design, or library API lookup alone.
---

# JavaScript and TypeScript Stack

Use this index when selecting or maintaining a JS/TS toolchain or application composition.
It serves implementers who know TypeScript and need the approved stack boundaries, not an API tutorial.
Read repository instructions, manifests, lockfiles, template configuration, and the affected entry points first.
Apply [share-stack](../share-stack/SKILL.md) for shared policy and [js-coding](../js-coding/SKILL.md) for Effect-first implementation principles.
Preserve existing application contracts and upstream-first fork behavior unless their migration is approved.

## Load only the required profile

- [Shared JS toolchain](references/stack/share.md): toolchain, dependencies, tasks, CI, packaging, and runtime targets.
- [Frontend composition](references/stack/frontend.md): browser applications, RSC, SSR, Server Functions, and navigation.
- [Backend composition](references/stack/backend.md): HTTP services, authentication, data access, and infrastructure wiring.
- [CLI composition](references/stack/cli.md): new command-line applications and approved CLI migrations.
- [Effect knowledge index](references/knowledge/effect.md): Effect imports, Schema behavior, service definitions, and runtime lifetime.
- [Effront integration](references/knowledge/effront.md): conditional imports and adapter compatibility.

Use official version-matched documentation for exact APIs rather than creating a skill for each library.
Do not infer an initializer, adapter, or host capability from a package name.
If compatibility cannot be established, report the missing evidence and stop that integration instead of inventing code.
Use [js-test](../js-test/SKILL.md) for test implementation and [nix-stack](../nix-stack/SKILL.md) for Nix mechanics.
Keep temporary Hono and Remix replacement work in [Issue #60](https://github.com/totto2727-org/agent/issues/60), not permanent migration guides.

## Verify the selected composition

Check the affected repository's public static checks, build, and selected tests in its pinned environment.
Verify the actual package or application entry point for the selected target.
Keep deployment, publication, and live database changes outside local validation unless authorized.
Report the selected profile, retained exceptions, checks performed, and unverified boundaries.
