---
name: recall
description: Reconstruct recent work across related sessions, repository state, and shared records. Use for a current-state brief before resuming a topic.
---

# Recall

**Before you start or resume work, you rebuild the user's recent working context and hand back a tight capsule of where things stand now and what to do next.**

Keep it tight and on-topic. Read only what the in-scope threads need, then stop.

Your context lives in two records. Your own chat history holds what you did and decided. The shared record holds everything that happened around the same code under other names: the symptoms users keep reporting, the fixes that shipped and got reverted, the errors still firing in prod. That second record lives in source control, the issue tracker, chat and issue channels, long-form docs, and error tracking. A feature with a long bug tail keeps most of its story there, so don't reconstruct it from your transcripts alone.

Use only workspace-scoped history actually available via [Orca runtime](../poteto-mode/references/orca.md). When history is unavailable, work from the supplied handoff and accessible records and state what is missing.

1. Classify, then route. One specific prior chat to resume is the [session pickup playbook](../poteto-mode/playbooks/session-pickup.md), not this. Turning habits into a durable skill is [automate-me](../automate-me/SKILL.md). A human-readable summary of your work is a different task. Recall loads working context across recent chats before you act. If the user already gave you a full state capsule (paths, branch, the change), use it and skip the mining.
2. Lock the scope before searching. Pin the window ("recent" is a real range, default the last 7 days), the topic if named, and the workspace (default the active one. Never read another project's transcripts without being asked). State the scope back. Never quietly turn "all" into "recent N".
3. Fan out across your chat history. For a large corpus, assign distinct date or topic slices to available Orca readers. Tell every subagent to order candidates by available activity timestamps and never by UUID name, grep the topic first and then read only the matching chats and only their relevant regions, and skip the current chat plus obvious noise (subagent, eval, and test chats). Each returns the same schema, one block per chat: topic, the user's goal, decisions, open threads, struggles and corrections, and artifacts (PRs, tickets, branches), each citing the session identifier. For one or two chats, skip the fan-out and search directly. The raw transcripts stay in the subagents. The main thread gets only their findings. Use the active session’s permitted models.
4. Sweep the shared record whenever the topic names a feature, file, subsystem, area, or bug. This is the default, not a judgment call, and "my work on X" does not exempt it. Search only relevant sources the user has authorized through available read-only access. Ask "what's the current state, what's been tried and didn't hold, and what are users still reporting". Run them in parallel with the chat-history mining. Null results are findings. Skip an unavailable source and say so. Fold what comes back into the brief. Skip this step only for pure activity recall with no named target ("what did I do this week"), where your own history and live state are the entire answer.
5. Verify against live state. Take the PRs, branches, and tickets that the mining and the sweep surfaced and check them with `git` and `gh`. When the answer hinges on what an agent actually did (the tools it ran, files it read, errors it hit), cite the available activity record or state what could not be verified.
6. Write the brief to the contract below. Group by thread. Stay on the named topic.

## Output contract

Lead with the capsule, then the thread status, then the problems, then the next move. Deeper detail goes below or gets cut.

- **Capsule.** At most 5 bullets. What this work is and where it stands overall.
- **Threads.** One line each, prefixed with exactly one status tag: `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`, `[reverted #N]`, or `[planned, not started]`. A thread with no tag is not done yet, so tag it.
- **Problems.** At most 5, the recurring ones. Include the symptoms users keep reporting and any fix that shipped and was reverted, so the next attempt starts where the last one failed.
- **Next move.** The single most useful next action, concrete.

An adjacent feature or ticket stays out unless it blocks this one. When the capsule and thread lines outgrow a screen, cut detail before you cut threads. Write the brief through the [unslop](../unslop/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-documentation/skills/unslop/SKILL.md)), cite chat findings by session identifier and shared-record findings by their source (PR #, ticket ID, chat permalink, error-tracker issue), and sanitize private context before any public output.

**Reply:** the brief, to the contract above.
