---
name: js-stack
description: >-
  Choose a JavaScript or TypeScript toolchain, web or CLI stack, or migrate Hono handlers to Effect.
---

# JavaScript and TypeScript Stack

| Scope                    | Selected technologies                                            | Details                                  |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------- |
| Shared toolchain         | pnpm + Vite+, Bun for Nix application builds                     | [Toolchain](references/stack/share.md)   |
| Browser application      | Effront + Base UI-based shadcn/ui                                | [Frontend](references/stack/frontend.md) |
| Backend                  | Effect HTTP + Alchemy + Better Auth + Kysely, D1 or Turso/libSQL | [Backend](references/stack/backend.md)   |
| Command-line application | Effect CLI                                                       | [CLI](references/stack/cli.md)           |

- Audience: advanced TypeScript users selecting application stacks.
- Shared policy: [share-stack](../share-stack/SKILL.md).
- Implementation: [TypeScript Effect design](../typescript-effect-design/SKILL.md), [TypeScript type design](../typescript-type-design/SKILL.md), [Effect knowledge](references/knowledge/effect.md).
- Replacing Hono with Effect HTTP or effront: [migration guide and public import map](references/knowledge/hono-to-effect/README.md).
- Maintaining existing `remix/ui` handlers: [client event boundaries](references/knowledge/remix-client-events.md).
- Tests: [js-test](../js-test/SKILL.md).

If the linked skills are not installed, read the source: [share-stack](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-stack/SKILL.md).
