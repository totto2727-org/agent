# Canonical home

## Applicability and context

Use `canonical-home` when developer documents overlap in the details they maintain.
Compare actual passages and their reader purposes, not filenames or links alone.
Review English source documents, not translated editions.
Use these examples for follow-up review, not as samples or expected labels in blind model input.

## Illustrative comparison

In this hypothetical library's documentation, three pages repeat the complete retry-option table with no distinct need for independent copies.
The table includes option names, defaults, accepted values, and interactions.

**Problematic**

```text
Overview: introduction plus complete retry-option table.
Retry tutorial: worked example plus another complete retry-option table.
Configuration reference: independently maintained retry-option table.
```

**Improved**

```text
Overview: purpose and direct links to the tutorial and configuration reference.
Retry tutorial: worked example with its chosen values and relevant caveats.
Configuration reference: maintained home for the complete retry-option table.
```

### Why this diagnosis

The problematic arrangement requires the same detailed table to be updated in three places without a reader benefit.
The improved tutorial still teaches its task rather than becoming an empty pointer.
Repeating the values needed to understand that example is not the same as maintaining another complete reference.
The right home depends on the document set's readers and maintenance responsibilities, not a required filename or publishing system.

## Exceptions and false positives

- A tutorial and a reference may cover the same subject while answering different questions.
- A standalone runbook or offline handout may need enough repeated detail to work without another document.
- Deliberately generated copies with a clear maintained source are not independently competing homes.
- Safety warnings and required legal notices may need repetition at each point of use.
- Training material may repeat an explanation deliberately to support practice or recall.
- Concise summaries, task-local prerequisites, and useful entry points are not automatically competing manuals.
- Translated editions are excluded from this review, not treated as duplicate homes.

## Inspect and fix a failure

1. Compare the overlapping detail and establish whether the audiences and purposes justify repetition.
2. Choose one maintained home for detail that does not need independent copies.
3. Retain context, examples, and warnings needed where readers encounter the topic.
4. Replace unnecessary duplication with a direct reference to the relevant section.
5. Check the destination, affected entry points, and any retained copies for consistency.

## Abstention boundaries

- `not_applicable`: the supplied material has no overlapping-detail or document-home responsibility to assess.
- `insufficient_context`: unseen documents or unknown standalone requirements determine whether the repetition is justified.
- Similar filenames or isolated repeated sentences do not establish competing maintained homes.
