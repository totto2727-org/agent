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
- General-purpose, coding, external-search, and Symphony workflow plugins
- Skills installed through `c-plugin` for project-local or global use

## Prerequisites

- **c-plugin**: Install `c-plugin` and make the command available on `PATH` before adding this marketplace.

## Setup

### Install persistently

Choose the scope where `c-plugin` should install and enable the marketplace's skills.

For the current project, add the marketplace:

```bash
c-plugin init
c-plugin skill add totto2727-org/agent
```

For all projects using the current home directory, add the marketplace globally:

```bash
c-plugin init --global
c-plugin skill add --global totto2727-org/agent
```

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

For repository structure, manifest synchronization, and validation commands, see [AGENTS.md](./AGENTS.md).

## License

No license is currently declared for this repository.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
