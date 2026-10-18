# Effect Services and Runtime

Use this reference as the canonical home for reusable Effect service exports, Layer provision, and resource lifetime.
Use [backend composition](../../stack/backend.md) for HTTP, infrastructure, and business-service wiring.
Confirm every constructor and import against the installed version through the [Effect index](../effect.md).
Do not copy `ServiceMap.Service`, `Context.Service`, or a scoped Layer constructor from another Effect version without checking its actual signature.

## File Template

Keep service contracts and Layer definitions together when that makes the dependency boundary explicit.
Keep construction helpers private and expose only the contract, service identity, and supported Layer variants.
Use a version-verified service declaration instead of a placeholder initializer presented as executable code.

### Export Rules

- Export the `Instance` type when consumers need the service value contract.
- Export `Service` as the service identity and `layer` or named Layer variants for supported implementations.
- Keep `make*` helpers, implementation details, and raw configuration private unless another public boundary needs them.

### Naming Conventions

- `Instance`: type of the service value.
- `Service`: service identity using the installed Context/service API.
- `layer` or `{variant}Layer`: supported construction, such as `localLayer` or `remoteLayer`.
- `make{Variant}`: private construction helper.

### Service Tag Format

Use a stable, collision-resistant identity such as `@app/{app-name}/feature/{feature-name}/Service` when a string identity is required.
Do not change service identity merely because the implementation moves between files.

## Layer Constructors

Select construction by behavior rather than applying one constructor to every service.
Use the installed equivalent of `Layer.succeed` for an already known implementation, `Layer.sync` for synchronous construction, and `Layer.effect` for effectful construction.
For resources, use the installed scoped acquisition/release APIs and make their lifetime visible to the owner.
Do not assume a constructor named `Layer.scoped` exists in every Effect generation.

## Service Access

Access services inside Effects through the installed service API, including `yield*` where supported.
Do not run a runtime to obtain a dependency inside business logic.
Keep implementation requirements visible until the application composition root provides them.

## Layer Composition

Start from the consumer Layer and provide its required dependencies at the composition root.
Use `Layer.provide` when provider services are internal and must not become part of the exposed service set.
Use `Layer.provideMerge` when downstream consumers also need the provider's services.
Verify both signatures and the resulting requirements against the installed version.
Do not instantiate another connection pool or runtime per service call to hide missing provision.

## ManagedRuntime

Use a managed runtime only at an actual host boundary that needs to execute Effects from outside Effect.
If the framework already owns execution, compose within that integration instead of wrapping it in an additional runtime.
Create a shared runtime once only for dependencies whose lifetime is genuinely shared.
Do not put request users, credentials, or other request-specific values into a process-wide Layer.

## DisposableRuntime Pattern

Give every created runtime and acquired resource one disposal owner.
Dispose it on success, failure, and interruption at the end of its intended lifetime.
Use `Symbol.asyncDispose` and `await using` only when the runtime wrapper, compiler, and host actually support that contract.
Do not assume a custom disposable wrapper exists or force all shared services into a request-scoped runtime.

## Environment-Based Runtime Selection

Select production, development, and test Layer variants at the composition root, not inside business workflows.
Configure version-supported structured production logging and readable local logging there.
Keep final diagnostics at the application boundary and preserve structured causes without leaking secrets.
Verify resource cleanup and request isolation when changing runtime lifetime or environment selection.
