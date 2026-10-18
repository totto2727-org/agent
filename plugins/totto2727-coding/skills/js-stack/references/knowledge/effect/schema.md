# Effect Schema Integration

Use this reference when selecting a Schema codec or decoder for an integration.
Use [boundary conversion](../../../../js-coding/references/boundary-conversion.md) for the generic ingress, domain, and egress pipeline.

Verify decoder and encoder names against the installed Effect version before writing code.
Select an effectful decoder when failures or required services must remain explicit in the application workflow.
Keep structural wire decoding distinct from semantic domain validation even when both compose in one Effect.
Select the codec for the actual transport, including JSON, form data, or URL parameters, rather than assuming decoded objects are already trusted domain values.
Keep HTTP contract schemas aligned with the supported Effect HTTP API instead of maintaining a parallel unchecked transport type.
Check serialization and decoding failures at the actual HTTP, Server Function, or CLI boundary.

Use the official [Effect documentation](https://effect.website/docs/) and [Schema source guide](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/SCHEMA.md), matched to the installed version through the [Effect index](../effect.md).
