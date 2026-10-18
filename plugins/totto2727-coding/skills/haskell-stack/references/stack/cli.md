# Haskell CLI Stack

For developers who compose native commands, JSON adapters, and terminal interfaces.
Read the [shared Haskell stack](share.md) for the compiler and dependency plan.
Apply [haskell-coding](../../../haskell-coding/SKILL.md) for typed failures and resource lifetimes.

## Composition and serialization

Keep a minimal base-only executable dependency-free when it does not need structured command parsing.
Use `optparse-applicative` when typed options and subcommands are required and its bounds fit the selected compiler.
Treat parser output as command input, then validate domain constraints before effects run.
Assemble configuration, file and process adapters, and terminal capabilities in `Main`.
Call application operations through those capabilities rather than reading environment settings inside pure domain functions.
Map typed failures to diagnostics and exit status at the command boundary.
Send machine-readable results to stdout and diagnostics to stderr.
Do not convert all exceptions into successful empty output.

Use Aeson for JSON input and output when the command has a JSON boundary.
Decode into explicit wire types with `eitherDecode` or the appropriate strict-input variant, then validate domain invariants.
Choose explicit field names and compatibility behavior for persisted or public formats.
Encode outbound values with the agreed wire representation rather than exposing internal domain constructors accidentally.
For file-backed state, keep durability, atomic replacement, and recovery in the storage adapter.
Do not treat a file-state implementation as evidence for a universal database stack.

## Iris compatibility profile

Iris is conditional, not mandatory for every new Haskell CLI.
Keep `Iris + optparse-applicative` for a project that has selected this application framework and its compatible dependency plan.
The c-plugin profile pins GHC 9.4.8 with base 4.17 because its Iris 0.1 bounds require that compiler family.
Keep its package bounds and Nix overrides aligned instead of using `allow-newer` to force the newer template compiler.
Do not replace a GHC 9.12 template or lower another product's compiler merely to add Iris.
Making Iris mandatory for new projects requires an explicit user decision and compatibility validation.

Use Brick/Vty only for terminal interaction that needs their event and rendering model, preserving a compatible compiler and package plan.
Keep TUI state and events separate from application operations, and release terminal resources on normal exit, failure, and cancellation.
Provide deliberate behavior for redirected output or a noninteractive terminal when the command supports such use.
Brick/Vty is a terminal profile, not a replacement for the shared GPUI native GUI standard.

## Checks

Use Hspec to check parsing, validation, domain failures, and JSON round trips or compatibility fixtures where applicable.
Check the built executable's help, stdout/stderr, exit status, and malformed input when command behavior changes.
For the Iris profile, verify dependency resolution with the selected GHC and base before treating a successful newer-compiler test as relevant.
Keep terminal integration and heavyweight process or Docker acceptance explicitly selected when they exceed the native test boundary.
Check cleanup and interrupted operation behavior when terminal or subprocess ownership changes.

## Official references

- [optparse-applicative](https://github.com/pcapriotti/optparse-applicative)
- [Aeson](https://hackage.haskell.org/package/aeson)
- [Iris](https://hackage.haskell.org/package/iris)
- [Brick](https://github.com/jtdaugherty/brick)
- [Vty](https://github.com/jtdaugherty/vty)
