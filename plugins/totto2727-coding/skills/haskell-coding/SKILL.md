---
name: haskell-coding
description: >-
  Apply Haskell implementation principles when writing or reviewing Haskell code, including algebraic data types, typed failures, total functions, laziness, effect boundaries, and resource lifetimes.
  Use haskell-stack for tools and CLI library selection instead.
---

# Haskell Coding

For developers who implement or review Haskell applications and libraries.
Apply [share-coding](../share-coding/SKILL.md) for language-independent design.
Use [haskell-stack](../haskell-stack/SKILL.md) for tools and application composition.
Preserve the repository's language extensions, public compatibility, and upstream-first fork conventions.

## Types and total functions

- Use sum types for alternatives and `newtype` for distinct domain values with the same representation.
- Hide constructors when callers must use a validating smart constructor.
- Prefer exhaustive pattern matching and total alternatives to `head`, `read`, `fromJust`, or incomplete patterns on untrusted input.
- Use `Maybe` for absence and `Either DomainError a` for a recoverable failure with a reason.
- Keep typed decoding separate from semantic validation, even when both compose in one parser.
- Convert external JSON into an explicit wire type before constructing domain values.
- Do not propagate generic JSON values or textual parser failures as the internal domain model.

## Failures and effects

- Keep deterministic domain transformations pure, with explicit inputs and results.
- Use `IO` at effect boundaries and pass required operations or a small environment from the composition root.
- Use `ExceptT` when typed failures must compose with effects, not to wrap every pure function.
- Translate expected external failures into the application's error type at the adapter that owns them.
- Catch specific synchronous exceptions that the adapter can handle rather than catching `SomeException` and returning success.
- Preserve asynchronous exceptions used for cancellation instead of swallowing them in a broad recovery handler.
- Do not use `unsafePerformIO` to hide configuration reads, mutable state, or dependency selection in pure code.
- Do not introduce a larger effect framework unless the repository's requirements justify it.

## Evaluation and lifetime

- Account for laziness when an I/O result can defer reading, decoding, or failure until after resource cleanup.
- Use `bracket` or a scoped resource function such as `withFile` for acquisition and release.
- Do not return a lazy value that still requires a handle closed by that scope.
- Prefer strict input or force the required result inside the scope when deferred evaluation would escape it.
- `evaluate` forces only weak head normal form, so use the required deeper evaluation when nested thunks can retain resources or defer exceptions.
- Use strict accumulators such as `foldl'` when a lazy accumulation would retain an unbounded chain of thunks.
- Add strict fields or deeper forcing for a demonstrated space or lifetime requirement, not as a blanket replacement for laziness.
- Give concurrent work an owner that waits for it and cancels it when its scope ends.

## Check the changed behavior

Check invalid decoding, domain error variants, exhaustive state handling, and cleanup on failure or cancellation where affected.
For a lazy computation, check that required output is evaluated within the intended resource scope.
Use [Hspec and native commands](../haskell-stack/references/stack/share.md) for execution.
Consult the official [base documentation](https://hackage.haskell.org/package/base), [Control.Exception](https://hackage.haskell.org/package/base/docs/Control-Exception.html), and [ExceptT documentation](https://hackage.haskell.org/package/transformers/docs/Control-Monad-Trans-Except.html) for exact behavior.
