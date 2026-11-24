# rules/no-effect-runtime-run

Keep runtime execution at documented boundaries.

## Purpose and behavior

The rule reports member calls named runCallback, runFork, runMain, runPromise, runPromiseExit or runSync on any receiver. The rule ignores bracket calls but does not exempt top-level entrypoints. Give a suppression reason at execution boundaries. Compose effects elsewhere.

## Options

No configurable options. Enable with `"rules/no-effect-runtime-run": "error"`.

## Invalid example

Examples cover this rule only. They may omit imports or declarations.

```tsx
Effect.runPromise(program);
```

## Valid example

```tsx
program.pipe(Effect.provide(layer));
```

## Fixes and exceptions

No automatic fix.

Add `// oxlint-disable-next-line rules/no-effect-runtime-run -- reason` above the diagnostic line. Explain the exception in `reason`.

## Source and tests

[no-effect-runtime-run.ts](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-runtime-run.ts) · [Tests](https://github.com/totto2727-org/oxlint/blob/bed13483292d75318f9ca01e124aa666edaa8202/src/rules/no-effect-runtime-run.test.ts)
