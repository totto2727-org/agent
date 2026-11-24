# MoonBit Arrays

> Document type: concrete MoonBit implementation guidance.

Prefer a collection transformation over a mutable result buffer for ordinary selection, mapping, or aggregation. Look up the operation on the actual input type in the [MoonBit core library](https://mooncakes.io/docs/moonbitlang/core).

## Unique collections

When uniqueness is a domain invariant, use `@immut/hashset` or `@immut/sorted_set` according to the required equality and ordering semantics. Reject duplicate input before set construction when duplicates are invalid; do not let collection construction silently erase an invalid duplicate. Convert to `Array` only at a boundary that requires a sequence, and make any required ordering explicit there.

## Ownership boundary

Arrays are shared references. Treat an array received from a caller as read-only unless the function contract explicitly transfers mutable ownership.

```mbt check
fn appended_origin(coords : Array[Coord]) -> Array[Coord] {
  [..coords, Coord::new(0.0, 0.0)]
}
```

Operations such as `push`, `append`, `sort`, `reverse`, `clear`, `swap`, removal, and element assignment are observable through aliases. Copying an input before mutation avoids alias corruption, but prefer an immutable operation when it expresses the transformation directly.

## Mutation exceptions

Local mutation is appropriate when it is part of a genuinely stateful algorithm and cannot escape its owner. Examples include:

- Iterator cursors captured by one iterator implementation.
- A builder whose mutable buffer is private until `build()` returns an immutable value.
- Parsers, graph traversals, geometric kernels, and similar state machines where immutable rewriting would obscure the algorithm.
- A measured hot path whose profiling evidence justifies a private mutable buffer.

Document the ownership assumption when it is not evident from the type or surrounding code.

## Effectful traversal

An async operation inside a `for` loop remains sequential. Keep dependent operations ordered, but route independent I/O through [MoonBit Concurrency](concurrency.md). Replacing a loop with recursion does not make the work concurrent.

## Review

Classify each remaining mutation before approving a collection change:

- A same-length replacement should normally use `map`.
- A conditional replacement with append should normally use `fold` plus a pure upsert helper.
- A manual `mut found` flag should normally use `any` or `contains`.
- Order-sensitive transformations must preserve first-seen and per-item order in observable tests.
- Element assignment is reserved for algorithms whose working state is intentionally mutable.

Use this scan to find candidates; it is not a correctness verdict by itself:

```bash
rg -n '\bmut\b|\bfor\b|\.push\(|\[[^]]+\]\s*=' mbt --glob '*.mbt'
```
