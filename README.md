# Agent plugins

Install the language you work in and add shared guidance when needed. Each [Agent Plugins 1.0.0](https://agent-plugins.org/) package distributes skills only. None declares an MCP server, agent, hook, or standalone command.

## Choose a plugin

- **Run a pstack workflow in Orca:** start with [`poteto-mode`](plugins/totto2727-workflow/skills/poteto-mode/SKILL.md) in `totto2727-workflow`. For example: “Compare two designs in separate Orca workers, using Codex for one and Jcode for the other.” The [Orca guide](plugins/totto2727-workflow/skills/poteto-mode/references/orca.md) distinguishes ordinary commands, handoffs, and supervised workers.
- **Choose a narrower workflow:** use `totto2727-engineering` for design and parallel reviews, `totto2727-verification` for executable checks or statecharts, and `totto2727-communication` for explanations and recaps. Shared principles, TypeScript guidance, and writing skills are integrated with their existing subject packages.

- **Choose an application stack:** [`js-stack`](plugins/totto2727-js/skills/js-stack/SKILL.md) compares Projektor's Worker-backed web UI, Flowdeck's durable workflow design, GlossShift's native NSH and TypeScript GUI, and a standalone Node CLI. To migrate Hono imports, use the [effect-http skill](https://github.com/totto2727-org/effect-http/blob/main/.agents/skills/effect-http/SKILL.md).
- **Decide how to design, write, or test across languages:** use `totto2727-principle`. For example, [choose between `.gitignore` and local Git excludes](plugins/totto2727-principle/skills/share-coding/references/git-excludes.md).
- **Write a README, audit documentation, or review a skill:** use `totto2727-documentation`. For example, ask: “Use share-artifact to separate installation instructions in README from maintenance instructions in AGENTS.md.”
- **Use connected services or research a source:** use `totto2727-external-information`. Use `totto2727-tools` to manage the skill collection.
- **Apply totto2727's personal preferences:** opt into [`totto2727-profile`](plugins/totto2727-profile/skills/totto2727-profile/SKILL.md). A target worktree's root `PROFILE.local.md` overrides individual defaults. The other plugins do not require this profile.

## Install

### Start with one skill

Install [`totto2727-setup`](plugins/totto2727-tools/skills/totto2727-setup/SKILL.md) into the project from the repository root:

```bash
vpx skills@1.9.0 add https://github.com/totto2727-org/agent --full-depth --skill totto2727-setup --agent universal --copy --yes
```

Use `--global` for a user-wide installation instead. To install from a PR or release, use `https://github.com/totto2727-org/agent.git#REF` with its branch, tag, or commit. Then ask the agent to use `totto2727-setup` to install the collection and its external skill dependencies in the same scope. To remove the collection, use the same skill and scope.

### Install one plugin instead

With a `c-plugin` version that supports `github:` sources, install one package by name:

```bash
c-plugin plugin add github:totto2727-org/agent/plugins/totto2727-js --all
```

Replace `totto2727-js` with another package listed below. Omit `--all` to select individual skills interactively. Use `--ref REF` for a branch, tag, or commit. Without it, installation resolves the default branch. The lock pins the resolved commit for synchronization.

## Plugin and skill map

For Japanese HTML reports, use [`visual-explainer-ja`](plugins/totto2727-documentation/skills/visual-explainer-ja/SKILL.md). Collection setup installs its [renderer](https://github.com/nicobailon/visual-explainer) and [MoonBit Orientation](https://github.com/moonbitlang/skills), including with `--required-only`. Orca and the oo CLI supply their own skills.

**Refers to** lists other skills in this repository linked or explicitly named in a skill or its reference material. These are reading paths, not automatic install dependencies. A cross-plugin link has a source fallback, so you can install a language plugin alone.
The [setup inventory](plugins/totto2727-tools/skills/totto2727-setup/dependencies.json) lists external skills installed by the bootstrap, their consumers, and their verified revisions. The [Oxlint library](https://github.com/totto2727-org/oxlint) owns its diagnostic guide. Installing a skill does not install the npm package or enable a preset.
External tools are separate: the OpenConnector workflows use the configured `oo` CLI, Monid workflows use the Monid CLI, and hosted inference needs Cloudflare credentials. The mechanical documentation checks run locally. Only their optional semantic evaluation needs a configured inference service.

### [totto2727-communication](plugins/totto2727-communication/plugin.json)

Code walkthroughs, design rationale, task framing, and progress reports.

| Skill                                                                                  | Refers to              |
| -------------------------------------------------------------------------------------- | ---------------------- |
| [bro](plugins/totto2727-communication/skills/bro/SKILL.md)                             | None                   |
| [how](plugins/totto2727-communication/skills/how/SKILL.md)                             | `poteto-mode`          |
| [in-your-own-words](plugins/totto2727-communication/skills/in-your-own-words/SKILL.md) | None                   |
| [ketchup](plugins/totto2727-communication/skills/ketchup/SKILL.md)                     | `bro`                  |
| [ketchup-video](plugins/totto2727-communication/skills/ketchup-video/SKILL.md)         | `ketchup`              |
| [reframe](plugins/totto2727-communication/skills/reframe/SKILL.md)                     | None                   |
| [sharpen](plugins/totto2727-communication/skills/sharpen/SKILL.md)                     | None                   |
| [teach](plugins/totto2727-communication/skills/teach/SKILL.md)                         | `how`, `unslop`, `why` |
| [why](plugins/totto2727-communication/skills/why/SKILL.md)                             | None                   |

### [totto2727-documentation](plugins/totto2727-documentation/plugin.json)

Developer documentation, artifact templates, documentation quality checks, and skill reviews.

| Skill                                                                                          | Refers to                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [documentation-quality](plugins/totto2727-documentation/skills/documentation-quality/SKILL.md) | `cloudflare-ai`, `decision-model`, `documentation-principles` |
| [share-artifact](plugins/totto2727-documentation/skills/share-artifact/SKILL.md)               | `documentation-principles`                                    |
| [skill-reviewer](plugins/totto2727-documentation/skills/skill-reviewer/SKILL.md)               | `documentation-principles`                                    |
| [technical-writing](plugins/totto2727-documentation/skills/technical-writing/SKILL.md)         | `documentation-principles`, `documentation-quality`, `unslop` |
| [unslop](plugins/totto2727-documentation/skills/unslop/SKILL.md)                               | None                                                          |
| [visual-explainer-ja](plugins/totto2727-documentation/skills/visual-explainer-ja/SKILL.md)     | None                                                          |

### [totto2727-engineering](plugins/totto2727-engineering/plugin.json)

Design alternatives, engineering reviews, parallel work, and evidence-based correction.

| Skill                                                                        | Refers to                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [architect](plugins/totto2727-engineering/skills/architect/SKILL.md)         | `arena`                                                                                                    |
| [arena](plugins/totto2727-engineering/skills/arena/SKILL.md)                 | `poteto-mode`                                                                                              |
| [blast-radius](plugins/totto2727-engineering/skills/blast-radius/SKILL.md)   | `arena`, `how`, `unslop`, `why`                                                                            |
| [correct](plugins/totto2727-engineering/skills/correct/SKILL.md)             | None                                                                                                       |
| [figure-it-out](plugins/totto2727-engineering/skills/figure-it-out/SKILL.md) | `architect`, `arena`, `poteto-mode`, `show-me-your-work`                                                   |
| [interrogate](plugins/totto2727-engineering/skills/interrogate/SKILL.md)     | `arena`, `in-your-own-words`                                                                               |
| [no-comments](plugins/totto2727-engineering/skills/no-comments/SKILL.md)     | `architect`, `poteto-mode`, `principle-fix-root-causes`, `principle-redesign-from-first-principles`, `why` |
| [swarm](plugins/totto2727-engineering/skills/swarm/SKILL.md)                 | `poteto-mode`                                                                                              |

### [totto2727-external-information](plugins/totto2727-external-information/plugin.json)

Monid/TinyFish research, cost-aware Cloudflare AI inference and typed Decision Models, plus OpenConnector for Projektor, Context7, Browser Run, and GitHub.

| Skill                                                                                   | Refers to                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [cloudflare-ai](plugins/totto2727-external-information/skills/cloudflare-ai/SKILL.md)   | `decision-model`                                                           |
| [decision-model](plugins/totto2727-external-information/skills/decision-model/SKILL.md) | `cloudflare-ai`                                                            |
| [doc-search](plugins/totto2727-external-information/skills/doc-search/SKILL.md)         | `open-connector`, `web-search`                                             |
| [monid](plugins/totto2727-external-information/skills/monid/SKILL.md)                   | None                                                                       |
| [open-connector](plugins/totto2727-external-information/skills/open-connector/SKILL.md) | None                                                                       |
| [projektor](plugins/totto2727-external-information/skills/projektor/SKILL.md)           | `open-connector`                                                           |
| [web-search](plugins/totto2727-external-information/skills/web-search/SKILL.md)         | `cloudflare-ai`, `decision-model`, `doc-search`, `monid`, `open-connector` |

### [totto2727-js](plugins/totto2727-js/plugin.json)

TypeScript stack choices for Cloudflare web apps, durable workflows, native macOS GUIs, and CLIs.

| Skill                                                     | Refers to |
| --------------------------------------------------------- | --------- |
| [js-stack](plugins/totto2727-js/skills/js-stack/SKILL.md) | None      |

### [totto2727-mbt](plugins/totto2727-mbt/plugin.json)

MoonBit implementation, stack selection, and tests.

| Skill                                                          | Refers to   |
| -------------------------------------------------------------- | ----------- |
| [mbt-coding](plugins/totto2727-mbt/skills/mbt-coding/SKILL.md) | `mbt-stack` |
| [mbt-stack](plugins/totto2727-mbt/skills/mbt-stack/SKILL.md)   | None        |
| [mbt-test](plugins/totto2727-mbt/skills/mbt-test/SKILL.md)     | None        |

### [totto2727-principle](plugins/totto2727-principle/plugin.json)

Shared principles for implementation, writing, testing, and stack selection.

| Skill                                                                                                                                                | Refers to                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [documentation-principles](plugins/totto2727-principle/skills/documentation-principles/SKILL.md)                                                     | `documentation-quality`, `share-artifact`, `technical-writing`                                                                                                                                                                                                                                                                                                       |
| [principle-attack-the-premise](plugins/totto2727-principle/skills/principle-attack-the-premise/SKILL.md)                                             | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-boundary-discipline](plugins/totto2727-principle/skills/principle-boundary-discipline/SKILL.md)                                           | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-build-the-lever](plugins/totto2727-principle/skills/principle-build-the-lever/SKILL.md)                                                   | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-encode-lessons-in-structure](plugins/totto2727-principle/skills/principle-encode-lessons-in-structure/SKILL.md)                           | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-exhaust-the-design-space](plugins/totto2727-principle/skills/principle-exhaust-the-design-space/SKILL.md)                                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-experience-first](plugins/totto2727-principle/skills/principle-experience-first/SKILL.md)                                                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-explain-the-number](plugins/totto2727-principle/skills/principle-explain-the-number/SKILL.md)                                             | `benchmark-checklist`                                                                                                                                                                                                                                                                                                                                                |
| [principle-fix-root-causes](plugins/totto2727-principle/skills/principle-fix-root-causes/SKILL.md)                                                   | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-foundational-thinking](plugins/totto2727-principle/skills/principle-foundational-thinking/SKILL.md)                                       | `principle-sequence-verifiable-units`                                                                                                                                                                                                                                                                                                                                |
| [principle-guard-the-context-window](plugins/totto2727-principle/skills/principle-guard-the-context-window/SKILL.md)                                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-laziness-protocol](plugins/totto2727-principle/skills/principle-laziness-protocol/SKILL.md)                                               | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-make-operations-idempotent](plugins/totto2727-principle/skills/principle-make-operations-idempotent/SKILL.md)                             | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-migrate-callers-then-delete-legacy-apis](plugins/totto2727-principle/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md)   | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-minimize-reader-load](plugins/totto2727-principle/skills/principle-minimize-reader-load/SKILL.md)                                         | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-model-the-domain](plugins/totto2727-principle/skills/principle-model-the-domain/SKILL.md)                                                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-never-block-on-the-human](plugins/totto2727-principle/skills/principle-never-block-on-the-human/SKILL.md)                                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-outcome-oriented-execution](plugins/totto2727-principle/skills/principle-outcome-oriented-execution/SKILL.md)                             | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-prove-it-works](plugins/totto2727-principle/skills/principle-prove-it-works/SKILL.md)                                                     | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-redesign-from-first-principles](plugins/totto2727-principle/skills/principle-redesign-from-first-principles/SKILL.md)                     | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-separate-before-serializing-shared-state](plugins/totto2727-principle/skills/principle-separate-before-serializing-shared-state/SKILL.md) | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-sequence-verifiable-units](plugins/totto2727-principle/skills/principle-sequence-verifiable-units/SKILL.md)                               | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-subtract-before-you-add](plugins/totto2727-principle/skills/principle-subtract-before-you-add/SKILL.md)                                   | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-test-behavior-not-implementation](plugins/totto2727-principle/skills/principle-test-behavior-not-implementation/SKILL.md)                 | None                                                                                                                                                                                                                                                                                                                                                                 |
| [principle-type-system-discipline](plugins/totto2727-principle/skills/principle-type-system-discipline/SKILL.md)                                     | None                                                                                                                                                                                                                                                                                                                                                                 |
| [share-coding](plugins/totto2727-principle/skills/share-coding/SKILL.md)                                                                             | `principle-boundary-discipline`, `principle-exhaust-the-design-space`, `principle-foundational-thinking`, `principle-laziness-protocol`, `principle-migrate-callers-then-delete-legacy-apis`, `principle-minimize-reader-load`, `principle-model-the-domain`, `principle-sequence-verifiable-units`, `principle-type-system-discipline`, `share-stack`, `share-test` |
| [share-stack](plugins/totto2727-principle/skills/share-stack/SKILL.md)                                                                               | `js-stack`                                                                                                                                                                                                                                                                                                                                                           |
| [share-test](plugins/totto2727-principle/skills/share-test/SKILL.md)                                                                                 | `js-stack`, `mbt-test`, `principle-test-behavior-not-implementation`                                                                                                                                                                                                                                                                                                 |
| [share-test-design](plugins/totto2727-principle/skills/share-test-design/SKILL.md)                                                                   | `share-test`                                                                                                                                                                                                                                                                                                                                                         |

