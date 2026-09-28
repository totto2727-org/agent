# Consumer contract

## Applicability and context

Use `consumer-contract` for a section whose audience and task are known.
Read its heading and surrounding page to identify what the reader must import, configure, run, or observe.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or historical labels into blind Jev requests.

## Illustrative comparison

These project-independent adaptations are not quotations or claims about a particular package.
Assume the task is to configure a collection of local documents and handle missing entries.

**Problematic**

> Supply relative document paths and check for a missing entry before parsing.
> The resolver normalizes the registry through three internal modules; the previous example now lives in the integration fixtures.

**Improved**

> Supply relative document paths and check for a missing entry before parsing.

### Why this diagnosis

The retained sentence defines valid input and necessary failure handling.
The removed sentence explains repository maintenance without changing a consumer decision.
A useful first sentence does not cancel an irrelevant second sentence.
The improvement is not that the passage became short, but that each remaining claim serves the task.

## Exceptions and false positives

- Public imports, valid input constraints, required host settings, defaults, and observable failures are useful contract details.
- An internal detail belongs when it changes a reader's decision, such as a required runtime compatibility setting.
- Maintainer guides, architecture explanations, and migration guides may need internals or history for their stated task.
- Do not remove a lookup's result or missing-entry handling merely because the code already names the operation.
- A change in API support or implementation behavior is not itself evidence of a writing failure.

## Inspect and fix a failure

1. Identify the exact distracting sentence and the reader decision it supposedly supports.
2. Verify behavior against the relevant source or public contract before simplifying technical claims.
3. Replace internal mechanics with the action or observable consequence when one exists.
4. Keep required settings and constraints; move maintenance-only history to its appropriate home if it has lasting value.
5. Reread the complete unit, including code and neighboring explanation, to ensure no required context was removed.

Do not substitute a generic introduction or a longer explanation for a complete short contract.

## Abstention boundaries

- `not_applicable`: the material has no relevant explanatory or instructional task to assess, such as a raw machine-generated index.
- `insufficient_context`: the audience, task, public behavior, or surrounding context needed to distinguish contract from internals is missing.
- Maintainer intent is an exception to consumer-only expectations, not an automatic failure or abstention.
