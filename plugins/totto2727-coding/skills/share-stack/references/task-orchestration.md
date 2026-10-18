# Task Orchestration

## Select the runner

| Project                                                           | Runner                                       |
| ----------------------------------------------------------------- | -------------------------------------------- |
| JavaScript dependencies, including child projects                 | Vite+.                                       |
| No JavaScript dependencies, but dependency-aware caching required | Vite+.                                       |
| No JavaScript dependencies or task-cache requirement              | Native commands or language task aliases.    |
| Complex project-local scripts                                     | Just recipes, called by the selected runner. |

- Do not add Node.js only to standardize task names.
- Set the default Just recipe to `@just --list`.
- Specify the project Justfile when another runner invokes a recipe.

## Task graph

| Concern                              | Configuration                                      |
| ------------------------------------ | -------------------------------------------------- |
| Vite+ tasks                          | Each project's `vite.config.*`.                    |
| Project relationships                | Workspace dependency graph.                        |
| Required preparation and completion  | Explicit `dependsOn` edges, including Just stages. |
| Conflicting file or directory writes | Ordered dependency edges.                          |

- Treat `pre<task>` and `post<task>` as ordinary names, not implicit hooks.
- Include required completion stages in `build`.
- Do not hide dependencies inside recipes or shell chains.
- Do not use a cacheable parent to skip a dependency with external effects.

## Task contracts

| Task    | Result                                                 |
| ------- | ------------------------------------------------------ |
| `fix`   | Format and lint fixes, without task caching.           |
| `check` | Static checks, without source changes.                 |
| `build` | Final deliverable, including generation and packaging. |
| `test`  | Reproducible tests with controlled resources.          |
| `e2e`   | Separately selected heavyweight or live-system tests.  |
| `ci`    | `check`, `build`, and `test`, without `fix`.           |

- Keep controlled integration tests in `test` when they meet its isolation requirements.
- Keep `e2e` outside default `test` and `ci` unless required by the project.
- Use separate selections in one test framework, not a new framework only for E2E.
- Use `<task>:<CLIName>` for a separately selectable or reusable stage.
- Do not add an empty aggregate for one operation.

## Exclusions and cache

| Concern                                             | Selection or constraint                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Vite+ formatter and linter exclusions               | [@totto2727/gitignore-patterns](https://github.com/totto2727-org/gitignore-patterns), generated when configuration loads. |
| Child-project Gitignore rules                       | Check ancestor rules, outside the helper's scan root.                                                                     |
| Generated escaped literals                          | `ignorePatterns` only, not general cache-input globs.                                                                     |
| Cacheable task                                      | Deterministic outputs restored by a cache hit.                                                                            |
| External effects                                    | No caching for deploy, publish, DB mutation, service startup, or live-service checks.                                     |
| Container image build                               | Cache an exported archive only with complete inputs and immutable base-image references.                                  |
| Image loading, container execution, registry pushes | Outside the cacheable image-build task.                                                                                   |

- Add an exclusion exception only for a demonstrated coverage gap.
- Keep configuration syntax in the official [Vite+ guidance](https://viteplus.dev/guide/), or its installed official skill.
