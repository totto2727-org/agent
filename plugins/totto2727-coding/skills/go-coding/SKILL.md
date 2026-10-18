---
name: go-coding
description: >-
  Apply Go-specific ownership and interface constraints when writing or reviewing Go code.
  Use go-stack for toolchain and CLI stack selection.
---

# Go Coding

For advanced Go users who implement or review applications and libraries.
Use [share-coding](../share-coding/SKILL.md) for general design and [go-stack](../go-stack/SKILL.md) for tools.

- Do not return a typed nil pointer as an `error`.
  The interface value is not nil.
- At ownership boundaries, make sure that shared slice and map storage does not permit unwanted mutation.
- Do not copy a value that contains a mutex after its first use.

See the official [Go FAQ on nil errors](https://go.dev/doc/faq#nil_error), [slices reference](https://go.dev/blog/slices-intro), and [sync reference](https://pkg.go.dev/sync).
