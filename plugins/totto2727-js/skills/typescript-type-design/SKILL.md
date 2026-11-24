---
name: typescript-type-design
description: Model TypeScript values and API signatures with domain variants, distinct identifiers, and schema-derived types, with or without Effect.
paths: ["**/*.ts", "**/*.tsx"]
disable-model-invocation: true
---

# TypeScript type design

Choose the values callers can construct and what they can rely on after validation.
Use [type system discipline](../principle-type-system-discipline/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/principle-type-system-discipline/SKILL.md)) for cross-language modeling and [TypeScript Effect design](../typescript-effect-design/SKILL.md) for services, failures, and resource lifetimes.

| Design question                                         | Decision                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which fields belong together?                           | Model each meaningful state as a variant with its own payload. Name the variants after events or states callers recognize.                            |
| Could two valid identifiers be exchanged by mistake?    | Use distinct domain types when their interchange would be a bug. Decide which input checks establish each identity.                                   |
| Is an empty collection a valid input?                   | If absence has a useful result, keep it in the contract. If the operation requires a first element, require a nonempty input.                         |
| Which definition owns a value's shape?                  | Derive from the schema or generated protocol type when it is authoritative. Introduce a separate domain model when wire and domain invariants differ. |
| Can two parameters be swapped without a compiler error? | Group them under names or give them distinct types when the swap changes the result.                                                                  |

See [TypeScript patterns](references/patterns.md) for examples. For test assertions and substitutes, use [TypeScript tests](../js-test/SKILL.md). For HTTP request telemetry, use the [logging recipe](../js-stack/references/knowledge/hono-to-effect/middleware.md#logger).
