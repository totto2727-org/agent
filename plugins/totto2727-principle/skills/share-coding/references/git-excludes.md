# Choose where a Git ignore pattern belongs

Commit a `.gitignore` rule only for an unwanted file that the project's supported workflow can generate in any contributor's environment. Build output, dependency directories, and caches written by the project's formatter or linter belong here. A file does not qualify merely because several contributors use the same editor, OS, or agent.

Put personal artifacts such as a scratch `tmp/`, private `.claude/` settings, and `PROFILE.local.md` in the repository's **local exclude file**, not its committed `.gitignore`. Use `git rev-parse --path-format=absolute --git-path info/exclude` to locate it. This also works in linked worktrees, where `.git` is a file and the local exclude file is shared by worktrees of the same repository. For root-only artifacts, use `/tmp/`, `/.claude/`, or `/PROFILE.local.md` rather than hiding matching paths throughout the project.

A contributor can also configure `core.excludesFile` for personal patterns they want across all repositories. This does not make those patterns project policy. Use `git check-ignore -v -- <path>` to identify the matching file and pattern. Ignore rules do not affect files already tracked by Git.

Source: [Git's ignore pattern sources and precedence](https://git-scm.com/docs/gitignore#_description).
