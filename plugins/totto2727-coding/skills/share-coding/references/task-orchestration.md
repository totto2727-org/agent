# Task orchestration

Use this guidance when adding or changing recurring tasks within a project or across a workspace.
Keep language settings and toolchains based on each workspace's template, with only the extensions required by the task.
Task aggregation does not require replacing native build or test tools.

## Select the runner

Inspect the root and all child projects before choosing an execution model.

| Workspace conditions                                                                  | Execution model                                                                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript dependencies exist, including in a child project                           | Use Vite+ as the default aggregate runner, with project dependencies and task caching.                                                  |
| JavaScript and non-JavaScript projects share a workspace                              | Use Vite+ for the shared task graph. Keep native language commands inside each project.                                                 |
| No project has JavaScript dependencies, but dependency-aware task caching is required | Use Vite+ for the required task graph and cache control. Add only the runner infrastructure needed.                                     |
| No project has JavaScript dependencies and task-cache control is unnecessary          | Keep native build and test commands or the language's task aliases. Do not introduce Vite+ or Node.js solely for uniform command names. |

Keep explicit project requirements when they differ from these defaults.
Do not add a root Justfile as the primary cross-project orchestrator.
Use a project-local Justfile only for a reusable script with complex logic, multiple lines, or many options.
Invoke an explicitly selected project Justfile, for example `just --justfile ./Justfile <recipe>`, from that project's working directory.
When using Just, make its default recipe run `@just --list`, not an operational command.

## Register tasks where the graph can see them

In a Vite+ workspace, declare tasks in each project's `vite.config.*` and execute them through `vp run`.
Register project relationships in the workspace dependency graph so task selection and cache invalidation include the relevant projects.
Represent prerequisite stages with `dependsOn`, not a shell chain or a Just recipe that hides the graph.
Keep each stage independently runnable and give it the inputs and outputs that it owns.

| Task pattern                                                                             | Registration                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One command, such as `vp pack`                                                           | Put the command directly in the project's Vite+ task. Do not add a Just wrapper.                                                                                                        |
| Generate, then build, then package                                                       | Register separate tasks and express their prerequisites with `dependsOn`.                                                                                                               |
| Build step with complex shell logic or many repeated options                             | Let the Vite+ task invoke one project-local Just recipe. Keep stage dependencies in Vite+.                                                                                              |
| Non-JavaScript project inside a Vite+ workspace                                          | Register a package task that invokes its project-local Just recipe when scripting is complex, or its native command when simple. Execute the package task through Vite+.                |
| Standalone Rust or Go project, with no JavaScript children and no task-cache requirement | Run `cargo build`, `cargo test`, `go build ./...`, or `go test ./...` directly. Use native aliases for simple recurring tasks and local Just recipes only for complex reusable scripts. |

For example, a mixed workspace can register a Rust package's build task as `cargo build` and its complex integration setup as a local Just recipe.
The root Vite+ runner selects the package tasks and their dependencies.
The Rust package retains its native commands for standalone use and does not need JavaScript application dependencies.
Do not use a local recipe to call sibling projects or recursively invoke the aggregate runner.

## Classify tasks by their result

Use the following base task names consistently, with only the tools and outputs required by the workspace template.

