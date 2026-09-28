---
description: |
  Principles for designing and writing clear, concise, and readable
  software documentation. Use when creating, editing, reviewing, or
  planning technical documentation such as READMEs, guides, tutorials,
  API references, specifications, design documents, ADRs, and RFCs.
  Apply primarily to English source documentation, not translated editions.
name: documentation-principles
---

# Documentation Principles

Software documentation should help readers find, understand, and use the information they need with minimal effort.

This skill does not prescribe a specific writing workflow, research method, file-editing process, or review procedure.
Reading, writing, editing, and tooling are the responsibility of the task, agent, or workflow using this skill.

This skill defines the **principles and decision criteria** that should remain consistent across those activities.

## Core principle

Apply these principles primarily to English source documentation, before translation.
Do not apply them as a separate rewriting or quality-review pass to translated editions.
Review translations separately for fidelity to the source and target-language correctness; make structural or editorial improvements in the English source first, then update its translations.

The goal of documentation is not to maximize the amount of information it contains.

**Optimize for the minimum reader effort required to obtain the information they need.**

Correct information does not belong in a document merely because it is available.
Include it when it serves the reader's purpose.

Do not sacrifice technical accuracy or necessary context for brevity.

## Start from the reader's purpose

Every document should have a clear purpose and intended audience.

Write the information the reader needs, not everything that could be explained.

Answer the document's primary question or objective as early as practical.
Introduce additional concepts and details when the reader needs them.

Prefer one clear purpose per document.
When a page attempts to solve multiple independent problems, consider separating them.

### Describe the consumer's contract, not the implementation's journey

For consumer documentation, lead with what the reader imports, configures, runs, or observes.
Explain implementation details only when they change a decision the reader must make.
Repository layout, test fixtures, previous designs, and internal rendering boundaries do not belong in a usage guide merely because they explain how the feature was built.
Keep those details in maintainer documentation or durable design records.

State the supported default path before presenting customization or alternatives.
When a configured component or generated project already supplies something, do not make the reader reconstruct it from internal examples.
Separate limitations of a default component from limitations of the whole feature.

## Separate documentation concerns

For user-facing documentation, use the Diátaxis framework as a useful distinction between four kinds of documentation:

### Tutorial

Helps the reader learn through guided practice.

Its primary purpose is to provide a learning experience.

### How-to guide

Helps the reader accomplish a specific task.

It may assume the reader already understands the fundamentals.

### Reference

Provides precise technical information for lookup, such as APIs, configuration, types, commands, and specifications.

Prioritize accuracy, consistency, completeness within scope, and findability.

### Explanation

Helps the reader understand concepts, architecture, background, or design decisions.

It primarily addresses why something works the way it does and how it should be understood.

Avoid mixing these concerns unnecessarily.

Do not force every technical document into Diátaxis.
Established formats may have structures better suited to their purpose, including:

- README
- API reference
- troubleshooting guide
- contributor guide
- architecture document
- design document
- ADR
- RFC
- technical specification

Classification is a tool, not a goal.
Use it to decide which information belongs in a document and which information does not.

## Use progressive disclosure

Present information in the order the reader needs it.

Begin with the minimum information required to understand or use the subject.
Introduce additional material afterward as needed, such as:

- details
- alternatives
- constraints
- edge cases
- background
- implementation details
- advanced explanations

Do not require readers to understand implementation details or advanced concepts before they can perform a basic task.

When deeper information belongs elsewhere, link to it rather than duplicating it unnecessarily.

Keep alternative selection in an overview and route the reader to the chosen task guide.
Place host-specific prerequisites in that host's guide, not in every entry page.
Moving a prerequisite out of an overview is not permission to remove it from the path where it is required.
Distinguish choosing a route from following one: an overview helps readers choose, while an execution step should link directly to the needed task or example.
Require earlier tutorial state only when the current task actually depends on it, not merely because a previous page happened to edit the same sample.

## Put the bottom line first

Present important information early whenever practical.

