# Agent plugin marketplace

## Repository structure

```text
.agents/plugins/marketplace.json       Generated Codex marketplace manifest
.claude-plugin/marketplace.json        Authoring marketplace manifest
.cursor-plugin/marketplace.json        Generated Cursor marketplace manifest
.github/workflows/ci.yml               Vite+ validation workflow
plugins/<plugin>/.claude-plugin/        Plugin metadata
plugins/<plugin>/skills/                Distributed skill packages
flake.nix                               Reproducible Node.js and Vite+ environment
package.json                            Private workspace identity
vite.config.ts                          Repository formatting configuration
```

## Development commands

### Execution rules

- Run commands from the repository root.
- Enter the environment with `nix develop` before running Vite+ commands.
- Never use `npx` or `bunx`; use `vp run`, `vp exec`, or `vpx` when a package runner is needed.
- Keep `.claude-plugin/marketplace.json` as the authoring source for generated marketplace manifests.
- Run manifest synchronization after changing marketplace or plugin metadata and commit all generated outputs together.

### Standard tasks

- `nix develop` — Enter the pinned Node.js and Vite+ development environment.
- `vp check` — Run the repository formatting and validation checks used by CI.
- `vp run test` — Reproduce the share-artifact README sample, execute its MoonBit examples, and exercise every Setup branch under Jinja StrictUndefined.
- `c-plugin dev marketplace sync claude` — Regenerate Cursor and Codex marketplace manifests from the Claude manifest.
- `git diff --check` — Reject whitespace errors before handoff.

## Architecture

### Marketplace manifests

- `.claude-plugin/marketplace.json` owns the plugin catalog and local plugin source paths.
- `c-plugin dev marketplace sync claude` projects that catalog into the Cursor and Codex manifest formats.
- The three manifests must continue to expose the same four plugin identifiers.

### Plugin packages

- `plugins/<plugin>/.claude-plugin/plugin.json` defines distributable plugin metadata.
- `plugins/<plugin>/skills/<skill>/SKILL.md` is the entry point for each bundled skill.
- Standalone skills under `.agents/skills/` are intentionally excluded from this repository.

### External documentation skills

- Do not distribute a local documentation copy when the upstream site publishes an official Agent Skill.
- Referencing skills must name the official skill, prefer its local installation, and provide a direct official-site fallback for environments where the skill is unavailable.

## Development tools

- **c-plugin**: Synchronizes product manifests and installs marketplace skills.
- **Vite+**: Runs repository formatting and validation.
- **Nix flakes**: Pin Node.js, Vite+, and the development shell.

## Package-specific rules

- Use English for committed source, configuration, documentation, skill instructions, and commit messages.
- Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.
- Keep distributable skills under `plugins/<plugin>/skills/<skill>/`; do not add standalone skills under `.agents/skills/`.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflows; refer to environment variables instead.
- Validate changed skills with the bundled skill validator when available, and verify every manifest source path before handoff.

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
