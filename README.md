# Agent plugins

`totto2727-org/agent` distributes reusable development workflows as [Agent Plugins 1.0.0](https://agent-plugins.org/) packages.

## Usage

After installing `totto2727-coding`, ask your coding agent to audit the documentation in your project:

```text
Use the share-artifact skill to audit this project's README.md. Keep consumer installation and usage in README, move repository build and test instructions to AGENTS.md, and update both files where needed.
```

Expected result:

```text
A concise audit summary identifying the user-facing README improvements, developer-only guidance placed in AGENTS.md, and the files updated.
```

## Key features

- Portable packages with a root `plugin.json` manifest
- Coding and external-information plugins
- Skills installed through `c-plugin`

## Prerequisites

- **c-plugin**: Install a version that supports `github:` plugin sources and make the command available on `PATH`.

## Setup

### Install a plugin

Choose the plugin you need.
Each command installs one plugin from its explicit directory in the GitHub repository.

Coding and testing guidance:

```bash
c-plugin plugin add github:totto2727-org/agent/plugins/totto2727-coding --all
```

External information and connected services:

```bash
c-plugin plugin add github:totto2727-org/agent/plugins/external-information --all
```

To select another branch, tag, or commit, add `--ref REF`.
Without `--ref`, installation uses the remote default branch at fetch time.
The lock records the resolved commit, and synchronization uses that pinned checkout without fetching.
Both commands install every skill without a selection prompt.
Omit `--all` for interactive skill selection.
Each package contains its manifest at `plugins/<plugin>/plugin.json` and its skills in the immediate child directories of `plugins/<plugin>/skills/`.

## API

### `totto2727-coding`

Provides reusable coding and testing guidance, [documentation-principles](plugins/totto2727-coding/skills/documentation-principles/SKILL.md) for shared writing principles, [share-test-design](plugins/totto2727-coding/skills/share-test-design/SKILL.md) for test-design decisions, and [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md) for adaptable README, AGENTS.md, and ADR structures.
Use [documentation-quality](plugins/totto2727-coding/skills/documentation-quality/SKILL.md) to review developer documentation.
Use [share-stack](plugins/totto2727-coding/skills/share-stack/SKILL.md) for shared toolchain, dependency, task, CI, and distribution policy.
Use [realpath](plugins/totto2727-coding/skills/realpath/SKILL.md) for filesystem path calculations and [skill-reviewer](plugins/totto2727-coding/skills/skill-reviewer/SKILL.md) for Agent Skill reviews.

Choose a coding skill for implementation principles and a stack skill for architecture, libraries, and toolchains:

| Scope                     | Coding                                                                | Stack                                                                   |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| JavaScript and TypeScript | [js-coding](plugins/totto2727-coding/skills/js-coding/SKILL.md)       | [js-stack](plugins/totto2727-coding/skills/js-stack/SKILL.md)           |
| MoonBit                   | [mbt-coding](plugins/totto2727-coding/skills/mbt-coding/SKILL.md)     | [mbt-stack](plugins/totto2727-coding/skills/mbt-stack/SKILL.md)         |
| Rust                      | [rust-coding](plugins/totto2727-coding/skills/rust-coding/SKILL.md)   | [rust-stack](plugins/totto2727-coding/skills/rust-stack/SKILL.md)       |
| Go                        | [share-coding](plugins/totto2727-coding/skills/share-coding/SKILL.md) | [go-stack](plugins/totto2727-coding/skills/go-stack/SKILL.md)           |
| Haskell                   | [share-coding](plugins/totto2727-coding/skills/share-coding/SKILL.md) | [haskell-stack](plugins/totto2727-coding/skills/haskell-stack/SKILL.md) |
| Nix infrastructure        | [share-coding](plugins/totto2727-coding/skills/share-coding/SKILL.md) | [nix-stack](plugins/totto2727-coding/skills/nix-stack/SKILL.md)         |

For example, ask: "Use js-stack to select the standard architecture for a new Worker API and js-coding for its implementation principles."
The expected guidance separates the concrete stack from Effect-TS coding rules, selects pnpm for dependency management, and keeps Bun's Nix build role separate.
The stack skills do not migrate an existing project or deploy a service without authorization.

### `external-information`

Provides six coordinated skills:

- [`open-connector`](plugins/external-information/skills/open-connector/SKILL.md): use connected services through OpenConnector.
- [`monid`](plugins/external-information/skills/monid/SKILL.md): use Monid for external information services.
- [`web-search`](plugins/external-information/skills/web-search/SKILL.md): find and retrieve web sources for research.
- [`doc-search`](plugins/external-information/skills/doc-search/SKILL.md): look up library and framework documentation.
- [`cloudflare-ai`](plugins/external-information/skills/cloudflare-ai/SKILL.md): run LLM inference and typed Decision Model judgments with Cloudflare.
- [`decision-model`](plugins/external-information/skills/decision-model/SKILL.md): design constrained semantic judgments for routing, ranking, selection, scoring, extraction, and verification.

See each skill for its usage and service configuration requirements.

## Development

For repository structure and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.
