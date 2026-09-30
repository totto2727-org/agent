# Agent plugin marketplace

`totto2727-org/agent` distributes a coordinated marketplace of Claude Code, Cursor, and Codex plugins for reusable development workflows.

## Usage

After installing the marketplace, ask a supported coding agent to audit the documentation in your project:

```text
Use the share-artifact skill to audit this project's README.md. Keep consumer installation and usage in README, move repository build and test instructions to AGENTS.md, and update both files where needed.
```

Expected result:

```text
A concise audit summary identifying the user-facing README improvements, developer-only guidance placed in AGENTS.md, and the files updated.
```

## Key features

- One plugin catalog distributed to Claude Code, Cursor, and Codex
- General-purpose, coding, and external-information plugins
- Skills installed through `c-plugin`

## Prerequisites

- **c-plugin**: Install `c-plugin` and make the command available on `PATH` before adding this marketplace.

## Setup

### Install

```bash
c-plugin skill add totto2727-org/agent
```

## API

### `totto2727`

Provides general-purpose utility skills.

### `totto2727-coding`

Provides reusable coding and testing guidance, [documentation-principles](plugins/totto2727-coding/skills/documentation-principles/SKILL.md) for shared writing principles, [share-test-design](plugins/totto2727-coding/skills/share-test-design/SKILL.md) for test-design decisions, and [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md) for adaptable README, AGENTS.md, and ADR structures.
Jinja templates show the overall document shape; they do not require a renderer or exact reproduction.
Use [documentation-quality](plugins/totto2727-coding/skills/documentation-quality/SKILL.md) for rule-based document reviews and optional parallel Jev checks through OOMOL/OpenConnector.

### `external-information`

Provides four coordinated skills:

- `open-connector`: shared API access for GitHub, Linear, Brave Search, Cloudflare Browser Run, Context7, and Jev.
- `monid`: separate access policy for Monid discovery, inspection, execution, polling, and saved-response handling.
- `web-search`: Monid/TinyFish search and Markdown retrieval with links enabled, saved responses and content-only `jq` reads, and Jev selection of related pages; Browser Run, Brave, specialized APIs, and Codex built-in Web Search remain available under its fallback policy.
- `doc-search`: Context7 library lookup and documentation retrieval through the shared base.

Configure a complete HTTPS gateway URL in `OPENCONNECTOR_BASE_URL` or trusted agent instructions and supply `OPENCONNECTOR_TOKEN` through a secret environment configuration.
See the [base skill](plugins/external-information/skills/open-connector/SKILL.md) for routing, authentication, and API request examples.
TinyFish uses a separately configured Monid credential, not the OpenConnector token.
Context7, TypeSafe/Jev, and Cloudflare Browser Run execute directly through OOMOL/OpenConnector and must never be routed through Monid.
The local [Monid policy](plugins/external-information/skills/monid/SKILL.md) references Monid's upstream skill and API documentation rather than copying its CLI instructions; [web-search](plugins/external-information/skills/web-search/SKILL.md) similarly references the official `typesafe-ai` skill.
When upgrading an installation that selected `external-search`, select `external-information` instead; `web-search` and `doc-search` keep their skill names.

### Upgrading existing installations

The `symphony` plugin and `macos-cli-rules` skill are no longer distributed.
Remove stale installed copies if your installer does not remove them automatically.
The `share-test-design-flow` skill is now `share-test-design`; update explicit skill references when upgrading.

Standalone skills from the source monorepo are intentionally not distributed; every public skill belongs to one of the three plugins above.

## Development

For repository structure, manifest synchronization, and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.
