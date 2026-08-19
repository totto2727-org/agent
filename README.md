# Agent plugin marketplace

`totto2727-org/agent` distributes a coordinated marketplace of Claude Code, Cursor, and Codex plugins for reusable development workflows.

## Usage

Install the marketplace skills with `c-plugin`:

```bash
c-plugin skill add totto2727-org/agent
```

The command discovers the marketplace manifests and installs the skills exposed by its plugin catalog.

## Key features

- One plugin catalog distributed to Claude Code, Cursor, and Codex
- General-purpose, coding, external-search, and Symphony workflow plugins
- Skills installed through one consumer-facing `c-plugin` command

## Prerequisites

- **c-plugin**: Install skills from the marketplace.

## Setup

1. Install the complete marketplace.

```bash
c-plugin skill add totto2727-org/agent
```

2. Select the installed skills required by your coding-agent workflow.

## API

### `totto2727`

Provides general-purpose utility skills.

### `totto2727-coding`

Provides reusable coding, testing, architecture-decision, and artifact-authoring guidance, including the canonical share-artifact specification.

### `external-search`

Provides skills for external web, documentation, and repository research.

### `symphony`

Provides the `linear`, `commit`, `pull`, `push`, and `land` skills used by [OpenAI Symphony workflows](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md).

Standalone skills from the source monorepo are intentionally not distributed; every public skill belongs to one of these four plugins.

## Development

For repository structure, manifest synchronization, documentation generation, and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
