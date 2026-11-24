---
name: totto2727-setup
description: Install or uninstall the totto2727 skill collection and its external skill dependencies in one explicit project or user scope. Use for collection setup, dependency inventory, or safe removal, not for configuring Orca itself.
compatibility: Requires Git, Node.js 22.20 or later, Vite+ vpx, and read access to the selected GitHub repositories.
---

# Manage the skill collection

## Bootstrap and install

1. Confirm the target project root or global user scope, the first-party branch, tag, or commit, and the harness. Do not infer global scope from where this skill is installed. Use `universal` for the shared `.agents/skills` location, including Jcode, or `codex` for the Codex CLI target. This workflow does not install into private harness directories or change agent settings.
2. If this skill is not installed, review the selected source and install **only the bootstrap**. From the intended project root, run the following command with `REF` set to the selected Git ref. For global scope, add `--global`. Do not replace an existing unrelated or locally modified bootstrap; inspect it first.

   ```sh
   vpx skills@1.9.0 add "totto2727-org/agent#$REF" --full-depth --skill totto2727-setup --agent universal --copy --yes
   ```

3. Set `SETUP` to the installed `setup.mjs` next to this file. For a project copy it is `.agents/skills/totto2727-setup/setup.mjs`; for a global copy it is `$HOME/.agents/skills/totto2727-setup/setup.mjs`. Review the plan, then run the same selection with `install`:

   ```sh
   node "$SETUP" plan --scope project --agent universal
   node "$SETUP" install --scope project --agent universal
   ```

   Use `--scope global` for user-wide installation. Omit `--ref` to use the exact first-party commit recorded for the installed bootstrap. To select a different trusted branch, tag, or commit explicitly, pass `--ref "$REF"` to both commands. Use the bootstrap and dependency manifest from the revision you intend to install. `plan` resolves the ref without writing skill or lock files.

4. The plan discovers every first-party `plugins/totto2727-*/skills/*/SKILL.md` at that commit. It installs the named skills with `vpx skills add` at exact commits. The default includes all [pinned external skill dependencies](dependencies.json), including guides used only by particular workflows. Add `--required-only` to plan and install to omit those conditional guides. Scope always applies to dependencies as well as first-party skills.

Setup never adopts an existing skill. It keeps same-source, same-pin entries; for other existing copies it stops before installing anything. Inspect the named skill and its origin. To reuse that copy without validating its pin or taking ownership, add `--keep NAME` explicitly. Do not resolve collisions by force or use `--all`, which can target unrelated harnesses. Repeating the same install does not rewrite already installed skills.

## Scope-safe removal

```sh
node "$SETUP" uninstall --scope project --agent universal
```

Use the same root and scope as the install. Setup reads `.agents/totto2727-setup.json` under that root and runs `vpx skills remove` only for names it added there whose lock entries and files still match their receipts. It leaves pre-existing, modified, and CLI-retained shared skills alone. Use `--keep NAME` to release ownership of a skill another workflow now needs. If no receipt exists, nothing is removed. Never reconstruct a lost receipt from the current lock or remove a whole skills directory. Do not run another installer against the same scope concurrently. If a previous process was interrupted, inspect its output and lock before retrying; do not delete a live process's `.lock` file.

A bootstrap installed separately in step 2 is deliberately not owned by the subsequent install. Leave it in place for the next setup. To remove it too, first verify that it is the bootstrap you explicitly installed, no other workflow needs it, and it has no user edits. Then run `vpx skills@1.9.0 remove totto2727-setup --agent universal --yes` in that project, or add `--global` for its global copy.

## Host-provided OpenConnector skills

Prefer the installed official [oo skill](https://github.com/oomol-lab/oo-cli/tree/main/contrib/skills/shared/oo). If it already exists in the selected scope or is shared by the harness, use it without taking ownership. If absent and needed, use the configured `oo` executable to render its own skill. The upstream Git files are templates, not installable skill frontmatter. If the executable is unavailable, use the [official CLI reference](https://github.com/oomol-lab/oo-cli/blob/main/docs/commands.md); do not install a replacement CLI or bypass authentication.

Choose a **new, dedicated local source directory** that can remain available for as long as the selected scope's local lock references it. Set `EXPORT` to its absolute path. Confirm the `oo` skill and its lock entry are absent in the selected target before running these commands. Do not commit a machine-specific source path to a shared lock. To use this export only on one machine, prefer global scope.

```sh
oo skills install --skill oo --out-dir "$EXPORT" --agent-format universal
vpx skills@1.9.0 add "$EXPORT/oo" --skill oo --agent universal --copy --yes
```

For user scope add `--global` to the `vpx` command. Only for OOMOL skill discovery or installation repair, repeat with the official [oo-find-skills](https://github.com/oomol-lab/oo-cli/tree/main/contrib/skills/shared/oo-find-skills) name and directory. Do not install publishing, authoring, connector suggestions, or unrelated integrations automatically. Collection uninstall deliberately leaves host-managed skills alone. To undo an explicit export install, verify its lock source, compare its installed files with the retained export, and check that no other workflow needs it. Run `vpx skills@1.9.0 remove oo --agent universal --yes` in the original project (or add `--global` for its global copy). Remove an owned export only after confirming no scope still references it.

## What counts as a dependency

[The dependency manifest](dependencies.json) records the upstream repositories, exact commits, skill names, and consuming workflows. It is an audited transitive closure, not a request to install every sibling in those repositories. Runtime programs, npm dependencies, API credentials, and third-party modules are not skills. In particular, the collection already ships its own `oxlint` guidance; `@totto2727/oxlint`, `oxlint`, and `oxlint-tsgolint` are runtime packages, not additional skills. The [Vite+ guide](https://viteplus.dev/guide/) is documentation, not a reason to import maintainer skills.

For [Orca](https://orca.dev/), use the installed version-matched `orca-cli` and `orchestration` guides for actual execution. Do not install all of Orca's integrations. Keep the installed OpenConnector and Monid executable wrappers unchanged. An absent CLI, authentication, or unavailable provider remains an operational prerequisite; a successful skill install does not demonstrate readiness. The [Monid reference](https://monid.ai/SKILL.md) does not replace the collection's identically named local guidance.
