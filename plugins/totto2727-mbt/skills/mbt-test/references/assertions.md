# MoonBit Test Assertions

For test syntax, snapshot APIs, and panic expectations, use the stack’s [official MoonBit guidance](../../mbt-stack/SKILL.md) or consult [Writing tests](https://docs.moonbitlang.com/en/latest/language/tests.html). Keep test-only imports out of production dependencies.

## Direct results and raised errors

Inspect the whole return value when it is the contract. Snapshot the serialized form if that is what a caller receives. If only a field or predicate is promised, bind the result once and assert that observation. Do not update a snapshot until you have checked that the new behavior is intended.

Use a `panic_` test for an expected abort. When only the occurrence of a raised error matters, use `try!` on that operation in the panic test. When the error's variant or payload is the contract, catch it and inspect that value instead of setting a mutable flag. For a family-conformance test that must continue after each expected error, handle each call separately and fail on any normal return.
