# Consequential limit

## Applicability and context

Use `consequential-limit` when the target discusses a limitation that can affect the reader's intended use.
Establish the affected feature, observable consequence, and known remedy or alternative from reliable context.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or expected labels into blind Jev requests.

## Illustrative comparison

These adaptations assume a renderer with browser-only default diagrams and a verified server-renderable replacement mechanism.
They are not quotations or assertions about an unspecified product's API.

**Problematic**

```markdown
> [!NOTE]
> Diagrams use a client wrapper; the surrounding document remains server-renderable.
```

**Improved**

```markdown
> [!WARNING]
> Default diagrams require browser JavaScript.
> Server output contains diagram placeholders, not completed diagrams.
> For completed server output, provide a server-renderable diagram replacement through the renderer's component configuration.
```

### Why this diagnosis

The earlier note requires the reader to infer what a client wrapper means for the output they need.
The warning states the affected behavior, what the reader will observe, and the available next action in the target itself.
It does not incorrectly extend a default diagram limitation to all document rendering.
A remedy names an available mechanism; its full implementation can live in a linked customization example.

## Exceptions and false positives

- Require a remedy only when one is known and available; do not invent a workaround to satisfy the rubric.
- If evidence establishes that no remedy exists, state the limitation honestly without promising one.
- A warning need not contain a complete runnable replacement; `actionable-example` evaluates a section that teaches its implementation.
- Use GitHub Alerts by default where supported, or the repository's renderer-compatible equivalent.
- GitHub Alerts are a GitHub extension, not part of the formal GFM specification.
- Choose severity by reader impact, not internal complexity; ordinary explanation should remain ordinary prose.
- Keep the warning close to the affected behavior, not in a remote implementation note.

## Inspect and fix a failure

1. Identify the affected feature precisely, including whether only its default implementation is limited.
2. Verify the observable outcome and known remedy against source or supported behavior.
3. Make each applicable element explicit in the target; another passage cannot rescue an incomplete warning.
4. Replace vague internal boundaries with consumer consequences and a concrete available action.
5. Check prominence and scope without turning every technical caveat into an alarming callout.

## Abstention boundaries

- `not_applicable`: no consequential limitation is discussed in the target.
- `insufficient_context`: the supplied evidence cannot establish the affected behavior or whether an asserted remedy is available.
- A known limitation with a missing consequence or known remedy is a failure, not a reason to abstain.

The rubric's “ALL” wording means all applicable elements: its pass condition requires a concrete remedy **when available**, not an invented one.
