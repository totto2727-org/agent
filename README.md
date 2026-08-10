# Agent plugins

`totto2727-org/agent` is a multi-product plugin marketplace for Claude Code, Cursor, and Codex.

## Plugins

- `totto2727`: general-purpose utility skills.
- `totto2727-coding`: reusable coding, testing, ADR, and artifact guidance.
- `external-search`: skills for external web, documentation, and repository search.
- `symphony`: the `linear`, `commit`, `pull`, `push`, and `land` skills referenced by [OpenAI Symphony's workflow](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md).

Standalone skills from the source monorepo are intentionally not included. Every distributed skill belongs to one of the plugins above.

## Layout

```text
.
├── .agents/plugins/marketplace.json
├── .claude-plugin/marketplace.json
├── .cursor-plugin/marketplace.json
├── mbt/scripts/
└── plugins/
```

The Claude marketplace is the authoring source. Regenerate the Cursor and Codex manifests after changing marketplace or plugin metadata:

```bash
c-plugin dev marketplace sync claude
```

## Install

Install the marketplace skills with `c-plugin`:

```bash
c-plugin skill add totto2727-org/agent
```

## Documentation generators

Run the generators from the repository root with MoonBit installed:

```bash
moon run mbt/scripts/generate-docs-components-build.mbtx --target native
moon run mbt/scripts/generate-docs-moonbit.mbtx --target native
```

The scripts update generated skills under `plugins/totto2727-coding/skills/`.
