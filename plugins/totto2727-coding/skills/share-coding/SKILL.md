---
name: share-coding
description: >-
  Language-independent production-code principles. Use for design decisions about types, boundaries, effects, abstractions, or recurring tasks.
---

# Shared Coding Philosophy

> Content type: conceptual guidance shared by every language.

## Type safety

Express invariants in the type system whenever possible. Preserve paths, identifiers, commands, and domain payloads as specific structural values while they cross application layers. Keep generic JSON at serialization boundaries, and convert structural values to text only when an external protocol or display requires it.

## Single-value invariants

When a value must satisfy a condition independently of other values, consider representing that condition with a dedicated type. Validate and normalize raw input in the type's constructor or an equivalent factory, then pass the validated value through internal layers. Examples include an integer constrained to a fixed range and a path that must always be absolute. Do not repeat the same validation in each function that consumes the value; scattered checks reduce readability and make omissions likely.

Keep rules that describe a relationship between multiple values in the function or domain policy that owns that relationship. Do not force a contextual relationship into a type that represents only one value.

## Collection invariants

Do not construct a unique array with manual `contains`, `filter`, `fold`, or a local deduplication helper. When uniqueness is a domain invariant, store the values in a collection whose type guarantees uniqueness. Convert the set to an array only at a consumer or API boundary that requires a sequence, such as serialization, presentation, interoperability, or a detached public snapshot.

Choose the collection by its observable semantics as well as uniqueness: insertion order versus comparison order, `Eq` and `Hash` identity, and mutable versus persistent updates. Do not replace an order-preserving representation with a sorted collection unless the domain contract explicitly requires sorted order.

When duplicate input is invalid, reject it at the boundary before collection construction can collapse it. Silently deduplicate only when deduplication is the explicit domain behavior.

If a private array exists only to stop callers from mutating it, prefer a readonly or persistent immutable collection. Keep a mutable private collection only when controlled mutation is part of the implementation's behavior.

## Strict boundary conversion

Treat external bytes, text, JSON, TOML, CSV rows, request parameters, environment values, parser nodes, and weak library values as untrusted boundary input. Keep each value in the smallest adapter that owns its format and move it promptly through explicit representations:

```text
raw input -> format parsing and typed wire model -> semantic validation and normalization -> domain model
domain model -> outbound wire model -> serialization
```

Successful format parsing proves only that the input follows the external syntax. Validate required structure, ranges, relationships, and other domain invariants before internal code consumes the value. Parsing, structural decoding, semantic validation, and domain construction may be composed in one decoder, but keep their responsibilities and failure categories distinguishable.

Normalize once as part of the accepted-input contract, validate the normalized representation, and pass that same representation to execution. Do not pass raw text, generic JSON or maps, stringly typed identifiers, parser contexts, unvalidated wire models, or format-specific library values through internal application layers. Keep inbound wire, domain, and outbound wire models separate when their contracts differ, and serialize only the outbound model.

This conversion rule does not require replacement interfaces for typed libraries that already provide the required abstraction, such as an ORM.

Do not parse an opaque payload that the application only relays and never inspects. Keep it isolated at the forwarding boundary instead.

## Path form invariants

When internal code expects a specific path form, validate and normalize external raw paths or strings in a constructor or equivalent factory before passing them into internal layers. Represent relative paths such as `./...` or `../...`, absolute paths, and URI forms such as `file://...` with types that preserve their distinct invariants. Keep filesystem paths and URIs separate; validate a URI scheme before constructing its domain type. Do not repeat checks such as `is_absolute` in terminal functions.

## State models

Represent each valid state as a distinct variant whose payload contains exactly the data available in that state. Prefer an algebraic data type such as `Success(data) | Failure(error)` over independent flags and optional fields such as `{ error: boolean, data: unknown }`. A state transition should construct another valid variant rather than mutate unrelated fields into a temporarily inconsistent combination.

## Failures

Make failure visible in a function's type with the language's typed failure mechanism. Propagate failures to the application boundary by default. Catch only when the current layer can recover, must select a different behavior, or must translate an external failure into the boundary's error vocabulary. Define a custom error only when a caller needs to distinguish that failure or inspect structured context; do not create one merely to rename a generic failure.

When translating a failure, preserve the original cause and machine-readable context such as paths, identifiers, and nested values. Add human-facing context separately, and redact it at presentation or logging boundaries when required. Do not flatten values a caller may inspect into a message string.

## Side effects

Keep I/O, mutation, randomness, and time at program boundaries. Prefer pure functions in the core and make effects and failure modes visible in function signatures.

### Composition root and dependency injection

Adopt Clean Architecture selectively to separate infrastructure from business logic, not to impose a fixed set of layers.
Use I/O in the Haskell sense: interactions with external systems, including network access and file operations.
An effect abstraction can express these interactions; this policy does not require Haskell or a particular Effect library.

Define and assemble concrete I/O implementations, configuration, and their dependency graph at the application's top-level composition root.
Select production, development, and test infrastructure there, then provide the assembled dependencies to the application.
Keep implementation code in the modules that own each capability; centralize its selection and composition, not every I/O operation in one file.