Avoid structures that require the reader to consume the entire explanation before discovering the conclusion, behavior, or action they need.

When background or rationale is useful, state the relevant conclusion, behavior, or decision first, then provide the supporting context.

This follows the BLUF (Bottom Line Up Front) principle.

## Be concise

Every sentence should contribute useful information.

Remove content that can be deleted without reducing the reader's ability to understand or correctly use the subject.

In particular, avoid:

- generic introductions
- unnecessary background
- repeated information
- obvious statements
- filler
- excessive modifiers
- meta-commentary
- summaries that merely restate the document
- prose that simply restates code
- transitions that exist only to delay the main point

Do not optimize for the smallest possible word count.

**Provide the necessary information in the minimum sufficient form.**

## Write directly

Prefer concrete and direct language over abstract or indirect phrasing.

For example, prefer:

> This feature changes the configuration.

over:

> By using this feature, it is possible to make changes to the configuration.

Avoid introductory phrases that add no information, such as "it is important to note that," "basically," or "generally speaking," unless the qualification itself is meaningful.

Prefer active voice when it makes the actor or behavior clearer.

## Give each unit a clear responsibility

As a general rule:

- one sentence should communicate one primary fact or claim
- one paragraph should develop one idea
- one section should serve one clear purpose

Split independent concerns when doing so improves comprehension.

Do not apply this mechanically when splitting would make the text less natural or obscure the relationship between ideas.

A short section or page is complete when it answers its own question with the context its reader needs.
Do not add an introduction, summary, or minimum number of paragraphs merely to make it look substantial.
Choose boundaries by meaning, not word count: keep a command with its prerequisites, a code example with its explanation, and a warning with the behavior it qualifies.
Small units still need a discoverable route and enough context to avoid forcing readers to assemble one task from disconnected fragments.

## Keep information local

Place information near the point where the reader needs it.

Avoid explaining concepts in detail long before they become relevant.

Avoid structures that require readers to assemble a single concept from unrelated sections.

When appropriate, link to the canonical explanation instead of duplicating the same information across multiple locations.

## Prefer structure over prose

Do not rely on long prose when a clearer structure would communicate the information more efficiently.

When appropriate, use:

- headings
- lists
- tables
- code examples
- definitions
- notes or callouts

Do not structure content for its own sake.
A short paragraph is better than an unnecessary table or list when prose is clearer.

## Use GitHub Flavored Markdown by default

Write Markdown using GitHub Flavored Markdown (GFM).
Unless the repository specifies otherwise, assume the target renderer supports GFM and GitHub's alert syntax rather than restricting documents to plain Markdown for hypothetical compatibility.
Follow repository-specific format or renderer requirements when they differ from this default.

Use GitHub Alerts to clearly separate warnings, notes, and supplementary information from the main narrative.
Choose the alert type that matches the content: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, or `CAUTION`.
GitHub Alerts are a GitHub-specific extension, not part of the formal GFM specification.
When the repository requires another format or a renderer without alert support, use its supported equivalent to preserve the separation from the main text.

```markdown
> [!NOTE]
> Relative paths are resolved from the configuration file's directory.

> [!WARNING]
> This command overwrites the existing configuration file.
```

Keep alerts concise and close to the relevant text or action.
Keep the primary explanation in the main text rather than turning ordinary paragraphs into alerts.
Choose severity by the reader's consequence, not the complexity of the implementation.
For a limitation that can invalidate the reader's intended use, state the affected feature, observable consequence, and available remedy when one exists.
Do not hide a consequential limitation inside an implementation-oriented note or broaden it to unaffected features.

## Optimize for scanning

Technical documentation is rarely read strictly from beginning to end.

Structure documents so readers can quickly locate relevant information.

Headings should describe the content beneath them rather than act as rhetorical transitions.

Prefer explicit information architecture over long narrative prose.

## Let examples carry information

Examples should demonstrate behavior, not decorate the document.

Keep examples focused on the concept being explained.
Exclude code and configuration that are unrelated to the point.

