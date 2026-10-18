# Effect Services and Runtime

## File Template

When this makes the dependency boundary explicit, keep service contracts and Layer definitions together.

### Export Rules

Export the service contract, identity, and supported Layers.
Keep construction helpers and raw configuration private unless another public boundary needs them.

### Naming Conventions

| Item                        | Name                                   |
| --------------------------- | -------------------------------------- |
| Service value type          | `Instance`                             |
| Service identity            | `Service`                              |
| Default Layer               | `layer`                                |
| Layer variant               | `{variant}Layer`, such as `localLayer` |
| Private construction helper | `make{Variant}`                        |

### Service Tag Format

Use `@app/{app-name}/feature/{feature-name}/Service` for string identities.
Keep the identity when its implementation moves between files.

## Layer Constructors

Check service and scoped-resource constructors against the installed release.
Do not assume that `ServiceMap.Service`, `Context.Service`, or `Layer.scoped` exists across Effect versions.

## Service Access

Do not execute a runtime to obtain dependencies inside business logic.

## Layer Composition

Use `Layer.provide` for internal providers and `Layer.provideMerge` when downstream consumers also need those services.

## ManagedRuntime

Use a managed runtime only at a host boundary outside Effect.
Do not add one when the framework already owns execution.
Keep request users and credentials outside process-wide Layers.

## DisposableRuntime Pattern

Give each runtime one disposal owner.
Use `Symbol.asyncDispose` and `await using` only when the wrapper, compiler, and host support that contract.

## Environment-Based Runtime Selection

Select production, development, and test Layers at the composition root, not inside business workflows.
