# agent-marketplace

## Repository structure

```text
plugins/  Distributable plugins
```

## Development commands

### Execution rules

- Run commands from the repository root.
- Enter the pinned environment with `nix develop` before running Vite+ commands.
- Keep secrets out of distributed skills and examples.

### Standard tasks

- `vp check` — Run repository formatting and validation checks.
- `vp run test` — Validate artifact templates and executable README examples.

## Architecture

### Plugins

- Each plugin owns its distributable skills.

### Skills

- Keep guidance project-independent.

## Development tools

- **Vite+**: Runs repository tasks.

## Package-specific rules

- Package-specific AGENTS files supplement the root document.

## Task-specific documentation

- When changing README artifact guidance: [README specification](./plugins/totto2727-coding/skills/share-artifact/readme/spec.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
