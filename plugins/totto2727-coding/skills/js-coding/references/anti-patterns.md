# Effect-TS Anti-Patterns

For advanced TypeScript users who review Effect failure channels and execution boundaries.

- Use `Effect.mapError` to translate a typed failure and `Effect.catchTag` or `Effect.catchTags` to recover from selected variants.
  Do not turn defects or interruption into recoverable domain failures merely to catch them.
- Define `Data.TaggedError` only when callers need a distinct failure or structured context.
  Preserve structured causes when translating failures.
- Do not run a runtime for each operation inside business services.
  Compose Effects and execute the complete workflow at a real host boundary.
- Do not spread Promise conversion across domain code.
  Convert only at the external SDK, framework, or host boundary that needs it.
  Give the adapter explicit error and resource behavior.
- Do not hide a partial workflow behind `runPromise` and perform its remaining state changes outside the Effect.
  See the [Remix event example](remix-client-events.md#forbidden-partial-boundary-shape).
- Choose `HashSet` only when its equality and hashing preserve the domain's identity contract.
