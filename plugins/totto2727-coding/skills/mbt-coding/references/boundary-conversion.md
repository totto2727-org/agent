# MoonBit Boundary Conversion

This reference serves developers who implement typed MoonBit input and output boundaries.

Use the shared [boundary conversion policy](../../share-coding/SKILL.md#strict-boundary-conversion).
Use typed `raise` effects to expose decoding and validation failures instead of hiding them behind unchecked casts or default values.

## JSON ingress

When decoding a domain type directly, route the decoded fields through its [canonical constructor](constructors.md) so decoding cannot bypass invariants.
Use [JSON integration guidance](../../mbt-stack/references/knowledge/json.md) for concrete codec selection and external skill routing.

## Admiral ingress

Use the stack's [CLI input conversion](../../mbt-stack/references/stack/cli.md#input-conversion) for the Admiral adapter.
Keep library-owned context out of internal function signatures and represent mutually exclusive command inputs with enums.

## Library adapters

Use an owned wrapper when a foreign trait cannot be implemented directly for a foreign type.
Keep wrapper construction and trait behavior under the package that owns the adapter.
