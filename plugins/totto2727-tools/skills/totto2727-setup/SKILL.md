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

4. The plan discovers every first-party `plugins/totto2727-*/skills/*/SKILL.md` at that commit. It installs the named skills with `vpx skills add` at exact commits. Both the default and `--required-only` install the [Visual Explainer renderer](https://github.com/nicobailon/visual-explainer) and [MoonBit Orientation](https://github.com/moonbitlang/skills). The default also installs the conditional guides listed in the [dependency manifest](dependencies.json). Add `--required-only` to both commands to skip those guides. Scope always applies to dependencies as well as first-party skills.

Setup never adopts an existing skill. It keeps same-source, same-pin entries; for other existing copies it stops before installing anything. Inspect the named skill and its origin. To reuse that copy without validating its pin or taking ownership, add `--keep NAME` explicitly. Do not resolve collisions by force or use `--all`, which can target unrelated harnesses. Repeating the same install does not rewrite already installed skills.

## Scope-safe removal

```sh
node "$SETUP" uninstall --scope project --agent universal
```

Use the same root and scope as the install. Setup reads `.agents/totto2727-setup.json` under that root and runs `vpx skills remove` only for names it added there whose lock entries and files still match their receipts. It leaves pre-existing, modified, and CLI-retained shared skills alone. Use `--keep NAME` to release ownership of a skill another workflow now needs. If no receipt exists, nothing is removed. Never reconstruct a lost receipt from the current lock or remove a whole skills directory. Do not run another installer against the same scope concurrently. If a previous process was interrupted, inspect its output and lock before retrying; do not delete a live process's `.lock` file.

A bootstrap installed separately in step 2 is deliberately not owned by the subsequent install. Leave it in place for the next setup. To remove it too, first verify that it is the bootstrap you explicitly installed, no other workflow needs it, and it has no user edits. Then run `vpx skills@1.9.0 remove totto2727-setup --agent universal --yes` in that project, or add `--global` for its global copy.

## What counts as a dependency

[The dependency manifest](dependencies.json) records the upstream sources and the skills that use them. Install only the named skills, not every sibling in their repositories. Installing a diagnostic guide does not install its linter or change a project's lint preset. The [Vite+ guide](https://viteplus.dev/guide/) is documentation, not another skill dependency.

[Orca](https://orca.dev/) and the [oo CLI](https://github.com/oomol-lab/oo-cli) supply their own skills automatically. They are outside this setup's install and removal scope. The [Monid reference](https://monid.ai/SKILL.md) does not replace the collection's identically named local guidance.
