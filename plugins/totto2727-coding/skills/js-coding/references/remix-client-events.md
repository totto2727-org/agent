# Remix Client Event Boundaries

Use this reference only to maintain existing `remix/ui` integrations.

## Client Event Boundary Pattern

Treat an existing `on(...)` handler as a browser boundary.
Use zero runtime executions for purely synchronous local UI behavior and one for a complete Effectful event workflow.
Keep form parsing, validation, state transitions, HTTP calls, recovery, updates, and dependent navigation in that workflow.
The outer callback establishes the Effect-to-Promise boundary rather than awaiting a partial operation.
Use the installed Remix and Effect versions' supported event and runtime APIs.

### Key Rules

- Compose reusable operations inside one workflow instead of running nested or sequential partial Effects.
- Keep initial loading state, validation errors, success state, failure state, and `handle.update()` calls within the workflow when they belong to the operation.
- Use Effect HTTP clients rather than direct `fetch` for network operations.
- Keep navigation in the workflow whose result authorizes that transition.
- Adapt Promise-returning browser APIs such as WebAuthn only at the required browser boundary.
- Use an adapter with a typed failure when the browser operation can fail recoverably.
- Provide a browser HTTP client Layer at the event boundary only when that component owns the runtime boundary.
- Do not hide runtime provision or execution inside a domain service.
- Keep failure reporting at the owning UI boundary and do not catch merely to discard the original cause.

## Forbidden Partial Boundary Shape

```tsx
<Button
  mix={on("click", async () => {
    state.submitting = true;
    void handle.update();

    await Effect.runPromise(sendRequestOnly);

    // Navigation and final state are outside the workflow.
    window.location.href = "/app";
  })}
/>
```

This counterexample leaves state changes and navigation outside the workflow being typed, recovered, and tested.
Preserve the current application's observable event contract instead of replacing its framework during unrelated maintenance.
