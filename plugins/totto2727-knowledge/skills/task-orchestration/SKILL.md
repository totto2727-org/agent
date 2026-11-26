---
name: task-orchestration
description: Choose a project task runner, task dependencies, and safe cache boundaries for local development and CI.
---

# Task orchestration

| Decision                    | Choose                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which runner?               | Use Vite+ when the project already uses JavaScript or needs its dependency-aware cache. Otherwise use native commands. Use Just for complex local recipes without adding Node only to standardize names.                            |
| Which work belongs in `ci`? | Non-mutating `check`, the final deliverable from `build`, and reproducible `test`. Keep `fix` separate. Select live or heavyweight `e2e` separately unless the project requires it in CI.                                           |
| What is a dependency?       | Declare preparation, packaging, and conflicting writes as explicit task-graph edges. A task name such as `prebuild` is not an edge. Do not add an aggregate for a single command.                                                   |
| What can be cached?         | A hit must restore the promised output. An image archive with immutable inputs can qualify. Loading the image, starting a service, publishing, and database mutations cannot. A cached parent must not skip a required side effect. |

For formatter and linter file selection, [git-excludes](../git-excludes/SKILL.md) explains which Git rules apply. [gitignore-patterns](https://github.com/totto2727-org/gitignore-patterns) translates rules for `ignorePatterns`. A subdirectory scan omits `.gitignore` files above its root: check ancestor rules separately. Do not reuse escaped literals as general cache-input globs. For runner syntax, use the [Vite+ documentation](https://viteplus.dev/guide/).
