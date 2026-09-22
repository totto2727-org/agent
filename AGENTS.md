# Agent plugin marketplace

## Development commands

### Execution rules

- Run commands from the repository root in the pinned environment, using `nix develop --command <command>` for non-interactive execution.
- Use `vp run`, `vp exec`, or `vpx` when a package runner is needed, not `npx` or `bunx`.

### Standard tasks

| Command                                | Scope                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `nix develop --command vp check`       | Formatting and validation used by CI.                                                            |
| `c-plugin dev marketplace sync claude` | Regenerate Cursor and Codex marketplace manifests after changing marketplace or plugin metadata. |
| `git diff --check`                     | Whitespace errors in the current diff.                                                           |

## Architecture

### Marketplace ownership

- `.claude-plugin/marketplace.json` is the authoring source. Synchronization generates `.agents/plugins/marketplace.json` and `.cursor-plugin/marketplace.json`; commit the generated outputs with metadata changes.
- All three manifests must expose the same plugin identifiers and valid local plugin source paths.
- `plugins/<plugin>/.claude-plugin/plugin.json` defines plugin metadata. Distributable skills belong under `plugins/<plugin>/skills/<skill>/`, with `SKILL.md` as the entry point; do not add standalone skills under `.agents/skills/`.

### External documentation

- Do not distribute a local documentation copy when the upstream site publishes an official Agent Skill.
- Referencing skills must name the official skill, prefer its local installation, and provide a direct official-site fallback when the skill is unavailable.

## Package-specific rules

- Use English for committed source, configuration, documentation, skill instructions, and commit messages. Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflows; refer to environment variables instead.
- When changing skill metadata, check it against the Agent Skills specification, using a skill validator when available.
- When changing marketplace metadata or skill locations, verify generated manifests and affected reference paths.
- Jinja templates illustrate document structure; do not require scripted generation, fixed render inputs, or byte-identical samples.

## Task-specific documentation

- When maintaining README, AGENTS, or ADR guidance, use the matching slice linked from [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md).
- When changing skill metadata or activation scope, use the relevant format and triggering criteria in [skill-reviewer](plugins/totto2727/skills/skill-reviewer/SKILL.md).