Select environment configuration through separate execution or test setup entry points whenever possible, such as `main.ts`, `dev.ts`, and `setup.test.ts`.
Each entry point assembles its configuration and dependencies, then invokes the same shared business logic.
Prefer this separation over `if` or other environment-based conditionals in a shared entry point.
Allow a top-level `if` for configuration selection only when framework or runtime constraints make separate entry points impractical.
Keep that branch at the entry point's composition root and explain the constraint in a comment.
Do not move the branch into business logic or duplicate business logic between entry points.

Use dependency injection to keep business logic independent of infrastructure selection.
Function arguments, closures, context objects, and service or Layer composition are valid forms of DI, as are DI containers.
Choose the simplest method that achieves this separation, not a preferred container or framework.

### Infrastructure and business logic

Infrastructure owns concrete clients, access targets, and environment-specific configuration.
Business logic receives configuration and I/O capabilities as dependencies; it must not select their concrete implementations.
Keep domain decisions pure where possible, and express necessary I/O through the injected capabilities.
Avoid production/development flags, backend selection, and environment-based fallbacks inside business logic.
Select a different implementation or configuration at the composition root instead.
Branches that implement business rules using injected domain configuration remain valid.

If an infrastructure-based branch inside business logic is necessary, add a detailed comment at the branch and report it to the user.
Explain the concrete constraint, why dependency selection or configuration at the composition root cannot satisfy it, and the affected behavior.

## Naming

Names state what callers can rely on, not how the implementation works. Reuse established domain vocabulary and avoid abbreviations unless they are standard in the domain.

## Public surface

Expose only the declarations callers need. Do not widen production visibility for a test; prefer the public contract or the language's white-box test mechanism for a stable internal invariant that cannot reasonably be observed through that contract.

## Testability

Inject dependencies at boundaries, keep branches understandable, and model failures explicitly. A unit that requires disproportionate setup usually has the wrong boundary or too many responsibilities.

Follow [test implementation boundaries](../share-test/SKILL.md#test-implementation-boundaries) when verifying a change.
Use the established test tools and project rules, not a new script registered in a task runner or CI for an individual test.
Propose a new testing mechanism separately for user approval, or keep verification code temporary and uncommitted.

## Change scope

Prefer small local changes and composable units. Extract a shared abstraction only after concrete use demonstrates a stable invariant or policy.

## Readability

Choose explicit control flow over compact cleverness. Comments explain non-obvious reasons and constraints; the code itself explains what it does.

## Consistency

Look for prior art in the same package before introducing a new pattern. Record the reason close to the decision when a deliberate divergence is necessary.

## Just defaults

When a repository uses Just, make the default recipe display the available recipes with a recipe body that runs `@just --list`. Do not make the default recipe run checks, builds, tests, setup, or any other operational command.

## Abstractions

Keep a wrapper only when it owns a real invariant, reusable policy, or typed boundary. A helper that merely renames one standard operation and has one call site adds indirection without preserving knowledge.

Infrastructure separation does not require an anti-corruption layer that recreates an existing library's API.
Keep one ORM and configure its access target for each environment, such as an in-memory database supported by that ORM.
Do not add another ORM or recreate ORM-level repositories, queries, and transactions merely to support dependency injection or environment switching.
Add a narrower domain abstraction only when it owns a demonstrated domain invariant or policy, not to duplicate the ORM.

## Domain boundaries

Place discovery, resolution, and domain rules in the library that owns the concept. Entry points request resolved domain values rather than reimplementing filesystem walks, lookup rules, or naming policies.

## Scheduling

- [`scheduling.md`](references/scheduling.md) — read before implementing or changing scheduled jobs, periodic tasks, or polling loops; define timing, restart, overlap, missed-run, and retry semantics before selecting a scheduler.

## Concrete implementation skills

- [`js-coding`](../js-coding/SKILL.md): TypeScript implementation.
- [`mbt-coding`](../mbt-coding/SKILL.md): MoonBit implementation.
- [`rust-coding`](../rust-coding/SKILL.md): Rust implementation.

## Related skills

- [`share-test`](../share-test/SKILL.md), [`js-test`](../js-test/SKILL.md), and [`mbt-test`](../mbt-test/SKILL.md) — testing philosophy and executable tests.
- [`rust-test`](../rust-test/SKILL.md): executable Rust test guidance.
- [`share-test-design`](../share-test-design/SKILL.md) — test-design decisions and suitable evidence presentation.
- [`moonbit-orientation`](https://github.com/moonbitlang/skills/blob/master/skills/moonbit-orientation/SKILL.md): official MoonBit documentation skill. Prefer the local skill when installed; otherwise fetch the [MoonBit documentation Markdown source index](https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/index.md) directly. Resolve source paths beginning with `/` under `https://raw.githubusercontent.com/moonbitlang/moonbit-docs/main/next/` after stripping the leading slash.
- [`building-components`](https://github.com/vercel/components.build/blob/main/skills/building-components/SKILL.md): official components.build documentation skill. Prefer the local skill when installed; otherwise fetch the Markdown-native [components.build specification](https://www.components.build/llms.txt) directly.
- [`share-artifact`](../share-artifact/SKILL.md) — durable README, AGENTS, and ADR authoring.
