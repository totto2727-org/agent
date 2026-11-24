---
name: mbt-coding
description: Choose a public construction or failure boundary for a workspace MoonBit package.
---

# MoonBit public API decisions

When a type has an invariant, expose one validated construction path. The workspace convention for that entry point is `Type::Type`, not a second `new` alias. [Admiral's command definitions](https://github.com/totto2727-org/admiral/blob/main/src/runner.mbt) show the named constructor and labelled arguments in a public API. If every field combination is valid, do not invent validation or a builder.

Keep a recoverable domain failure typed when callers must branch on its cause. Return `Result` when the value must be retained or passed on instead of immediately propagating the failure. Do not flatten a typed cause to display text at a library boundary.

For language syntax, compiler diagnostics, or standard library APIs, use the installed [moonbit-orientation](https://github.com/moonbitlang/skills/tree/master/skills/moonbit-orientation) skill. For dependency and target choices, use [mbt-stack](../mbt-stack/SKILL.md).
