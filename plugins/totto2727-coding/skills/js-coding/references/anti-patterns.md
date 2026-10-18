# Effect-TS Anti-Patterns

- Do not write ordinary TypeScript with Effects only around selected I/O calls.
  Use Effect-TS data operations, typed failures, requirements, and explicit lifetime.
- Do not select native array, string, or date operations because they are familiar.
  Use the corresponding Effect `Array`, `String`, `DateTime`, and `Clock` APIs.
- Do not use direct `fetch` or native request/response contracts inside business code.
  Use Effect HTTP clients and server contracts with minimal verified host adapters.
- Do not wrap a pure operation in `Effect` without failure or dependencies.
  Use the pure Effect data API directly.
- Do not use `any` or `as` in place of validation.
  Decode at ingress, then validate domain invariants.
- Do not use independent flags and optional values that permit contradictory states.
  Use discriminated unions and exhaustive transitions.
- Do not catch only to log, stringify, rename, or rethrow a failure.
  Propagate the typed failure or translate it once at the owning boundary.
  Use `Effect.mapError` for translation and `Effect.catchTag` or `Effect.catchTags` for recovery.
- Do not repeat diagnostics in each service.
  Render and report the final outcome at the application boundary.
- Do not run a runtime for each operation inside business services.
  Compose Effects and execute the complete workflow at a real host boundary.
- Do not select production or development dependencies inside a business workflow.
  Provide the selected implementation at the composition root.
- Do not spread Promise conversion across domain code.
  Convert only at the external SDK, framework, or host boundary that needs it.

A catch is appropriate when its owner actually recovers or intentionally changes the outcome.
Preserve structured causes when translating failures and do not turn programmer defects into recoverable errors merely to catch them.
Define `Data.TaggedError` only when callers need a distinct failure or structured context.
Choose `HashSet` only when its equality and hashing preserve the domain's identity contract.
When an SDK requires a Promise, expose the smallest adapter with explicit error and resource behavior.
Do not hide a partial workflow behind `runPromise` and perform its remaining state changes outside the Effect.
