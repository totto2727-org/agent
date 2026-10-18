# @totto2727/fp Errors

Use this reference only for repositories that already adopt the `@totto2727/fp/error` payload contract.
Do not introduce this dependency as a prerequisite for generic Effect errors.

## Error contract

Use `@totto2727/fp/error` as the canonical shape for domain error payloads. `TaggedErrorBaseType` is the only allowed base type for custom `Data.TaggedError` payloads.

```ts
import type { TaggedErrorBaseType } from "@totto2727/fp/error";

export class BackendError extends Data.TaggedError("BackendError")<TaggedErrorBaseType>() {}
```

Rules:

- Root/domain-boundary errors that are created from the current code path must include a human-authored `message`.
- Translate an upstream failure only when the receiving boundary requires a distinct error vocabulary.
  Prefer `Effect.mapError` for this translation and do not catch merely to wrap and rethrow.
- A translated error must pass the original value through unchanged as `error`; do not stringify, format, map, redact, or replace it.
- Do not use helpers like `formatError`, `formatCause`, `String(error)`, `error.message`, or fallback strings such as `'request failed'` for caught errors.
- If both context and an upstream error are needed, use `{ message: '...', error }`: the message describes this boundary, and `error` preserves the original value.

Allowed boundary translation:

```ts
upstream.pipe(Effect.mapError((error) => new BackendError({ error })));

return yield * Effect.fail(new BackendError({ message: "missing session cookie" }));

upstream.pipe(
  Effect.mapError((error) => new BackendError({ message: "backend request failed", error })),
);
```

Forbidden:

```ts
catch (error) {
  return yield* Effect.fail(new BackendError({ error: String(error) }))
}

catch (error) {
  return yield* Effect.fail(new BackendError({ error }))
}

catch (error) {
  return yield* Effect.fail(new BackendError({ message: error.message }))
}

const formatBackendFailure = (error: unknown) =>
  Predicate.isString(error) ? error : 'backend request failed'
```
