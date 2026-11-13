# Effect Services and Runtime

For advanced Effect users who change dependency graphs or resource lifetimes.
Check APIs against the [installed release](../effect.md).

## Service identity

Use a stable, collision-resistant identity when the installed service API requires a string.
Do not change that identity merely because the implementation moves between files.
Follow the package's existing export names rather than imposing a service file template.

## Layer Constructors

Do not assume that `ServiceMap.Service`, `Context.Service`, or `Layer.scoped` exists across Effect versions.
For resources, use the installed acquisition and release APIs so that the owning scope controls their lifetime.

## Layer Composition

Use `Layer.provide` for internal providers and `Layer.provideMerge` when downstream consumers also need those services.
Check the resulting service outputs and unsatisfied requirements, not only whether the composition type-checks.
Do not create another connection pool or runtime per service call to hide missing provision.

## ManagedRuntime

Use a managed runtime only at a host boundary outside Effect.
Do not add one when the framework already owns execution.
Keep request users and credentials outside process-wide Layers.

## DisposableRuntime Pattern

Give each runtime one disposal owner.
Dispose it on success, failure, and interruption at the end of its intended lifetime.
Use `Symbol.asyncDispose` and `await using` only when the wrapper, compiler, and host support that contract.
