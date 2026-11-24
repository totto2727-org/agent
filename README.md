# Agent plugins

Install the language you work in and add shared guidance when needed. Each [Agent Plugins 1.0.0](https://agent-plugins.org/) package distributes skills only. None declares an MCP server, agent, hook, or standalone command.

## Choose a plugin

- **Implement, select a stack, or test:** use the plugin for your language. `totto2727-js` also covers [Hono to Effect migration](plugins/totto2727-js/skills/js-stack/references/knowledge/hono-to-effect/README.md) and [Oxlint diagnostics](plugins/totto2727-js/skills/oxlint/SKILL.md).
- **Decide how to design, write, or test across languages:** use `totto2727-principle`.
- **Write a README, audit documentation, or review a skill:** use `totto2727-documentation`. For example, ask: “Use share-artifact to separate installation instructions in README from maintenance instructions in AGENTS.md.”
- **Use connected services or research a source:** use `totto2727-external-information`. Use `totto2727-tools` for filesystem path calculations.

## Install

With a `c-plugin` version that supports `github:` sources, install one package by name:

```bash
c-plugin plugin add github:totto2727-org/agent/plugins/totto2727-js --all
```

Replace `totto2727-js` with another package listed below. Omit `--all` to select individual skills interactively. Use `--ref REF` for a branch, tag, or commit. Without it, installation resolves the default branch. The lock pins the resolved commit for synchronization.

## Plugin and skill map

**Refers to** lists other skills in this repository linked from a skill or its reference material. These are reading paths, not automatic install dependencies. A cross-plugin link has a source fallback, so you can install a language plugin alone.
External tools are separate: the OpenConnector workflows use the configured `oo` CLI, Monid workflows use the Monid CLI, and hosted inference needs Cloudflare credentials. The mechanical documentation checks run locally. Only their optional semantic evaluation needs a configured inference service.

### [totto2727-principle](plugins/totto2727-principle/plugin.json)

Shared principles for implementation, writing, testing, and stack selection.

| Skill                                                                                            | Refers to                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [documentation-principles](plugins/totto2727-principle/skills/documentation-principles/SKILL.md) | `documentation-quality`, `share-artifact`                                                                                                        |
| [share-coding](plugins/totto2727-principle/skills/share-coding/SKILL.md)                         | `js-coding`, `js-test`, `mbt-coding`, `mbt-test`, `rust-coding`, `rust-test`, `share-artifact`, `share-stack`, `share-test`, `share-test-design` |
| [share-stack](plugins/totto2727-principle/skills/share-stack/SKILL.md)                           | `go-stack`, `haskell-stack`, `js-coding`, `js-stack`, `mbt-coding`, `mbt-stack`, `nix-stack`, `rust-coding`, `rust-stack`, `share-coding`        |
| [share-test](plugins/totto2727-principle/skills/share-test/SKILL.md)                             | `js-test`, `mbt-test`, `rust-test`, `share-test-design`                                                                                          |
| [share-test-design](plugins/totto2727-principle/skills/share-test-design/SKILL.md)               | `documentation-principles`, `js-test`, `mbt-test`, `rust-test`, `share-test`                                                                     |

### [totto2727-js](plugins/totto2727-js/plugin.json)

JavaScript and TypeScript implementation, stack selection, tests, and Oxlint rule remedies.

| Skill                                                       | Refers to                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| [js-coding](plugins/totto2727-js/skills/js-coding/SKILL.md) | `js-stack`, `oxlint`, `share-coding`                         |
| [js-stack](plugins/totto2727-js/skills/js-stack/SKILL.md)   | `js-coding`, `js-test`, `nix-stack`, `oxlint`, `share-stack` |
| [js-test](plugins/totto2727-js/skills/js-test/SKILL.md)     | `oxlint`, `share-test`, `share-test-design`                  |
| [oxlint](plugins/totto2727-js/skills/oxlint/SKILL.md)       | None                                                         |

### [totto2727-go](plugins/totto2727-go/plugin.json)

Go toolchain and application stack selection.

| Skill                                                     | Refers to                                  |
| --------------------------------------------------------- | ------------------------------------------ |
| [go-stack](plugins/totto2727-go/skills/go-stack/SKILL.md) | `nix-stack`, `share-coding`, `share-stack` |

### [totto2727-haskell](plugins/totto2727-haskell/plugin.json)

Haskell toolchain and application stack selection.

| Skill                                                                    | Refers to                                  |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| [haskell-stack](plugins/totto2727-haskell/skills/haskell-stack/SKILL.md) | `nix-stack`, `share-coding`, `share-stack` |

### [totto2727-mbt](plugins/totto2727-mbt/plugin.json)

MoonBit implementation, stack selection, and tests.

| Skill                                                          | Refers to                                            |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| [mbt-coding](plugins/totto2727-mbt/skills/mbt-coding/SKILL.md) | `mbt-stack`, `mbt-test`, `share-coding`              |
| [mbt-stack](plugins/totto2727-mbt/skills/mbt-stack/SKILL.md)   | `mbt-coding`, `mbt-test`, `nix-stack`, `share-stack` |
| [mbt-test](plugins/totto2727-mbt/skills/mbt-test/SKILL.md)     | `mbt-coding`, `share-test`, `share-test-design`      |

### [totto2727-rust](plugins/totto2727-rust/plugin.json)

Rust implementation, stack selection, and tests.

| Skill                                                             | Refers to                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| [rust-coding](plugins/totto2727-rust/skills/rust-coding/SKILL.md) | `rust-stack`, `rust-test`, `share-coding`                        |
| [rust-stack](plugins/totto2727-rust/skills/rust-stack/SKILL.md)   | `rust-coding`, `rust-test`, `share-stack`                        |
| [rust-test](plugins/totto2727-rust/skills/rust-test/SKILL.md)     | `rust-coding`, `share-coding`, `share-test`, `share-test-design` |

### [totto2727-nix](plugins/totto2727-nix/plugin.json)

Nix infrastructure and JavaScript application packaging.

| Skill                                                        | Refers to                 |
| ------------------------------------------------------------ | ------------------------- |
| [nix-stack](plugins/totto2727-nix/skills/nix-stack/SKILL.md) | `js-stack`, `share-stack` |

### [totto2727-documentation](plugins/totto2727-documentation/plugin.json)

Developer documentation reviews, skill reviews, and artifact templates.

| Skill                                                                                          | Refers to                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [documentation-quality](plugins/totto2727-documentation/skills/documentation-quality/SKILL.md) | `cloudflare-ai`, `decision-model`, `documentation-principles` |
| [share-artifact](plugins/totto2727-documentation/skills/share-artifact/SKILL.md)               | `documentation-principles`                                    |
| [skill-reviewer](plugins/totto2727-documentation/skills/skill-reviewer/SKILL.md)               | `documentation-principles`                                    |

### [totto2727-tools](plugins/totto2727-tools/plugin.json)

Filesystem path resolution.

| Skill                                                        | Refers to |
| ------------------------------------------------------------ | --------- |
| [realpath](plugins/totto2727-tools/skills/realpath/SKILL.md) | None      |

### [totto2727-external-information](plugins/totto2727-external-information/plugin.json)

Connected services, web and documentation research, and hosted inference.

| Skill                                                                                   | Refers to                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [cloudflare-ai](plugins/totto2727-external-information/skills/cloudflare-ai/SKILL.md)   | `decision-model`                                                           |
| [decision-model](plugins/totto2727-external-information/skills/decision-model/SKILL.md) | `cloudflare-ai`                                                            |
| [doc-search](plugins/totto2727-external-information/skills/doc-search/SKILL.md)         | `open-connector`, `web-search`                                             |
| [monid](plugins/totto2727-external-information/skills/monid/SKILL.md)                   | None                                                                       |
| [open-connector](plugins/totto2727-external-information/skills/open-connector/SKILL.md) | None                                                                       |
| [projektor](plugins/totto2727-external-information/skills/projektor/SKILL.md)           | `open-connector`                                                           |
| [web-search](plugins/totto2727-external-information/skills/web-search/SKILL.md)         | `cloudflare-ai`, `decision-model`, `doc-search`, `monid`, `open-connector` |

## Development and license

See [AGENTS.md](AGENTS.md) for repository checks and how to refresh the Oxlint references. No repository-wide license is declared. The imported Oxlint documentation retains its [MIT license](plugins/totto2727-js/skills/oxlint/LICENSE).
