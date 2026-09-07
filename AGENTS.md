# Agent plugin marketplace

## Development commands

### Execution rules

- Run commands from the repository root in the pinned environment, using `nix develop --command <command>` for non-interactive execution.
- Use `vp run`, `vp exec`, or `vpx` when a package runner is needed, not `npx` or `bunx`.

### Standard tasks

| Command                                | Scope                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `nix develop --command vp check`       | Formatting and validation used by CI.                                                            |
| `nix develop --command vp run test`    | README and AGENTS template rendering contracts, including executable MoonBit README examples.    |
| `c-plugin dev marketplace sync claude` | Regenerate Cursor and Codex marketplace manifests after changing marketplace or plugin metadata. |
| `git diff --check`                     | Whitespace errors in the current diff.                                                           |

## Architecture

### Marketplace ownership

- `.claude-plugin/marketplace.json` is the authoring source. Synchronization generates `.agents/plugins/marketplace.json` and `.cursor-plugin/marketplace.json`; commit the generated outputs with metadata changes.
- All three manifests must expose the same four plugin identifiers and valid local plugin source paths.
- `plugins/<plugin>/.claude-plugin/plugin.json` defines plugin metadata. Distributable skills belong under `plugins/<plugin>/skills/<skill>/`, with `SKILL.md` as the entry point; do not add standalone skills under `.agents/skills/`.

### External documentation

- Do not distribute a local documentation copy when the upstream site publishes an official Agent Skill.
- Referencing skills must name the official skill, prefer its local installation, and provide a direct official-site fallback when the skill is unavailable.

## Package-specific rules

- Use English for committed source, configuration, documentation, skill instructions, and commit messages. Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflows; refer to environment variables instead.
- Validate changed skills with the bundled skill validator when available, and verify every manifest source path before handoff.

## Task-specific documentation

- When maintaining README, AGENTS, or ADR contracts, use the matching slice linked from [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md).
- When changing skill metadata or activation scope, use the relevant format and triggering criteria in [skill-reviewer](plugins/totto2727/skills/skill-reviewer/SKILL.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
