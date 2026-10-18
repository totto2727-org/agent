# Hono Errors

Use this reference only to maintain existing Hono error-rendering helpers.
Use [Effect HTTP plus Alchemy](../../js-stack/references/stack/backend.md) for new backends.
The template assumes the application's existing `Context` helper and must match its installed API.

## HTTP Error Template

Define an HTTP error as `Data.TaggedError` with `makeResponseEffect` only when the HTTP boundary must render a distinct response status or body.
Reuse an existing typed failure when callers do not need a new distinction.

```typescript
export class {Name} extends Data.TaggedError('http/error/{Name}') {
  makeResponseEffect() {
    return Effect.succeed(Context.get().json({ error: '{Display Name}' }, {statusCode}))
  }
}
```

Tag format: `http/error/{ErrorName}`
