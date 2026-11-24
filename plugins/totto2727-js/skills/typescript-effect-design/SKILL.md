---
name: typescript-effect-design
description: >-
  Design TypeScript workflows that use Effect services, typed failures, scoped resources, and cancellation.
---

# TypeScript Effect design

Use this skill when deciding which layer provides a service, which caller handles a typed failure, or how long a resource stays alive.
For modeling values and narrowing types independently of Effect, use [TypeScript type design](../typescript-type-design/SKILL.md).

Use pure Effect data APIs directly. Compose an `Effect` when an operation needs services, can fail, or owns a resource.
Keep native APIs at host and third-party boundaries. Do not add Effect to an unrelated public library or rewrite an upstream-first fork to satisfy a local default.

## Decisions a lint check cannot make

- Provide services at the composition root that owns their lifetime. Keep requirements visible to callers rather than constructing private runtimes inside reusable functions.
- Execute the complete workflow at the boundary that owns its lifetime. Converting part of a workflow to a Promise can leave state changes outside its recovery and cancellation scope.
- Translate typed failures with `Effect.mapError`. Recover with `Effect.catchTag` only where the caller can handle that case. Preserve the cause without treating defects or interruption as recoverable failures.
- Choose `HashSet` only if its equality and hashing match the domain's definition of identity.

For a `rules/<id>` diagnostic, use the installed [oxlint skill](https://github.com/totto2727-org/oxlint/blob/main/skills/oxlint/SKILL.md) or open its rule index at that link. Check the consumer's active preset and overrides before relying on a rule.
Use [share-coding](../share-coding/SKILL.md) for language-independent design and [js-stack](../js-stack/SKILL.md) for library-specific knowledge, including Hono migration and existing Remix handlers.

If the linked skills are not installed, read the source: [share-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-coding/SKILL.md).
