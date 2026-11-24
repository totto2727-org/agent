---
name: mbt-stack
description: Choose a MoonBit target, CLI parser, JSON codec, or workflow runtime for a workspace project.
---

# MoonBit stack choices

| Decision        | Workspace choice                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build target    | Follow the [template's target policy](https://github.com/totto2727-org/template-moonbit-simple/blob/main/moon.mod). Leave synchronous backend-neutral libraries unrestricted. For async projects, choose Wasm, then JS, then native among targets that support the required host operations. Test that operation on each promised target. |
| CLI grammar     | Use [Admiral](https://github.com/totto2727-org/admiral/blob/main/.agents/skills/admiral/SKILL.md) for structured arguments. The library owns the parser guide.                                                                                                                                                                            |
| JSON contract   | Use standard derivation when the application type already matches the wire. Choose [Model's Serde](https://github.com/totto2727-org/model/blob/main/README.mbt.md) for aliases, defaults, or nested paths. Add Garde only for semantic validation after decoding.                                                                         |
| Async execution | Use [moonbitlang/async](https://github.com/moonbitlang/async) for independent I/O. Choose [Workgraph](https://github.com/totto2727-org/workgraph) when steps, routing, and state reduction are themselves part of the application. Its sequential executor is not a parallel scheduler.                                                   |

For compiler, package, and backend questions, use [moonbit-orientation](https://github.com/moonbitlang/skills/tree/master/skills/moonbit-orientation) or the [official documentation](https://docs.moonbitlang.com/en/latest/).
