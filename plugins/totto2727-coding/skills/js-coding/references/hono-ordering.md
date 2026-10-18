# Hono Middleware Ordering

Use this reference only for existing Hono applications that use these context and runtime helpers.
Use [Effect HTTP plus Alchemy](../../js-stack/references/stack/backend.md) for new backends.

## Middleware Order

1. `contextStorage()`: async-local context access (must be first)
2. Runtime middleware: injects Effect runtime into `c.var.runtime`
3. Logging / other Hono middleware
4. Route-specific sub-apps and middleware
