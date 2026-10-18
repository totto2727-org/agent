# Haskell CLI Stack

## Composition and serialization

Keep base-only commands free of a CLI framework when they do not need structured options.
Use `optparse-applicative` for typed options and subcommands when its bounds fit the selected compiler.
Use Aeson for JSON boundaries.
These selections do not establish a database stack.

## Iris compatibility profile

Iris is optional, not a requirement for new Haskell CLIs.
For a project that selects Iris, keep `Iris + optparse-applicative` with a compatible dependency plan.
The c-plugin profile uses GHC 9.4.8 and `base` 4.17 because its Iris 0.1 bounds need that compiler family.

Keep the package bounds and Nix overrides consistent.
Do not use `allow-newer` to substitute the newer template compiler.
Do not downgrade a GHC 9.12 template or another product's compiler only to add Iris.
A mandatory Iris default needs an explicit user decision and compatibility checks.

## Terminal profile

Use Brick/Vty when terminal interaction needs their event and rendering model.
Keep a compiler and package plan compatible with those libraries.
Brick/Vty does not replace the shared [GPUI native GUI policy](../../../share-stack/SKILL.md#select-a-gui-stack).

## Official references

- [optparse-applicative](https://github.com/pcapriotti/optparse-applicative)
- [Aeson](https://hackage.haskell.org/package/aeson)
- [Iris](https://hackage.haskell.org/package/iris)
- [Brick](https://github.com/jtdaugherty/brick)
- [Vty](https://github.com/jtdaugherty/vty)
