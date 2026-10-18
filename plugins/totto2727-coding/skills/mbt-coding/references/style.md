# MoonBit Style

For advanced MoonBit users who implement public APIs and callbacks.

## Documentation

Document every public function, type, method, and constant with `///`.
State caller-visible behavior and constraints rather than restating the signature.

### Project README

Use the stack's [project README guidance](../../mbt-stack/references/stack/share.md#project-readme) for documentation file layout and literate examples.

## Names

- Name Array values with an `_array` suffix when it prevents ambiguity about the representation.
- Use a bare verb for a mutating operation and a past participle for an immutable transformation, such as `sort` versus `sorted`.
- Use the [constructor conventions](constructors.md) for canonical construction and intent-specific factories.
- Add `#alias` or a type alias only when the alternate name is an intentional public contract used by callers.

## Anonymous functions

Prefer arrow functions for inline callbacks.
Use a named local function only when recursion, reuse, or an explicit local signature materially improves the code.

## Labelled arguments

For a top-level function or method with four or more caller-supplied parameters, declare every caller-supplied parameter as labelled (`name~`) or optional labelled (`name?`).
Do not keep a positional parameter merely to make a DSL-style call shorter.
Keep a method receiver positional and exclude it from the parameter count.
This rule does not apply where MoonBit forbids labelled arguments, such as local and anonymous functions, or where an external trait or FFI contract fixes the signature.

## Ignored results

Discard a return value explicitly with `expr |> ignore` when the operation is performed only for its effect.
