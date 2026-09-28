# Actionable example

## Applicability and context

Use `actionable-example` when a section teaches an API operation or customization.
Inspect the surrounding page and earlier examples for unchanged setup, but require the operation being taught to be demonstrated concretely.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or expected labels into blind Jev requests.

## Illustrative comparison

This is a self-contained JavaScript teaching example, not a real library API.
Assume these local definitions are already shown on the page:

```js
function Label({ text, prefix = "" }) {
  return `${prefix}${text}`;
}

function renderLabel(text, { component = Label } = {}) {
  return component({ text });
}
```

The task is to customize the label prefix without changing the underlying renderer.

**Problematic**

> Wrap `Label` to change its prefix, then pass your replacement as `component`.

```js
renderLabel("Ready", { component: PrefixedLabel });
```

**Improved**

```js
function PrefixedLabel(props) {
  return Label({ ...props, prefix: "Note: " });
}

renderLabel("Ready", { component: PrefixedLabel }); // "Note: Ready"
```

### Why this diagnosis

The problematic sample names a replacement but never defines the behavior the reader is trying to implement.
The improved sample shows the wrapper, changed option, and wiring into the consuming call.
Earlier context supplies unchanged setup, not the missing customization.
Adding code can reduce reader effort more than shortening the prose.

## Exceptions and false positives

- Navigation-only text, simple factual entries, and warnings do not need decorative examples.
- A focused example may rely on explicit earlier imports or setup; it need not repeat an entire application.
- Keep non-obvious constraints, prerequisites, trade-offs, and failure handling in prose when syntax cannot explain them.
- Do not require an unrelated customization example when the unit only teaches default usage.

## Inspect and fix a failure

1. Name the exact operation or changed behavior the reader must reproduce.
2. Locate existing setup and determine which step the target leaves to inference.
3. Add the smallest verified import, call, replacement definition, or configuration that demonstrates that step.
4. For customization, inspect both replacement behavior and its wiring; a placeholder name is not enough.
5. Validate real examples against the project's supported API and runtime separately from this writing judgment.

Do not copy this local teaching API into product documentation as though it were a public package contract.

## Abstention boundaries

- `not_applicable`: navigation, factual lookup text, or a warning does not teach an operation or customization.
- `insufficient_context`: the taught operation or referenced earlier setup is unavailable, preventing a completeness judgment.
- A visibly missing replacement definition is a failure when the supplied page confirms no earlier definition, not missing context.
