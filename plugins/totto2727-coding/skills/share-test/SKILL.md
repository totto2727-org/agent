---
name: share-test
description: >-
  Language-independent test-quality principles. Use when evaluating observable behavior, assertions, isolation, fixtures, or test trustworthiness.
---

# Shared Testing Philosophy

> Content type: conceptual guidance shared by every language.

## Test implementation boundaries

For agents that implement or review tests, use the project's established test tools and rules.
Implement maintained tests with a test tool or framework, such as Vitest, Playwright, or the language's test framework.
Follow the project's conventions for test locations, fixtures, and execution.
Custom scripts are permitted only when the project's explicit test rules require or permit them, such as a custom E2E execution procedure.
An existing unrelated script does not establish permission to add a custom test runner.

Do not change project configuration, task runners, package scripts, or CI merely to add or execute an individual test.
Use the existing test discovery and execution paths.
Do not make an ad hoc verification script a maintained test by adding it to a task runner or CI.
The same restriction applies when a script calls an approved test framework but requires a new execution path for that test.

If the required test does not fit the established tools and project rules, treat the alternative as a new testing mechanism.
Propose that mechanism to the user separately from the implementation that needs verification, and obtain approval before introducing it.
Do not bundle its configuration or execution changes into the implementation without that approval.

Alternatively, use temporary verification code only for the current task.
Keep it under the repository's `tmp/` directory and exclude it from commits and pull requests.
Do not register it in project configuration, task runners, package scripts, or CI.
Before committing, review the task-created artifacts and stage only intended deliverables.
Report the limits of temporary verification, and do not present it as maintained regression coverage.

## Observable behavior

Test the contract visible to a caller, not private implementation steps. Prefer returned values, emitted effects, durable state, and public errors over internal call order or private helper structure.

## Assertion and expectation APIs

Use the language- or framework-provided assertion, matcher, snapshot, or expected-failure notation that most directly expresses the observable contract and produces useful failure diagnostics. Do not reimplement an available assertion with boolean comparisons, mutable control state, or manual bookkeeping.

Assert the complete value when the whole value is the contract. Use a subset or property matcher only when omitted fields are intentionally outside the test's scope. Use predicate assertions for named boolean properties, but do not reduce value equality or an error variant to a boolean when a structural assertion can report actual and expected values. Use a snapshot only when the complete stable structure or serialized representation is the contract and the snapshot remains reviewable.

Use the test framework's native error, exception, rejection, or panic expectation instead of assigning occurrence or a caught exception to a temporary variable. Treat mutable sentinel state and catch-only bookkeeping as anti-patterns because they obscure the expected behavior and can let an unintended execution path pass.

Catch an error explicitly only when its identity, variant, payload, message, or another property is itself part of the observable contract and the framework cannot assert it directly. Assert the failure type or variant and relevant payload instead of rendered text unless the text itself is the contract. Assert the captured property rather than using the catch merely to control whether the test passes.

Use the [concrete implementation skills](#concrete-implementation-skills) for language-specific assertion examples.

## Independence

Every test establishes its own state and remains valid in isolation, in a different order, and under parallel execution. Tests never depend on another test's side effects.

Use controlled substitutes at external boundaries such as time, randomness, network, storage, process execution, or a database. Do not mock private collaborators merely to assert internal call order. The test or fixture that creates mutable state or a resource owns its cleanup in the same scope.

## Determinism

Control time, randomness, network access, and external state at the boundary. A result that depends on timing or ambient machine state is not reliable evidence.

Wait for every asynchronous operation and assertion whose result belongs to the tested contract. A test must not pass while relevant work remains unobserved.

## End-to-end test scope

Use [`github.com/totto2727-org/e2e`](https://github.com/totto2727-org/e2e) to implement CLI end-to-end tests. This skill does not yet specify a shared implementation approach for non-CLI end-to-end tests.

## Behavior scope

Each test has a single reason to fail. Multiple assertions are acceptable when one setup and one system-under-test invocation produce multiple observable facts that jointly describe one outcome.

Do not treat a shared fixture as sufficient reason to combine cases.
Separate independently meaningful inputs into distinct cases, including parameterized cases where appropriate.
Keep multiple invocations together when their ordered interaction is itself the behavior under test, such as a retry or state transition.

A documented family-conformance exception may group multiple related functions when they intentionally implement the same branch contract and the test verifies that branch consistently across the whole family. Keep conversion rules, type-specific behavior, and unrelated branches out of such a grouped case.

## Fixtures

Build only the state required by the behavior under test. Prefer small explicit fixtures over broad shared fixtures that hide causality.

## Scenario names

Test names communicate precondition, action, and expected result in domain language. Framework mechanics belong in the body, not in the name or human report.

When a design uses stable case IDs, include them in executable test titles when this helps readers connect results to the design.
Prefer a local scope so adding a case does not renumber unrelated tests.
Descriptive titles are sufficient when IDs add no value; neither numbering nor a diagram is required.
Preserve any framework-required title prefix.

## Type integrity

Tests are consumers of the production contract. Do not weaken types, bypass constructors, or suppress errors merely because code is under test.

## Concrete implementation skills

- [`js-test`](../js-test/SKILL.md): TypeScript test implementation.
- [`mbt-test`](../mbt-test/SKILL.md): MoonBit test implementation.
- [`rust-test`](../rust-test/SKILL.md): Rust test implementation.

## Test design decisions

- [`share-test-design`](../share-test-design/SKILL.md) — risk-based coverage, observable criteria, verification choices, and concise evidence presentation.