Do not restate self-explanatory code in prose.

Use prose primarily to explain information that the example cannot communicate clearly on its own, including:

- non-obvious behavior
- constraints
- prerequisites
- trade-offs
- consequences
- important edge cases
- design rationale

When documenting an operation or extension point, prefer a small example showing the actual import, call, or replacement over prose that merely names the mechanism.
Do not remove a necessary example in the name of concision or repeat what its syntax already makes clear.

## Do not repeat information unnecessarily

As a general rule, explain a fact once.

Avoid repeating the same information in the body, examples, notes, and summaries unless the repetition serves a clear reader need.

When repetition is necessary, ensure each occurrence provides distinct value.

Choose one maintained home for each detailed procedure or public contract.
A package README may link directly to a documentation site's guide and reference instead of maintaining a parallel guide.
Keep the short overview needed to choose that link, but avoid repeating the same introduction in the overview, guide, and example directory.
Translations are intentional parallel editions: preserve equivalent steps, defaults, and warnings rather than deleting them as duplication.

## Preserve technical precision

Accuracy takes precedence over concision.

Keep necessary explanation when removing it would make the meaning ambiguous.

Use terminology consistently.

State important technical properties explicitly when relevant, including:

- requirements
- defaults
- constraints
- behavior
- side effects
- exceptions
- failure conditions

Do not invent behavior or present assumptions as facts.

Precision does not require narrating every internal normalization step or hidden dependency.
For an API lookup, prioritize the public call, its result, and necessary failure handling.
Keep an internal detail when it changes valid inputs, required configuration, observable behavior, or another decision the reader must make.
An actionable runtime setting is often more useful than a list of modules that setting enables.

Distinguish verified facts from inference.
When uncertainty matters, state it explicitly.

## Avoid unnecessary completeness

A document does not need to contain everything known about its subject.

Include what serves the document's purpose.

Move secondary information to a more appropriate document or link to it.

Omit information that provides no practical value to the intended reader.

Mention absent behavior when it prevents a likely mistake, such as expecting a form submission to persist data.
Do not inventory missing bindings, ports, or features when a concise conditional next action would serve the reader better.

Do not assume that more detail automatically produces better documentation.

## Decision criteria

When adding a sentence, paragraph, example, note, or section, ask:

> Does the reader need this information to accomplish the purpose of this document?

When evaluating existing content, ask:

> Can this be removed without reducing the reader's ability to understand or use the subject correctly?

If the answer is yes, remove it by default.

Keep the content when removing it would lose accuracy, necessary context, constraints, or meaningful decision-making information.

## References

This skill primarily draws from the following public resources.

### Diátaxis

A systematic framework for technical documentation that distinguishes tutorials, how-to guides, reference, and explanation.

https://diataxis.fr/

### Technical Writing Guide

The StrictDoc Project's technical writing skill, including guidance on BLUF, concise wording, active voice, sentence focus, and structure over prose.

https://github.com/strictdoc-project/technical_writing_skill/blob/main/SKILL.md

### Next.js documentation and agent guidance

Next.js documentation and agent guidance provide useful examples of progressive disclosure, task-focused documentation, and the separation of durable documentation from task-specific agent workflows.

https://nextjs.org/docs

https://github.com/vercel/next.js/tree/canary/docs

https://github.com/vercel/next.js/blob/canary/.agents/skills/README.md

## Scope of this skill

This skill defines **documentation principles and decision criteria**.

It does not prescribe:

- how to inspect source code
- how to read existing documentation
- how to discover or validate sources
- how to create or edit files
- how to organize agents or subagents
- how to perform reviews
- how to structure a documentation-generation workflow

Those concerns belong to the agent, skill, workflow, or user instructions responsible for the task.

Use this skill as a shared set of principles for judging the quality and structure of software documentation regardless of how that documentation is produced.
For history-calibrated reviews and optional parallel Jev checks, use [documentation-quality](../documentation-quality/SKILL.md).
