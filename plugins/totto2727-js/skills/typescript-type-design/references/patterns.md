# TypeScript patterns

Use these examples when choosing a public contract, not when interpreting a lint diagnostic.

## Model a state transition

A diff viewer can be loading, ready with a diff, or unable to load it. Three optional fields allow a caller to represent all three states at once. Separate variants express the states the UI can actually render:

```ts
type DiffView =
  | { kind: "loading" }
  | { kind: "ready"; diff: GitDiff }
  | { kind: "failed"; reason: LoadFailure };
```

If a refresh can fail while the old diff remains visible, the model also needs a state that carries both the old diff and the refresh failure. A linter cannot tell which behavior the UI promises.

## Decide who owns the empty case

```ts
type NonEmpty<T> = [T, ...T[]];

function firstSession(sessions: NonEmpty<Session>): Session {
  return sessions[0];
}
```

This signature makes sense after session selection has established that a session exists. A lookup on a new account must instead represent absence in its result. Neither decision requires every collection in the application to be nonempty.

## Keep identifiers distinct

An account ID and an invitation ID may both be valid UUIDs. A UUID parser establishes their format, not that they identify the same entity. Give them distinct types when mixing them would authorize the wrong operation. Establish each type at the boundary that knows what the identifier refers to.

## Derive a view or introduce a new model

If a summary displays exactly two fields from a generated protocol type, `Pick<ChecksMessage, "checks" | "totalCount">` keeps it aligned with that contract. If the summary excludes archived checks, its count no longer means the wire count. Build a separate summary from the filtered collection rather than copying the wire value into it.
