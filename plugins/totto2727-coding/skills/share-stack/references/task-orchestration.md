# Task orchestration

## Select the runner

| Project conditions                                                         | Default                                   |
| -------------------------------------------------------------------------- | ----------------------------------------- |
| JavaScript dependencies, including child projects                          | Vite+ for the shared task graph.          |
| No JavaScript dependencies, but dependency-aware task caching is necessary | Vite+.                                    |
| No JavaScript dependencies or task-cache requirement                       | Native commands or language task aliases. |

Do not add Node.js only to give native projects uniform task names.
Use project-local Just recipes for complex reusable scripts, not as the primary cross-project runner.
Set the default Just recipe to `@just --list`.
Use an explicit project Justfile when another runner invokes a recipe.

## Register tasks where the graph can see them

Declare Vite+ tasks in each project's `vite.config.*`.
Keep project relationships in the workspace dependency graph.
Use `dependsOn` for required stages, including stages that invoke a local Just recipe.
Do not hide cross-project dependencies inside recipes or shell chains.

## Classify tasks by their result

| Task    | Policy                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| `fix`   | Automatic format and lint fixes. No task cache.                                     |
| `check` | Static checks without source changes.                                               |
| `build` | All stages necessary for the final deliverable, including generation and packaging. |
| `test`  | Reproducible tests with controlled resources.                                       |
| `e2e`   | Separately selected heavyweight or live-system tests.                               |
| `ci`    | `check`, `build`, and `test`. No `fix`.                                             |

Keep controlled integration tests in `test` when they meet its isolation requirements.
Keep `e2e` outside default `test` and `ci` unless the project requires it.
Use separate selections within one test framework rather than adding a framework only for E2E.

Use `<task>:<CLIName>` when a stage needs separate selection or reuse.
For one operation, use the base task directly instead of adding an empty aggregate.

## Add explicit preparation and completion stages

`pre<task>` and `post<task>` are ordinary task names, not implicit lifecycle hooks.
Declare their edges with `dependsOn`.
A completion stage must depend on its producer.
Listing both stages in an aggregate does not order them.
Include required completion stages in the `build` graph.

## Schedule conflicting writes safely

Order tasks that write the same files or output directory with explicit dependency edges.
Do not use a cacheable parent to skip a dependency with external effects.

## Derive exclusions from Gitignore

Use [@totto2727/gitignore-patterns](https://github.com/totto2727-org/gitignore-patterns) for Vite+ formatter and linter `ignorePatterns`.
Generate the patterns when the configuration loads.
The helper scans `.gitignore` files only at or below its root.
Check ancestor rules for child projects.
Its escaped positive literals are not general-purpose cache-input globs.
Do not maintain duplicate exclusion lists or copy these literals into another glob grammar.
Add an individual exception only for a demonstrated coverage gap.

## Define cache boundaries

Cache deterministic tasks only when a cache hit restores their required files.
Do not cache deployment, publication, database mutation, service startup, or checks against live services.

A Docker daemon image is not a restored workspace output.
An exported image archive can be cacheable with complete inputs and immutable base-image references.
Keep image loading, container execution, and registry pushes outside that cacheable task.

For configuration syntax, prefer the installed official [Vite+ skill](https://github.com/voidzero-dev/vite-plus).
Use the [official Vite+ guide](https://viteplus.dev/guide/) when the skill is unavailable.
