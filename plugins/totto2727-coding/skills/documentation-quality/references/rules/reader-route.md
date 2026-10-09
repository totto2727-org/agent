# Reader route

Rule: `reader-route`.
Judge the route visible within one page, using its declared reader task and required structure.
Do not inspect or judge another page as part of this scripted rule.

## Finding

A runbook states an instruction before its locally documented prerequisites:

```text
1. Restore the snapshot.
2. Check that the target is empty and the snapshot is compatible.
3. Obtain write access if the command fails.
```

Correct the content within the required structure so the prerequisites precede the operation:

```text
1. Check that the target is empty and the snapshot is compatible.
2. Obtain write access.
3. Restore the snapshot.
```

This comparison assumes the supplied page establishes those prerequisites.
It does not invent a restoration contract or verify commands.

## Boundaries

Clearly describe onward guidance instead of sending the reader through an unexplained broad index.
A link label can be judged locally; its destination content and availability cannot.
Reference pages can support selective lookup rather than a single tutorial route.
Keep legitimate environment choices and do not invent a default.
Preserve fixed template headings and order; correct their content instead of demanding another layout.

Return `not_applicable` for an isolated lookup entry with no ordering responsibility.
Return `insufficient_context` when a decisive prerequisite or destination is unavailable.
Do not assume unseen content is adequate or defective.
Check working links, destination completeness, canonical ownership, and cross-page duplication separately outside this evaluator.
