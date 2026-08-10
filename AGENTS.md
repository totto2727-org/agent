# Agent plugin marketplace

## Repository language

Use English for committed source, configuration, documentation, skill instructions, and commit messages. Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.

## Scope

- Keep distributable skills under `plugins/<plugin>/skills/<skill>/`.
- Do not add standalone skills under `.agents/skills/`.
- Keep `.claude-plugin/marketplace.json` as the marketplace source of truth.
- After changing marketplace or plugin metadata, run `c-plugin dev marketplace sync claude` and commit all generated Claude, Cursor, and Codex manifests together.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflow files; use environment-variable references.

## Validation

- Validate changed skills with the bundled skill validator when available.
- Validate plugin manifests and all marketplace source paths before handoff.
- Run `git diff --check` after edits.
