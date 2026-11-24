---
name: js-coding
description: >-
  Design or review Effect-first TypeScript boundaries, data, resource ownership, and failure handling.
---

# JavaScript and TypeScript coding

Use pure Effect data APIs directly. Compose an `Effect` when an operation needs services, can fail, or owns a resource.
Keep native APIs at host and third-party boundaries. Do not add Effect to an unrelated public library or rewrite an upstream-first fork to satisfy a local default.

## Decisions a lint check cannot make

- Execute the complete workflow at the boundary that owns its lifetime. Converting part of a workflow to a Promise can leave state changes outside its recovery and cancellation scope.
- Translate typed failures with `Effect.mapError`. Recover with `Effect.catchTag` only where the caller can handle that case. Preserve the cause without treating defects or interruption as recoverable failures.
- Choose `HashSet` only if its equality and hashing match the domain's definition of identity.

Use [oxlint](../oxlint/SKILL.md) for a `rules/<id>` diagnostic. Check the consumer's active preset and overrides before relying on a rule.
Use [share-coding](../share-coding/SKILL.md) for language-independent design and [js-stack](../js-stack/SKILL.md) for library-specific knowledge, including Hono migration and existing Remix handlers.
For custom browser Enter-to-submit behavior, see [IME-safe submission](references/ime-safe-enter-submit.md).

If the linked skills are not installed, read the source: [share-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-coding/SKILL.md).
