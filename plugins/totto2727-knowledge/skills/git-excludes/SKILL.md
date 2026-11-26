---
name: git-excludes
description: Decide whether an ignore pattern belongs in a shared .gitignore, a repository's local excludes, or a personal Git configuration.
---

# Git excludes

| Who produces the file?                                     | Where the rule belongs                                                                                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any contributor running the project's supported workflow   | Commit a `.gitignore` rule for unwanted outputs such as build artifacts or formatter caches.                                                                                       |
| One contributor's tools or scratch work in this repository | Use the local `info/exclude` file. Examples are `/tmp/`, `/.claude/`, and `/PROFILE.local.md`. Several contributors using the same editor does not make its files project outputs. |
| One contributor across their repositories                  | Use that person's `core.excludesFile`. Do not copy it into project policy.                                                                                                         |

A linked worktree's `.git` is a file. Locate the shared local exclude file with `git rev-parse --path-format=absolute --git-path info/exclude`. Anchor root-only artifacts with `/` so an unrelated nested directory remains visible.

To explain a result, run `git check-ignore -v -- <path>` and inspect the matching file and pattern. Ignore rules do not untrack a committed file. See [Git's precedence rules](https://git-scm.com/docs/gitignore#_description).
