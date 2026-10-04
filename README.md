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
- Coding and external-information plugins
- Skills installed through `c-plugin`

## Prerequisites

- **c-plugin**: Install `c-plugin` and make the command available on `PATH` before adding this marketplace.

## Setup

### Install

```bash
c-plugin skill add totto2727-org/agent
```

## API

### `totto2727-coding`

Provides reusable coding and testing guidance, [documentation-principles](plugins/totto2727-coding/skills/documentation-principles/SKILL.md) for shared writing principles, [share-test-design](plugins/totto2727-coding/skills/share-test-design/SKILL.md) for test-design decisions, and [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md) for adaptable README, AGENTS.md, and ADR structures.
Use [documentation-quality](plugins/totto2727-coding/skills/documentation-quality/SKILL.md) to review developer documentation.
Use [realpath](plugins/totto2727-coding/skills/realpath/SKILL.md) for filesystem path calculations and [skill-reviewer](plugins/totto2727-coding/skills/skill-reviewer/SKILL.md) for Agent Skill reviews.

### `external-information`

Provides six coordinated skills:

- [open-connector](plugins/external-information/skills/open-connector/SKILL.md): use connected services through OpenConnector.
- [monid](plugins/external-information/skills/monid/SKILL.md): use Monid for external information services.
- [web-search](plugins/external-information/skills/web-search/SKILL.md): find and retrieve web sources for research.
- [doc-search](plugins/external-information/skills/doc-search/SKILL.md): look up library and framework documentation.
- [cloudflare-ai](plugins/external-information/skills/cloudflare-ai/SKILL.md): run LLM inference and typed Decision Model judgments with Cloudflare.
- [decision-model](plugins/external-information/skills/decision-model/SKILL.md): design constrained semantic judgments for routing, ranking, selection, scoring, extraction, and verification.

See each skill for its usage and service configuration requirements.

## Development

For repository structure, manifest synchronization, and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.
