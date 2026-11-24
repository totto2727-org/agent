# Agent plugins

## Development commands

### Execution rules

- Run commands from the repository root in the pinned environment, using `nix develop --command <command>` for non-interactive execution.
- Use `vp run`, `vp exec`, or `vpx` when a package runner is needed, not `npx` or `bunx`.

### Standard tasks

| Command                          | Scope                                  |
| -------------------------------- | -------------------------------------- |
| `nix develop --command vp check` | Formatting and validation used by CI.  |
| `git diff --check`               | Whitespace errors in the current diff. |

## Architecture

### Plugin ownership

- `plugins/<plugin>/plugin.json` is the sole manifest for each [Agent Plugins 1.0.0](https://agent-plugins.org/) package.
- Use the [official manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json). Do not add component lists or client-specific top-level fields to the manifest.
- Distributable skills belong under `plugins/<plugin>/skills/<skill>/`, with `SKILL.md` as the entry point. Clients discover only immediate child directories of `skills/`.
- Keep each package self-contained. Files supplied by a package must resolve within its plugin root.
- Distribute each plugin directly from its repository directory. Do not add catalogs, vendor manifests, or manifest-generation tasks.

### External documentation

- For first-party guidance, record the choice a maintainer must make and what would change it. Link the official documentation for syntax, commands, and API mechanics rather than restating it.
- Keep instructions for a single library's API, migrations, and diagnostics in a skill owned by that library. Keep stack comparisons and decisions about how multiple libraries work together here. Link to the owner's skill rather than copying its procedures.
- Do not distribute a local documentation copy when the upstream site publishes an official Agent Skill.
- Referencing skills must name the official skill, prefer its local installation, and provide a direct official-site fallback when the skill is unavailable.
- Use relative Markdown links to `SKILL.md` for skills in the same plugin, rather than bare invocation names such as `$skill-name`.
- For skills in another plugin, use relative links to sibling installed skills and provide canonical source links as fallbacks when those paths are unavailable.
- For skills owned outside `totto2727-org/agent`, link the skill name to its upstream entry point or official source repository, including when an installed copy is preferred. Keep documentation fallback links as well.

## Package-specific rules

- Use English for committed source, configuration, documentation, skill instructions, and commit messages. Use Japanese for pull request titles, descriptions, review discussions, and user handoffs.
- Keep skill guidance project-independent unless a skill explicitly targets one project.
- Keep secrets out of skills, templates, examples, and workflows; refer to environment variables instead.
- When changing skill metadata, check it against the Agent Skills specification, using a skill validator when available.
- When changing plugin metadata or skill locations, verify the standard manifest schema and affected reference paths.
- Decide whether history belongs by the document's purpose. Documents about the current state or how to act now must state current guidance and necessary concrete grounds. Retain history when recording or analyzing it is essential to the purpose, using [documentation-principles](plugins/totto2727-principle/skills/documentation-principles/SKILL.md#state-current-guidance-and-its-grounds).

## Skill maintenance

When changing `totto2727-setup`, check install and removal in a disposable home and project. Run `vp node --test tests/setup-ownership.test.mjs` for the removal boundaries; it must not touch the developer's installed skills. Verify external skill names and revisions in the bootstrap's `dependencies.json` when their sources change.

Use `totto2727-` for each plugin name and directory. Group implementation, stack, and tests by language. Keep cross-language principles separate from document-specific procedures. Keep skill names independent of plugin names.
Write a short description that identifies the user task. For distinct workflows, link to the relevant reference at the point of choice instead of requiring every reader to follow every procedure.
When a plugin or a skill moves, update the README map and check its links both in the repository and in the installed flat skills directory.

For pstack updates, follow the [upstream comparison and design record](docs/upstream-differences.md). Inspect upstream changes before editing the installed workflow or importing new skills. After a skill changes owner or references, run `node scripts/refresh-skill-map.mjs`, format `README.md`, and confirm that each installable skill is listed once.

## Task-specific documentation

- When maintaining README, AGENTS, or ADR guidance, use the matching slice linked from [share-artifact](plugins/totto2727-documentation/skills/share-artifact/SKILL.md).
- When changing skill metadata or activation scope, use the relevant format and triggering criteria in [skill-reviewer](plugins/totto2727-documentation/skills/skill-reviewer/SKILL.md).
