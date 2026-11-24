---
name: rust-coding
description: >-
  Design or review Rust ownership, domain types, errors, cancellation, and resource lifetimes.
---

# Rust Coding

For advanced users who implement or review Rust code.
Use [share-coding](../share-coding/SKILL.md) for common design principles.
Use [rust-stack](../rust-stack/SKILL.md) for toolchains and libraries, and [rust-test](../rust-test/SKILL.md) for tests.

## Ownership and borrowing

`Arc<T>` shares ownership, but does not make `T` thread-safe.
Its `Send` and `Sync` implementations still depend on `T`.
Do not hold lock guards across suspension or external I/O without a concrete lifetime requirement.

## Failures and variants

Return `Result<T, E>` for recoverable failures. Use an error enum when callers need different recovery paths, and match its variants rather than parsing `Display` text.
When translating a lower-level error, retain the original error as the source for [`Error::source`](https://doc.rust-lang.org/std/error/trait.Error.html#method.source).
For an enum you own, name the variants in a `match` when each needs a decision. Adding a variant then exposes the missing case at compile time. A foreign `#[non_exhaustive]` enum requires a fallback.

## Cancellation and lifetimes

Future destruction stops local polling, but does not undo an external side effect.
Before a future race or a retry, examine the interrupted operation's cancellation-safety contract.
`Drop` cannot await I/O, so asynchronous cleanup needs explicit shutdown.
A `'static` task bound does not need leaked or global data.
Owned data can satisfy the bound without living forever.

## Official sources

- [Arc thread safety](https://doc.rust-lang.org/std/sync/struct.Arc.html#thread-safety)
- [Future polling](https://doc.rust-lang.org/std/future/trait.Future.html)
- [Tokio cancellation safety](https://docs.rs/tokio/latest/tokio/macro.select.html#cancellation-safety)
- [Drop](https://doc.rust-lang.org/std/ops/trait.Drop.html)
- [Static lifetime bounds](https://doc.rust-lang.org/rust-by-example/scope/lifetime/static_lifetime.html)

If the linked skills are not installed, read the source: [share-coding](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-coding/SKILL.md).
