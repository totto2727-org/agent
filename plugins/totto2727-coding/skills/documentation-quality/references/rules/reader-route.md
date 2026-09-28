# Reader route

## Applicability and context

Use `reader-route` at complete-page scope to assess the route through a stated reader task.
Supply the supported default path and relevant destination excerpts, especially when prerequisites are delegated to another guide.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or historical labels into blind Jev requests.

## Illustrative comparison

These simplified page outlines are illustrative adaptations, not real commands or repository instructions.
Assume the public generator provides a runnable project and the supplied host guide documents its prerequisites.

**Problematic**

```text
Getting started
1. Install the runtimes and deployment tools for every supported host.
2. Clone the framework repository and find its examples directory.
3. Compare the fixture application with the generated starter.
4. Choose one of several overlapping setup introductions.
```

**Improved**

```text
Getting started
1. Create a project with the supported public generator.
2. Run the generated project using the documented default command.
3. For another host, choose it in the Platforms overview.

Platforms overview -> Selected host guide -> Host prerequisites and setup
```

### Why this diagnosis

The improved route leads through the supported default without requiring knowledge of repository fixtures.
Alternative selection belongs in an overview; the selected host guide owns its runtime and deployment prerequisites.
This outline illustrates ordering only; an actual execution guide must supply its verified commands and destinations.
Moving prerequisites is an improvement only if the supplied destination evidence confirms readers still encounter them before use.

## Exceptions and false positives

- A contributor or fixture-maintenance guide may correctly begin with cloning the repository.
- If no public generator exists or supports the task, do not invent one or reject the supported manual route.
- A one-sentence link to the platform overview can be a complete navigation unit.
- Execution steps should link directly to the needed task or example rather than force another round of route selection.
- Require earlier tutorial state only when the current task actually depends on it, not because both pages edit the same example.
- Task-local prerequisites can be worth repeating when readers arrive directly at a host guide.

## Inspect and fix a failure

1. Trace the page from entry to the stated outcome using its supported public default.
2. Identify detours into repository examples, competing introductions, or optional customization before the default works.
3. Verify each delegated prerequisite in the supplied destination, not merely its link label.
4. Keep route selection in the overview and host-specific execution requirements in the selected guide.
5. Check links and exercise real commands separately; coherent prose does not establish an executable route.

## Abstention boundaries

- `not_applicable`: the page is a factual record with no task route or alternative-selection responsibility.
- `insufficient_context`: only a fragment is supplied, the supported default is unknown, or a decisive linked prerequisite is unseen.
- Do not assume a missing destination contains the prerequisite or classify its unseen contents as a proven failure.

## Historical grounding

See [PR #15: simplify the route to a running project](../history-evidence.md#pr-15-simplify-the-route-to-a-running-project), particularly the generator route, Platforms link, and host-local prerequisites.
The [rule catalog](../rules.md) notes that the section-pair corpus does not calibrate this page rule; its history is interpretive evidence, not measured classification accuracy.
