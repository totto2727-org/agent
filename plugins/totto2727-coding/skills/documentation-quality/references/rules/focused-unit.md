# Focused unit

## Applicability and context

Use `focused-unit` for a coherent section or paragraph group with a stated reader task.
Read `evidence.document.purpose`, its heading, and neighboring explanation before deciding what is extraneous.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or historical labels into blind Jev requests.

## Illustrative comparison

These project-independent adaptations assume a basic setup task with a required compatibility setting.
They do not prescribe a real host configuration or quote a historical guide.

**Problematic**

> This section explains how to start the project.
> Open the generated project and keep its required runtime compatibility setting enabled.
> Earlier templates contained a larger application.
> You can also add a custom request label and read it inside a request handler.

**Improved**

> Open the generated project and keep its required runtime compatibility setting enabled.
> For request labels, see the customization guide.

### Why this diagnosis

The useful prerequisite remains, while a generic introduction, template history, and an optional adjacent tutorial disappear.
Using the same platform does not make request-label customization necessary for basic setup.
A direct next-step link can preserve discoverability without teaching a second task here.
The short improved paragraph needs neither an introduction nor a summary to be complete.

## Exceptions and false positives

- Preserve requirements, constraints, failure conditions, and code explanations needed for the stated task.
- Keep code with its prerequisites and explanation, and warnings with the behavior they qualify.
- Prose that explains non-obvious behavior is not redundant merely because it follows code.
- Remove self-explanatory code narration, repeated starting instructions, filler transitions, and summaries only when they add no reader value.
- Mention absent behavior when it prevents a likely mistake, such as expecting a demonstration form to persist submissions.
- Do not inventory every absent binding, port, or optional feature when a conditional next action would suffice.
- A maintainer's task can legitimately include historical alternatives or implementation details.

## Inspect and fix a failure

1. State the unit's reader question and map each part to a necessary answer or decision.
2. Distinguish an optional adjacent task from a prerequisite before deleting anything.
3. Remove repetition with no added value; move independent tasks to focused sections or guides.
4. Preserve useful direct links, required settings, and explanations that code cannot supply alone.
5. Reread with page context to ensure the edit did not fragment one task across disconnected pieces.

Prefer descriptive headings and direct wording, not a mechanical sentence, paragraph, or word-count quota.

## Abstention boundaries

- `not_applicable`: the selected material is not a meaningful prose or instructional unit, such as a raw index of generated symbols.
- `insufficient_context`: the reader task or neighboring material needed to judge relevance is missing.
- Brevity is neither failure nor inapplicability; a one-sentence navigation unit can pass.

## Historical grounding

See [PR #15: simplify the route to a running project](../history-evidence.md#pr-15-simplify-the-route-to-a-running-project) for repeated introductions and optional binding digressions.
See [PR #17: explain rendering as a consumer contract](../history-evidence.md#pr-17-explain-rendering-as-a-consumer-contract) for retained asset constraints and removed optional detours or redundant component prose.
The [corpus](../history-corpus.json) includes short positive controls; they are not length templates.
