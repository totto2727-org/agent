# Canonical home

## Applicability and context

Use `canonical-home` at page scope with the relevant documentation-set context.
Inspect actual entry pages, linked guides, and overlapping procedures rather than guessing from document names.
Review one source language, normally English, rather than applying this rubric to translated editions.
This guide supports follow-up reasoning review; do not inject its samples or historical labels into blind Jev requests.

## Illustrative comparison

These invented document inventories illustrate ownership, not paths in a particular product or quotations from history.
Assume the supplied excerpts confirm that all three procedures serve the same consumer task.

**Problematic**

```text
Package README: full installation, configuration, rendering, and customization guide.
Package guide: repeats the same consumer procedure.
Documentation site: maintains another copy of that procedure.
```

**Improved**

```text
Package README: concise purpose and direct links to the site's guide and API reference.
Documentation site guide: maintained home for the consumer procedure.
Documentation site reference: detailed public contract for lookup.
Contributor guide: repository setup and maintenance tasks.
```

### Why this diagnosis

The problematic arrangement requires parallel maintenance of the same detailed consumer guidance without a distinct reader purpose.
The improved arrangement retains entrypoint context while assigning detailed procedures and reference material clear homes.
It separates maintainer tasks rather than erasing them with the duplicate consumer guide.
A README does not need to become empty to stop being a competing manual.

## Exceptions and false positives

- A concise package overview or a useful quick entrypoint is not automatically duplicate documentation.
- A task-local prerequisite can legitimately repeat a requirement needed by readers arriving directly at that task.
- A reference and a tutorial can discuss the same API while answering different reader questions.
- Maintainer guidance has a distinct purpose when it explains repository maintenance rather than repeating consumer setup.
- Translations are intentional parallel editions, not competing homes; preserve equivalent steps, defaults, and warnings.
- Similar filenames or isolated repeated sentences do not establish duplicate detailed procedures.

## Inspect and fix a failure

1. Compare the actual overlapping excerpts and identify their audiences and tasks.
2. Establish which location will be maintained as the home for each detailed procedure or contract.
3. Retain the concise overview readers need to choose a link, and link directly to the relevant guide or reference.
4. Consolidate duplicate detail without discarding unique constraints, useful examples, or maintainer instructions.
5. Check affected links and entrypoints after consolidation; do not replace multiple working routes with a dead destination.

This is an ownership judgment across documents, not a ban on all repetition or an instruction to delete unseen pages.

## Abstention boundaries

- `not_applicable`: the page has no consumer-guidance ownership or entrypoint responsibility within the supplied document set.
- `insufficient_context`: the duplication question depends on unseen neighboring guides, README content, or linked destinations.
- A link alone does not prove the destination contains the detailed guidance; missing evidence is not a pass.

## Historical grounding

See [PR #17: explain rendering as a consumer contract](../history-evidence.md#pr-17-explain-rendering-as-a-consumer-contract), especially revision `71f11f63`, for consolidation of package consumer docs into the bilingual site.
The [rule catalog](../rules.md) notes that this page rule is not calibrated by the section-pair corpus; bilingual editions are not independent evidence of duplication or quality.
