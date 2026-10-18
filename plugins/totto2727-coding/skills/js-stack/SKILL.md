---
name: js-stack
description: >-
  Select and compose JavaScript and TypeScript toolchains and application stacks.
  Use for pnpm and Vite+ setup, dependency compatibility, Bun Nix builds, Effront browser applications, Effect HTTP and Alchemy backends, database composition, or Effect CLI applications.
  Not for language implementation principles, test design, or library API lookup alone.
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
- Implementation: [js-coding](../js-coding/SKILL.md), [Effect knowledge](references/knowledge/effect.md).
- Tests: [js-test](../js-test/SKILL.md).
- Nix packaging: [nix-stack](../nix-stack/SKILL.md).
