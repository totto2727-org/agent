# MoonBit Boundary Conversion

This reference serves developers who implement typed MoonBit input and output boundaries.

## Boundary pipeline

Keep weak external values inside the adapter that receives them.
Convert them through explicit types:

```text
external value -> wire type -> validated domain type -> request type -> external value
```

A wire type mirrors the external contract and can contain the primitive and optional fields that the source actually sends.
A domain constructor validates identifiers, enum cases, units, ranges, and cross-field invariants before returning the internal type.
Keep request and response types separate because they represent independently evolving contracts.
Use typed `raise` effects to expose decoding and validation failures instead of hiding them behind unchecked casts or default values.

## JSON ingress

Decode the external representation at the adapter boundary and expose a typed wire model to the next layer.
Keep syntax errors, structural decoding failures, and domain-validation failures distinguishable.
When decoding a domain type directly, route the decoded fields through its [canonical constructor](constructors.md) so decoding cannot bypass invariants.
Use [JSON stack guidance](../../mbt-stack/references/stack/json.md) for concrete codec selection and external skill routing.

## Admiral ingress

Use the stack's [CLI input conversion](../../mbt-stack/references/stack/cli.md#input-conversion) for the Admiral adapter.
Keep library-owned context out of internal function signatures and represent mutually exclusive command inputs with enums.

## Library adapters

Treat a library type as an external input when it is too broad to encode the domain invariant.
Convert it once in a small adapter, reject unsupported variants there, and expose only the validated domain type to the rest of the program.
Use an owned wrapper when a foreign trait cannot be implemented directly for a foreign type.
Keep wrapper construction and trait behavior under the package that owns the adapter.
