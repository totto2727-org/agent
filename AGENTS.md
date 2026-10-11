# Agent plugins

## Development commands

### Execution rules

- Run commands from the repository root in the pinned environment, using `nix develop --command <command>` for non-interactive execution.
- Use `vp run`, `vp exec`, or `vpx` when a package runner is needed, not `npx` or `bunx`.

### Standard tasks

| Command                                      | Scope                                                 |
| -------------------------------------------- | ----------------------------------------------------- |
| `nix develop --command vp check`             | Formatting and validation used by CI.                 |
| `nix develop --command vp run check:plugins` | Validate standard manifests and packaged skill paths. |
| `git diff --check`                           | Whitespace errors in the current diff.                |

## Architecture

### Plugin ownership

- `plugins/<plugin>/plugin.json` is the sole manifest for each [Agent Plugins 1.0.0](https://agent-plugins.org/) package.
- Use the [official manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json). Do not add component lists or client-specific top-level fields to the manifest.
- Distributable skills belong under `plugins/<plugin>/skills/<skill>/`, with `SKILL.md` as the entry point. Clients discover only immediate child directories of `skills/`.
- Keep each package self-contained. Files supplied by a package must resolve within its plugin root.
- Distribute each plugin directly from its repository directory. Do not add catalogs, vendor manifests, or manifest-generation tasks.

### External documentation

- Do not distribute a local documentation copy when the upstream site publishes an official Agent Skill.
- Referencing skills must name the official skill, prefer its local installation, and provide a direct official-site fallback when the skill is unavailable.
- Use relative Markdown links to `SKILL.md` for skills owned by this repository, rather than bare invocation names such as `$skill-name`.
- For skills owned outside `totto2727-org/agent`, link the skill name to its upstream entry point or official source repository, including when an installed copy is preferred. Keep documentation fallback links as well.

## Package-specific rules

- Use English for committed source, configuration, documentation, skill instructions, and commit messages. Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflows; refer to environment variables instead.
- When changing skill metadata, check it against the Agent Skills specification, using a skill validator when available.
- When changing plugin metadata or skill locations, run `vp run check:plugins` and verify affected reference paths.
- Decide whether history belongs by the document's purpose. Documents about the current state or how to act now must state current guidance and necessary concrete grounds. Retain history when recording or analyzing it is essential to the purpose, using [documentation-principles](plugins/totto2727-coding/skills/documentation-principles/SKILL.md#state-current-guidance-and-its-grounds).

## Task-specific documentation

- When maintaining README, AGENTS, or ADR guidance, use the matching slice linked from [share-artifact](plugins/totto2727-coding/skills/share-artifact/SKILL.md).
- When changing skill metadata or activation scope, use the relevant format and triggering criteria in [skill-reviewer](plugins/totto2727-coding/skills/skill-reviewer/SKILL.md).
