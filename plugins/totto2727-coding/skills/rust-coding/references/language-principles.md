# Rust Language Principles

## Ownership and borrowing

`Arc<T>` shares ownership, but does not make `T` thread-safe.
Its `Send` and `Sync` implementations still depend on `T`.
Do not hold lock guards across suspension or external I/O without a concrete lifetime requirement.

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
