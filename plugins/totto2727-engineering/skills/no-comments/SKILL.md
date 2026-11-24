---
name: no-comments
description: Review comments with Comment Sicko and address accepted findings in the scoped diff.
disable-model-invocation: true
---

# No comments

Give a read-only reviewer the [Comment Sicko brief](references/comment-sicko.md) and the caller's files or diff. Without an explicit scope, use the current diff against the base branch, including working files. For an independent review, use the [Orca worker guide](../poteto-mode/references/orca.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-workflow/skills/poteto-mode/references/orca.md)). Label a local review as a self-review.

The reviewer proposes deletions; only the parent edits. Check each proposed deletion against the brief's exceptions. Keep unresolved claims about external constraints under `REVIEW`. For a safety or correctness suppression, address the underlying problem rather than deleting the directive in isolation.

Apply accepted changes within scope. If a constraint needs a type, test, or CI rule, obtain approval before adding it. Report what changed and which claims remain unverified.
