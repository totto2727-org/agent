# MoonBit Errors

For advanced MoonBit users who design structured failures and recovery.
Select the [failure representation](../SKILL.md#failure-representation) before implementing translation or recovery.

## Structured payloads

Use typed `suberror` fields for context that callers must inspect:

```mbt
suberror ConfigError {
  ConfigNotFound(path~ : @path.Path)
  ConfigInvalid(path~ : @path.Path, reason~ : String)
}
```

## Recovery

Use the shared [failure policy](../../share-coding/SKILL.md#failures) to select recovery and translation boundaries.

Use `try?` only when `Result` is the required boundary contract.
Do not use `try!` outside tests.
Call the raising operation directly so the `raise` effect remains visible and propagates.
Alternatively, remove the failure path with a non-raising construction whose inputs establish the invariant.
If production code cannot avoid `try!`, add an adjacent comment.
Explain why failure is impossible and why the function cannot expose or propagate the error.
