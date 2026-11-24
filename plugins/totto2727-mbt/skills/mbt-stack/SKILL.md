---
name: mbt-stack
description: >-
  Select MoonBit toolchains, build targets, CLI libraries, JSON codecs, or async I/O.
---

# MoonBit stack decisions

## Toolchain and target

For a new Nix project, start from the [MoonBit template](https://github.com/totto2727-org/template-moonbit-simple): use the locked overlay's compiler in both the development shell and the moon-nix package build.
Do not copy a builder or attribute path from a project pinned to another overlay revision.
Follow the [template's target policy](https://github.com/totto2727-org/template-moonbit-simple/blob/main/moon.mod): leave a synchronous, backend-neutral library unrestricted. For async code, prefer Wasm, then JS, then native among targets that support the required host operations and dependencies.
Test the operation that constrains the choice, such as spawning the provider process, on each promised target.
For executable README examples, keep `README.mbt.md` canonical and link `README.md` to it, as the template does.

## Command-line input

Use Admiral for new command grammars. Convert parser results into application input before dispatching domain work.
Prefer the installed [Admiral skill](https://github.com/totto2727-org/admiral/blob/main/.agents/skills/admiral/SKILL.md) for parser choices, or consult the [package guide](https://github.com/totto2727-org/admiral/blob/main/README.mbt.md#defining-options-and-positions).

## JSON contracts

- If the whole value matches the wire format, use [standard derivation](https://docs.moonbitlang.com/en/latest/language/derive.html).
- If the application owns the whole model but the wire format requires aliases, defaults, or nested paths, use [Model's Serde generator](https://github.com/totto2727-org/model/blob/main/README.mbt.md). Add Garde only when decoded values need semantic validation.

## Async work

Use [moonbitlang/async](https://github.com/moonbitlang/async) for independent I/O. Add [Workgraph](https://github.com/totto2727-org/workgraph) only when the application needs explicit steps, state reduction, and routing.
Its sequential graph executor does not make independent nodes concurrent; keep concurrency inside a step if reduction order must stay observable.

For compiler and tooling questions, prefer the installed official [moonbit-orientation](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md), or consult the [MoonBit documentation](https://docs.moonbitlang.com/en/latest/).
For shared policy, use [share-stack](../share-stack/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-stack/SKILL.md)).