### [totto2727-profile](plugins/totto2727-profile/plugin.json)

Optional personal defaults for totto2727's Git identity, delivery, and local workspace.

| Skill                                                                            | Refers to                                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [totto2727-profile](plugins/totto2727-profile/skills/totto2727-profile/SKILL.md) | `doc-search`, `open-connector`, `projektor`, `visual-explainer-ja`, `web-search` |

### [totto2727-tools](plugins/totto2727-tools/plugin.json)

Install and remove the skill collection and its external dependencies.

| Skill                                                                      | Refers to |
| -------------------------------------------------------------------------- | --------- |
| [totto2727-setup](plugins/totto2727-tools/skills/totto2727-setup/SKILL.md) | None      |

### [totto2727-verification](plugins/totto2727-verification/plugin.json)

Test-driven development, project verification skills, benchmarks, and executable TLA+ statecharts.

| Skill                                                                                                                   | Refers to                                          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [benchmark-checklist](plugins/totto2727-verification/skills/benchmark-checklist/SKILL.md)                               | None                                               |
| [create-formal-verification-skill](plugins/totto2727-verification/skills/create-formal-verification-skill/SKILL.md)     | `maintain-formal-verification-skill`, `statechart` |
| [create-verification-skill](plugins/totto2727-verification/skills/create-verification-skill/SKILL.md)                   | `maintain-verification-skill`                      |
| [maintain-formal-verification-skill](plugins/totto2727-verification/skills/maintain-formal-verification-skill/SKILL.md) | `create-formal-verification-skill`                 |
| [maintain-verification-skill](plugins/totto2727-verification/skills/maintain-verification-skill/SKILL.md)               | `create-verification-skill`                        |
| [statechart](plugins/totto2727-verification/skills/statechart/SKILL.md)                                                 | None                                               |
| [tdd](plugins/totto2727-verification/skills/tdd/SKILL.md)                                                               | None                                               |