| Base task | Scope                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix`     | All automatic formatting and lint fixes. Do not include manual refactoring or unrelated source changes.                                                                    |
| `check`   | All static validation: format checks, linters, and type checkers. Use non-mutating modes, not autofix.                                                                     |
| `build`   | All operations needed to produce the final application or library deliverables, including required generation, compilation, bundling, declaration emission, and packaging. |
| `test`    | Tests, normally a lightweight unit suite with controlled substitutes at effect boundaries. Do not silently include live-service integration or end-to-end suites.          |

Split tool-specific tasks as `fix:<CLIName>`, `check:<CLIName>`, `build:<CLIName>`, and `test:<CLIName>`.
Use the actual CLI or tool name after the colon, not an arbitrary workflow label.
For example, use `fix:golangci-lint`, `check:golangci-lint`, `build:go`, and `test:go` for the corresponding Go operations.
Rust can use `fix:rustfmt`, `check:rustfmt`, `check:clippy`, `build:cargo`, and `test:cargo`.
Keep native invocation forms, such as `cargo fmt --check` for `check:rustfmt`, even when a tool runs through a language driver.
Do not add a tool merely to populate a category.

Make each base task aggregate its tool-specific tasks through `dependsOn`.
The following dependency map illustrates a TypeScript library's task classification; it is not a complete Vite+ configuration.

```json
{
  "fix": { "dependsOn": ["fix:oxfmt", "fix:oxlint"] },
  "check": { "dependsOn": ["check:oxfmt", "check:oxlint", "check:tsc"] },
  "build": { "dependsOn": ["build:vp", "build:tsc"] },
  "test": { "dependsOn": ["test:vitest"] },
  "ci": { "dependsOn": ["check", "build", "test"] }
}
```

In this example, `check:tsc` performs type checking without emitting files, while `build:tsc` emits the library's required declarations.
`build:vp` produces the required bundle with `vp pack`.
The `build` aggregate must cover both deliverables, not only compilation.
Publishing or deployment is a separate operation, not a prerequisite for producing those deliverables.

Default tests should generally avoid external systems and ambient filesystem state.
Use suitable mocks, in-memory fixtures, or other controlled substitutes at the public effect boundaries described in [test independence](../../share-test/SKILL.md#independence).
Reproducible tests with an in-memory database or a test-owned temporary directory can belong in default `test`.
Each test must create its own state, control its inputs, and clean up its resources.
This is a default isolation policy, not an absolute prohibition on filesystem or database tests.
Keep reproducible, controlled integration tests within the native test suite when they satisfy the default isolation policy.
Use the separately selected `e2e` aggregate for heavyweight or live-system boundaries, and explain the boundary being verified.
Make it depend on the relevant CLI-specific tasks, for example `e2e` can depend on `test:playwright` without adding that task to default `test`.
Keep these suites outside default `test` and the standard `ci` graph unless the project explicitly requires them there.
Give them isolated resources, explicit setup and cleanup, and the non-cacheable boundaries required for live state.

`e2e` covers heavyweight, realistic behavior across multiple systems in an authorized production, staging, or local environment.
These suites can take longer and can be sensitive to external state or timing.
Make those dependencies and failure conditions visible.
Do not hide flaky results with unbounded retries.
The same test CLI can run both default tests and E2E tests.
Select separate projects, tags, or explicit options for each suite, and configure normal `test` to exclude the E2E selection.
For example, `test:vitest` can select a unit project while `e2e:vitest` selects an E2E project.
Their `test` and `e2e` aggregates select different leaves.
Do not require another framework merely to distinguish the suites.

## Add explicit preparation and completion stages

Use `pre<task>` for a required preparation stage and `post<task>` for a stage that follows another task when the distinction is useful.
These are ordinary named tasks, not implicit package-manager lifecycle hooks.
Declare every required edge with `dependsOn`.
Naming a task `prebuild` or `postbuild` does not schedule it.
Keep the CLI suffix on tool-specific leaves, and use unsuffixed names for aggregates.

For example, a shared type-generation step can run before building, type checking, and unit testing without running the complete build for each consumer.
The following dependency map illustrates those edges, not a complete configuration.

```json
{
  "prebuild": { "dependsOn": ["prebuild:graphql-codegen"] },
  "build:vp": { "dependsOn": ["prebuild"] },
  "check:tsc": { "dependsOn": ["prebuild"] },
  "test:vitest": { "dependsOn": ["prebuild"] }
}
```

A completion leaf that reads build outputs must itself depend on the producing task.
Putting `build` and a completion leaf side by side in `postbuild.dependsOn` does not order them.
If the completion operation is required to produce a final deliverable, include it in the `build` graph after its producer rather than leaving it optional.
Avoid cycles such as making `build` depend on `postbuild` while `postbuild` depends on `build`.

Before adding a task outside these categories, establish that it is necessary and explain why it cannot fit an existing category or preparation/completion stage.
Document its observable result, selection conditions, dependencies, and effect boundaries.
Do not add generic lifecycle names, wrappers, or another category solely for a one-off command.

## Schedule conflicting writes safely

Use `ci` to aggregate `check`, `build`, and `test` through `dependsOn`, not through a shell chain.
Do not run `fix` as part of standard CI validation.
Independent tasks can run in parallel, but a dependency list alone does not establish an order between its entries.
Serialize fixers that mutate the same files with explicit prerequisite edges, for example make `fix:oxfmt` depend on `fix:oxlint` when both write the same sources.
Do not run checks against files while fixers are changing them.
Disable caching for source-mutating `fix` tasks.

Give build and test tasks separate output directories when possible.
If they share mutable outputs or tests consume build artifacts, declare the required ordering with `dependsOn`, for example make `test` depend on `build` when tests require its deliverables.
Also order or separate tool-specific build tasks that write the same output directory.
Do not rely on incidental runner order, a local Just recipe, or concurrent writes to establish correctness.

## Define cache boundaries

A cache hit must reproduce the task's promised result, not merely its previous log.
Declare all result-affecting inputs, including source files, dependency lockfiles, configuration, toolchain versions, relevant environment values, and local script files.
Include upstream task outputs when they affect the result.
Declare the generated files or directories that a cache hit must restore.
Do not treat a successful exit code as a substitute for those artifacts.

Cache deterministic builds and generators only when their required artifacts can be restored from the cache.
Disable task caching for deployment, publishing, external database mutation, service startup, container loading, registry pushes, and integration checks against live services.
These tasks affect or inspect external state that restoring workspace files cannot reproduce.
Dependent tasks must not hide such effects behind a cacheable parent that can skip them.

A Docker image created in a local daemon is not a restored workspace output.
Do not cache a task that promises to build or load an image into that daemon, even when Docker itself uses a layer cache.
A deterministic image build that exports a declared archive can be cacheable if all build inputs, platform settings, and immutable base-image references are tracked.
Keep loading that archive, starting containers, testing live containers, and pushing images in separate non-cacheable tasks.
Docker's layer cache does not make these external effects safe to skip.

Check a cacheable task with a cold run, then remove only its disposable generated outputs and repeat the same task.
Confirm that a cache hit restores the required artifacts.
Change a relevant input and confirm invalidation.
For an external-state task, confirm that repeated invocations execute the effect or check rather than returning a cached success.
Use isolated, authorized test targets for state-changing checks.

For exact configuration syntax, prefer the installed official [`vite-plus`](https://github.com/voidzero-dev/vite-plus) skill.
If it is unavailable, use the [official Vite+ guide](https://viteplus.dev/guide/).
