---
name: go-coding
description: >-
  Apply Go implementation principles when writing or reviewing Go code, including error propagation, typed inputs, interfaces, context cancellation, and goroutine lifetimes.
  Use go-stack for toolchain, package, and CLI stack selection instead.
---

# Go Coding

For developers who implement or review Go applications and libraries.
Apply [share-coding](../share-coding/SKILL.md) for language-independent design.
Use [go-stack](../go-stack/SKILL.md) for tools and application composition.
Keep repository compatibility requirements and upstream-first fork conventions.

## Errors and typed boundaries

- Return an `error` for recoverable failure rather than calling `panic`, `log.Fatal`, or `os.Exit` in reusable code.
- Add operation context with `fmt.Errorf("read configuration: %w", err)` when callers must retain the cause.
- Use `errors.Is` and `errors.As` for decisions, not error-message matching.
- Define sentinel or structured errors only when callers need stable distinctions or fields.
- Avoid returning a typed nil pointer as an `error`, because the resulting interface is not nil.
- Decode external input into explicit structs, then validate domain invariants before execution.
- Choose JSON unknown-field and trailing-input handling from the boundary contract rather than assuming decoding proves validity.
- Keep fields private when a constructor must protect an invariant, and document whether the zero value is usable.

## Interfaces and ownership

- Accept concrete values unless a consumer needs substitution or a smaller capability boundary.
- Define small interfaces at the consuming package rather than making an interface for every exported struct.
- Keep implementation details in unexported declarations or `internal` packages.
- Treat slices and maps as shared mutable storage when passing or returning them.
- Copy at an ownership boundary when callers must not mutate retained state.
- Do not copy mutex-containing values after use.

## Cancellation and resource lifetimes

- Pass `context.Context` as the first argument for operations that can block or be canceled.
- Propagate the caller's context instead of replacing it with `context.Background` inside an operation.
- Do not use context values as an optional-argument bag or dependency container.
- Call the cancel function for each derived cancelable context when its scope ends.
- Give each goroutine an owner, a termination condition, and a way for that owner to wait for completion.
- Ensure blocking channel operations can stop when the owning operation is canceled.
- Bound concurrent work when input size or downstream capacity requires it.
- Let the sending owner close a channel after all sends finish, not a receiver that cannot know whether sends remain.
- Use `defer` after successful acquisition, but use a smaller function scope when a loop must release resources per iteration.
- Check write, flush, and close errors when they determine whether an output artifact is complete.

## Check the changed behavior

Check failure identity after wrapping, invalid boundary input, cancellation, and goroutine completion where affected.
Use the standard test and race commands in [go-stack](../go-stack/references/stack/share.md).
Consult the official [errors](https://pkg.go.dev/errors), [context](https://pkg.go.dev/context), and [Go code review guidance](https://go.dev/wiki/CodeReviewComments) for API behavior.