### [totto2727-workflow](plugins/totto2727-workflow/plugin.json)

pstack workflow selection, playbooks, and agent coordination on Orca.

| Skill                                                                             | Refers to                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [automate-me](plugins/totto2727-workflow/skills/automate-me/SKILL.md)             | `poteto-mode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [make-bot-ui](plugins/totto2727-workflow/skills/make-bot-ui/SKILL.md)             | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [poteto-help](plugins/totto2727-workflow/skills/poteto-help/SKILL.md)             | `poteto-mode`, `setup-pstack`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [poteto-mode](plugins/totto2727-workflow/skills/poteto-mode/SKILL.md)             | `architect`, `arena`, `benchmark-checklist`, `figure-it-out`, `interrogate`, `ketchup`, `principle-build-the-lever`, `principle-encode-lessons-in-structure`, `principle-exhaust-the-design-space`, `principle-foundational-thinking`, `principle-guard-the-context-window`, `principle-laziness-protocol`, `principle-migrate-callers-then-delete-legacy-apis`, `principle-minimize-reader-load`, `principle-model-the-domain`, `principle-prove-it-works`, `principle-redesign-from-first-principles`, `principle-separate-before-serializing-shared-state`, `principle-sequence-verifiable-units`, `principle-subtract-before-you-add`, `show-me-your-work`, `swarm`, `tdd`, `unslop`, `why` |
| [recall](plugins/totto2727-workflow/skills/recall/SKILL.md)                       | `automate-me`, `poteto-mode`, `unslop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [reflect](plugins/totto2727-workflow/skills/reflect/SKILL.md)                     | `poteto-mode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setup-pstack](plugins/totto2727-workflow/skills/setup-pstack/SKILL.md)           | `poteto-mode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [show-me-your-work](plugins/totto2727-workflow/skills/show-me-your-work/SKILL.md) | `poteto-mode`, `principle-encode-lessons-in-structure`, `unslop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Development and license

See [AGENTS.md](AGENTS.md) for repository checks and skill ownership. See the [pstack comparison revisions and integration policy](docs/upstream-differences.md) before taking upstream changes. Each pstack skill includes its upstream MIT notice. No repository-wide license is declared.
