---
name: haskell-coding
description: >-
  Apply Haskell-specific exception and evaluation constraints when writing or reviewing Haskell code.
  Use haskell-stack for toolchain and CLI stack selection.
---

# Haskell Coding

For advanced Haskell users who implement or review applications and libraries.
Use [share-coding](../share-coding/SKILL.md) for general design and [haskell-stack](../haskell-stack/SKILL.md) for tools.

- Do not catch asynchronous exceptions without a rethrow in a broad recovery handler.
  Cancellation uses these exceptions.
- Do not use `evaluate` alone when the result must reach normal form.
  It evaluates only to weak head normal form.
- Use deeper evaluation only where deferred exceptions or retained resources affect the required lifetime.

See the official [Control.Exception reference](https://hackage.haskell.org/package/base/docs/Control-Exception.html) and [deepseq reference](https://hackage.haskell.org/package/deepseq/docs/Control-DeepSeq.html).
