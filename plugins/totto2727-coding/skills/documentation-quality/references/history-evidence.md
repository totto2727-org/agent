# Historical reference for documentation rules

This reference records the revision families used to interpret the rules, not an overall quality ranking of the source repository.
The requested positive targets are the actual merged versions of [effront PR #15](https://github.com/totto2727-org/effront/pull/15) and [PR #17](https://github.com/totto2727-org/effront/pull/17).
Their merge commits are `204cd3dd14a05a7e789a934bef5a2a1c31c0d909` and `298d5c8a6c0c06229919bedf3e144989dff31a66`.
Use those hashes rather than the moving `main` branch when reproducing a comparison.

## PR #15: simplify the route to a running project

The branch first added the generator and platform starters, then revised how readers reach and use them.
The relevant writing changes are not visible as a sequence in a single base-to-merge diff.

| Revision                                                                                             | Corrected-away pattern                                                                            | Merged direction                                                               | Evaluation consequence                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [a1618a2c](https://github.com/totto2727-org/effront/commit/a1618a2c3c0fe89596b983a2bf0c80b9512c46bd) | Guides route readers through workspace examples despite the available public generator            | Create a project through the supported generator and proceed with that project | Judge the route to the public default, not familiarity with repository layout                |
| [514c7531](https://github.com/totto2727-org/effront/commit/514c75312f4202f7c92d89566fc257cb036777cb) | Getting started enumerates all other host guides                                                  | `For other configurations, see [Platforms](../platforms.md).`                  | A one-sentence navigation unit can be complete; do not demand alternative setup details here |
| [10b1cf5b](https://github.com/totto2727-org/effront/commit/10b1cf5b6fb3f5ec1d2f685bd3adbc6d710b7757) | Repeated platform introductions mention richer examples and internal server test fixtures         | Start directly with the task heading and prerequisites                         | Remove maintainer history and duplicated introductions, not useful prerequisites             |
| [10b1cf5b](https://github.com/totto2727-org/effront/commit/10b1cf5b6fb3f5ec1d2f685bd3adbc6d710b7757) | Basic Cloudflare setup digresses into optional `APP_LABEL` bindings and request-context mechanics | Retain the concrete requirement to keep `nodejs_compat`                        | Split advanced tasks rather than treating every available fact as necessary setup            |
| [680e0cb7](https://github.com/totto2727-org/effront/commit/680e0cb72f2deb06a4c313be8485c0e03ea5b986) | Root prerequisites include platform-specific runtimes and deployment credentials                  | Host-specific prerequisites remain in their host guides                        | Check information locality across entrypoint and destination, not deletion alone             |

For example, the removed Node introduction said: `The richer Node.js application is retained only as a [server test fixture]`.
That fact serves repository maintenance, not the reader's task of generating and running a Node application.
The retained `Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).` is a prerequisite, not filler.

## PR #17: explain rendering as a consumer contract

The branch also changed rendering implementation and public exports.
Do not label earlier APIs or changed SSR behavior as prose failures merely because the implementation evolved.
Use the later documentation-only revisions to isolate writing criteria.

| Revision                                                                                             | Corrected-away pattern                                                                                                      | Merged direction                                                                                                         | Evaluation consequence                                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [92de8b8b](https://github.com/totto2727-org/effront/commit/92de8b8b51cfdee219b667e3b89806f8cd88ffc4) | A note discusses client wrappers, server-renderable containers, and unchanged upstream styles                               | A warning identifies Math/Mermaid's JavaScript requirement, placeholder output, and server-renderable replacement option | Consequential limitations need reader-visible scope, consequence, and remedy              |
| [71f11f63](https://github.com/totto2727-org/effront/commit/71f11f63cca18d83febd4666648c8f61adcc77ca) | Detailed consumer documentation is repeated in package files and the documentation site                                     | Package README links to the bilingual site's guide and reference, while maintainer material remains separate             | Establish a canonical home instead of adding a new parallel guide                         |
| [9af28103](https://github.com/totto2727-org/effront/commit/9af2810339ba539325c7a145939c98cf6a835319) | A basic asset paragraph introduces an optional `?url&no-inline` detour                                                      | Retain the asset glob requirement and matching `base` explanation                                                        | A focused paragraph can omit advanced alternatives while preserving the needed constraint |
| [d6b5a67b](https://github.com/totto2727-org/effront/commit/d6b5a67bfbcd35acba4699e273dd542320330bd5) | Rendering and component replacement are described through prose-only mechanism names                                        | Concrete import/render and `MyMermaid` replacement examples                                                              | Concision sometimes requires adding code, not deleting information                        |
| [d6b5a67b](https://github.com/totto2727-org/effront/commit/d6b5a67bfbcd35acba4699e273dd542320330bd5) | The guide repeats that Effront supplies Comark components and minimal CSS after already explaining the imports and defaults | Keep the default registration and replacement contract without the repeated implementation summary                       | Remove repetition only when the surrounding unit retains the contract                     |

The merged warning is:

```markdown
> [!WARNING]
> Math and Mermaid currently require client-side JavaScript and do not support SSR.
> The server skips rendering equations and diagrams and emits only placeholders.
> If you need SSR, implement server-renderable replacements and supply them through `components`.
```

Compare it with the earlier note in the parent of `92de8b8b`:

```markdown
> [!NOTE]
> Effront registers Comark's default Math and Mermaid through client wrappers; the document itself remains server-renderable.
> Completed equations and diagrams require browser JavaScript, and upstream Mermaid SVG styles and font imports remain unchanged.
```

The issue is not the existence of technical detail.
The corrected unit makes the limitation and available action legible to a consumer instead of expecting them to infer the consequence from internal boundaries.

## Limits on inference

These transitions justify concrete rules about reader routes, consumer consequences, canonical ownership, and focused examples.
They do not justify banning implementation terminology, all repeated prerequisites, all alternatives, or all short pages.
An intermediate revision is not the final positive target if a later commit changes it again.
Translated editions are excluded from this rubric; keep nearly identical Node and Bun guides in the same split rather than treating them as independent evidence.

The maintained corpus records selected source ranges and per-rule labels separately from model input.
Its holdout is a regression check against a separate revision family, not evidence that the rule design itself was blind to these public PRs.
