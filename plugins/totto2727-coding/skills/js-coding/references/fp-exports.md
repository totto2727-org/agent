# @totto2727/fp Exports

Use this export inventory only for existing `@totto2727/fp` integrations.
Confirm each entry against the selected release's published exports before importing it.
These re-exports are not alternatives to the Effect-first default for new implementation.

## Exported Paths

### Core Re-exports

Thin wrappers that re-export external libraries:

- `./case`: change-case (string case conversion)
- `./di`: velona (dependency injection)
- `./memo`: micro-memoize (memoization)
- `./option-t`: option-t (Result/Option types)
- `./temporal`: temporal-polyfill (Temporal API)
- `./type`: type-fest (utility types)

### Custom Modules

- `./duration`: Locale-aware duration formatting with caching
- `./error`: Shared domain error payload type (`TaggedErrorBaseType`) and `ErrorOptions.error` augmentation
- `./effect/cuid`: CUID generator with Effect Schema branding
- `./effect/util`: Effect type helpers (`EffectFn`, `nonEmptyArrayOrNone`, `tap`)
- `./effect/option-t`: Bridge: option-t Result → Effect Exit
- `./option-t/effect`: Bridge: Effect Exit → option-t Result (dual function)
- `./option-t/safe-try`: Rust-like `?` operator for option-t Result using generators

### TypeScript Configs

- `./tsconfig/vite`: Shared tsconfig preset for Vite projects

## Reference

- [Effect AI Guide](https://raw.githubusercontent.com/Effect-TS/effect-smol/refs/heads/main/LLMS.md)
