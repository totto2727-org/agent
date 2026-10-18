# Hono Middleware

Use this reference only to maintain existing Hono integrations.
Use [Effect HTTP plus Alchemy](../../js-stack/references/stack/backend.md) for new backends.
Verify existing middleware helpers and Effect APIs against the installed versions.

## Middleware

```typescript
export const myMiddleware = factory.createMiddleware((c, next) => {
  const program = Effect.gen(function* () {
    // ...
    yield* Effect.tryPromise(next);
  });
  // ... programWithCatch + runPromise
});
```

Middleware-specific state belongs in the shared Hono environment type, not in individual route files.
Define variables in the runtime/context boundary:

```typescript
// feature/runtime/hono.ts
export interface Variables {
  readonly runtime: Runtime.Runtime;
  readonly user: AuthUser | null;
}
```

```typescript
// feature/share/lib/hono/context.ts
export interface Env {
  Bindings: Bindings;
  Variables: Variables;
}
```

Route files should import this `Env`.
They must not locally widen `Variables` with endpoint-specific intersections such as `Variables & { user: AuthUser | null }`.

### Auth middleware boundaries

Keep route and app middleware focused on policy, not auth plumbing.
Shared auth helpers should own session lookup, user decoding, and pass-through versus unauthenticated branching.
App middleware should provide only app-specific responses such as redirects, return-to cookies, or JSON 401 responses.

- Prefer source-native user fields in application auth types.
  Better Auth uses `user.id`, so app-level shared users should expose `id`.
  Reserve `sub` for JWT/OIDC payload types and translate only at that protocol boundary.
- Do not add app-specific `mapUser` callbacks to shared setup middleware for the normal application user.
  Map divergent UI or protocol shapes at the boundary that needs them.
- Do not store long-lived services such as `auth` in `ctx.var`.
  Services belong in the runtime/service layer, while request context contains request-scoped values such as the resolved `user`.
- Handlers behind require-auth middleware should trust the middleware contract and avoid repeating `null` checks for `ctx.var.user`.
  If the type does not express the guarantee, fix the shared helper or Hono context typing instead of weakening every handler.
