# TypeScript Collections

> Document type: concrete TypeScript implementation guidance.

Use a collection whose type preserves the domain invariant.
Prefer Effect collections and operations over corresponding native APIs, including Effect `Array` for array operations and `HashSet` when uniqueness is the contract and its equality and hashing semantics match the values.
When controlled mutation is required, select an Effect collection with the required mutation, identity, and ordering semantics rather than defaulting to the platform `Set`.
Keep a native `Set` only at an integration boundary that requires it, or when no applicable Effect collection can preserve the required contract; explain that constraint.

Do not deduplicate an array with a local `includes`, `filter`, or `reduce` helper. Reject duplicate boundary input before set construction when duplicates are invalid; otherwise construct the set directly and keep it as the internal representation.

Convert a set to an array only at a consumer that requires a sequence. Make ordering explicit at that boundary instead of relying on incidental iteration order.
