# Rust Language Principles

Use this reference when implementing or reviewing Rust production code.
Apply [share-coding](../../share-coding/SKILL.md) for language-independent decisions.
Use [rust-stack](../../rust-stack/SKILL.md) for concrete dependencies and runtime composition.

## Types and state

Represent mutually exclusive states with enums and handle variants exhaustively.
Use newtypes for identifiers and values whose invariants prevent accidental interchange.
Keep fields private when construction must preserve an invariant.
Use `Option` for meaningful absence and `Result` for recoverable failure, not a sentinel value or a boolean plus optional error.
Prefer the smallest visibility that supports the caller, including `pub(crate)` for crate-internal contracts.
Introduce traits for a real substitution or public contract, not for every concrete type.

## Ownership and borrowing

Borrow with `&T` or `&mut T` when the caller retains ownership.
Take owned values when the operation stores, transfers, or consumes them.
Do not clone data only to silence the borrow checker without checking the ownership design and cost.
Use shared ownership only when multiple owners are necessary, and separate shared ownership from synchronized mutation.
Keep lock guards short and avoid holding them across suspension or external I/O.
Keep unsafe code at the smallest boundary and document the invariants that make each unsafe operation valid.

## Result and errors

Return typed errors when callers need to distinguish recovery paths.
Use `?` to propagate failure while retaining the original cause and adding useful operation context at boundaries.
Do not replace structured failures with strings before the caller has classified them.
Keep parse, semantic validation, domain construction, external I/O, and cancellation failures distinguishable where behavior differs.
Avoid `unwrap`, `expect`, and panic for untrusted input or expected operational failures.
Use an explicit invariant justification when a panic is genuinely appropriate.
Translate internal failures into safe CLI, GUI, or public messages at the outer boundary.
Do not expose credentials, filesystem details, or provider payloads through error text.
Log a failure at its responsible reporting boundary instead of logging it again at every propagation step.

## Boundary conversion

Decode external bytes or text into a typed wire model before semantic validation and domain construction.
Deserialization establishes shape, not authorization or all business invariants.
Define missing-field, unknown-field, size, and nesting policies for the actual input contract.
Normalize only when the contract allows it, and construct the domain value from the same representation that passed validation.
Use `TryFrom` or a fallible constructor to prevent invalid wire values from entering domain code.
Treat configuration, command arguments, GUI actions, stored data, tool calls, and remote responses as boundaries.
Do not trust an identifier or a previously rendered control as proof of permission.
Allowlist diagnostic fields and redact secrets and sensitive payloads before reporting or logging.

## Cancellation and lifetimes

Give every spawned task an owner, a cancellation path, and a completion or shutdown policy.
Do not detach work merely to avoid handling its result or lifetime.
Check cancellation safety before dropping a future, racing operations, or retrying a partially completed action.
Distinguish stopping local polling from undoing an external side effect.
Bound queues and concurrency, and define backpressure rather than allowing unbounded work.
Keep blocking work away from an async executor or GUI event loop.
Use lexical ownership and `Drop` for synchronous cleanup, but use explicit shutdown for cleanup that must await I/O.
Do not infer a `'static` requirement means data must leak or become global.
Move owned data into tasks when required and keep borrowed data within a proven lifetime.
On shutdown, stop accepting work, signal cancellation, observe task results, and release resources in a defined order.

## Official sources

- [Ownership and borrowing](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- [Enums and pattern matching](https://doc.rust-lang.org/book/ch06-00-enums.html)
- [Recoverable errors](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)
- [Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
- [Drop](https://doc.rust-lang.org/std/ops/trait.Drop.html)
