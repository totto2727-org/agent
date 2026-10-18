# Effect Schema Integration

Match codec and decoder APIs to the [installed Effect version](../effect.md#schema-guide).
Use an Effect Schema decoder at untyped ingress, then validate domain invariants that the wire schema does not express.
Use transport-specific codecs for JSON, form data, or URL parameters.
Keep HTTP contract schemas within the supported Effect HTTP API, not a parallel transport type system.
