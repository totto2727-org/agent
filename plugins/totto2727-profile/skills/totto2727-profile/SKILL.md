---
name: totto2727-profile
description: Resolve totto2727's personal Git identity, pull request destinations, workspace conventions, and delivery preferences.
---

# Personal profile

Use these defaults only for totto2727 or when explicitly selected. General-purpose skills do not assume this identity.

## Resolve the active profile

For the target repository, get its worktree root with `git -C <target-directory> rev-parse --show-toplevel`. If `PROFILE.local.md` exists at that root, read it before applying the defaults below. Each local setting overrides the corresponding default; omitted settings retain their defaults. Repeat this resolution when switching repositories. Do not search parent repositories, sibling worktrees, or the home directory. Outside a Git worktree, use the selected personal profile without a repository override.

An explicit user instruction or a binding repository instruction takes precedence over personal defaults. A profile sets preferences, not permissions to publish or disclose information. Never put credentials in a profile or copy its private contents into a commit, PR, or report. The local file is optional; do not create one just to restate the defaults.

## Workflow choices

Prefer independent, verifiable assignments when parallel work saves time. Aim for about five minutes per assignment. Around ten minutes, check progress and split or redirect stalled work. Keep long-running checks owned while other safe work continues.

Use the installed task skill if available. For project and issue management, use [Projektor](../projektor/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-external-information/skills/projektor/SKILL.md)). For connected services and GitHub access, use [OpenConnector](../open-connector/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-external-information/skills/open-connector/SKILL.md)). Use [Web search](../web-search/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-external-information/skills/web-search/SKILL.md)) for web research and [Doc search](../doc-search/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-external-information/skills/doc-search/SKILL.md)) for library documentation.

Use pstack for document analysis and drafting. Use its recap, technical writing, or formal statechart workflow according to the requested output. For a complex figure that neither pstack nor Visual Explainer can produce, use the installed [Diagram Design](https://github.com/cathrynlavery/diagram-design) skill if available, otherwise consult its official repository. Match the destination theme and embed the figure in the deliverable.

## Personal defaults

For a Japanese HTML handoff, use [visual-explainer-ja](../visual-explainer-ja/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-documentation/skills/visual-explainer-ja/SKILL.md)).

| Decision         | Default                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git identity     | Use `totto2727-ai <2000.0727.hayato+ai@gmail.com>` for both author and committer. Do not change shared Git configuration to set one commit's identity.                                                                                                                            |
| GitHub access    | Use the configured OOMOL Proxy connection for GitHub, including `gh`. The connection determines the authenticated GitHub account; Git author metadata does not.                                                                                                                   |
| PR destination   | Open PRs only in repositories owned by `totto2727`, `totto2727-*`, or `creastudio`. For a fork, target the user's fork, not upstream. Respect the requested base; otherwise use `main` when available, then the repository default.                                               |
| Delivery         | Unless the request is local-only, take each validated implementation through a PR as soon as it is independently ready. Do not merge merely because a PR exists.                                                                                                                  |
| Workspace files  | Put project deliverables in the repository and task scratch files under `<worktree-root>/tmp/`. Commit durable material, not one-off reports, working logs, or rendered personal handoffs.                                                                                        |
| Documents        | Write committed documents in English Markdown, one sentence per line without soft wrapping. For personal reports, default to Japanese standalone HTML using the installed Visual Explainer Japanese theme. Preserve evidence and caveats; respect an explicitly requested format. |
| Fork maintenance | Keep a linked `docs/upstream-differences.md` unless the project specifies another location. Record the exact upstream commit, retained differences, their purpose, affected areas, and operational impact. Update it with the corresponding changes.                              |
| Work style       | Use pstack for substantial work. Keep safe work moving when answering a question; pause for a real blocker, requested stop, or required authorization.                                                                                                                            |
