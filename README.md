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
Jinja templates show the overall document shape; they do not require a renderer or exact reproduction.
Use [documentation-quality](plugins/totto2727-coding/skills/documentation-quality/SKILL.md) for rule-based document reviews and optional parallel Jev checks through OOMOL/OpenConnector.
Use [realpath](plugins/totto2727-coding/skills/realpath/SKILL.md) for filesystem path calculations and [skill-reviewer](plugins/totto2727-coding/skills/skill-reviewer/SKILL.md) for Agent Skill reviews.

### `external-information`

Provides four coordinated skills:

- `open-connector`: references to the official `oo` skill and CLI documentation.
- `monid`: a reference to the official Monid skill.
- `web-search`: Monid/TinyFish search and Markdown retrieval with links enabled, saved responses and content-only `jq` reads, and Jev selection of related pages; Browser Run, specialized APIs, and Codex built-in Web Search remain available under its fallback policy.
- `doc-search`: Context7 library lookup and documentation retrieval through the shared base.

Configure a complete HTTPS gateway URL in `OPENCONNECTOR_BASE_URL` or trusted agent instructions and supply `OPENCONNECTOR_TOKEN` through a secret environment configuration.
The [web-search](plugins/external-information/skills/web-search/SKILL.md) and [doc-search](plugins/external-information/skills/doc-search/SKILL.md) workflows own routing, gateway environment mapping, and saved-response handling.
TinyFish requires the official `@monid-ai/cli` command `monid` and a separately configured active Monid key, not the OpenConnector token.
See the [official CLI setup](https://monid.ai/docs/cli/overview.md) for installation and authentication; CLI or account setup is not performed automatically by these research skills.
Context7, TypeSafe/Jev, and Cloudflare Browser Run execute directly through OOMOL/OpenConnector and must never be routed through Monid.
The [monid](plugins/external-information/skills/monid/SKILL.md) and [open-connector](plugins/external-information/skills/open-connector/SKILL.md) skills contain official references only; research-specific instructions belong to their callers.

## Development

For repository structure, manifest synchronization, and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.
