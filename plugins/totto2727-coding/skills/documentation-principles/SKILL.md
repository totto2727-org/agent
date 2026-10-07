---
name: documentation-principles
description: >-
  Apply ASD-STE100 as the default standard when creating, editing, or planning English developer documentation.
  Use only unavoidable, documented exceptions and supplements for needs the standard does not cover.
  Treat translated editions as translations of the English source.
  Use documentation-quality for review procedures and share-artifact for document formats.
---

# Documentation Principles

**Use ASD-STE100 as the baseline, not as a menu of optional writing advice.**
Apply the standard strictly to English developer documentation across languages, tools, and project types.
Relax a requirement only when compliance is operationally impossible, and only within the smallest necessary scope.
Use the supplements below for developer-documentation needs that STE does not cover; do not duplicate its requirements as independent rules.

## Standard and scope

Use **ASD-STE100 Issue 9, January 2025**, including its writing rules and dictionary, as the authoritative reference.
Consult the official standard for the applicable requirements and permitted uses; this skill does not reproduce its rule details.
Use an available official copy, or obtain one through the [official distribution page](https://www.asd-ste100.org/STE_downloads.html).
The [official overview](https://www.asd-ste100.org/about_STE.html) and [FAQ](https://www.asd-ste100.org/STE_faq.html) provide context, not substitutes for the standard.
If the relevant requirements cannot be inspected, identify the unresolved requirement rather than inventing a rule, granting an exception, or claiming compliance.

Apply this baseline to English prose in guides, references, design explanations, and operational procedures.
Distinguish material outside the standard's applicability and uses already permitted by the standard from local exceptions.
Do not treat a permitted use as a disabled rule.

## Unavoidable exceptions

Try a compliant formulation and the standard's permitted uses before requesting an exception.
Convenience, writing effort, existing habits, and stylistic preference are not sufficient grounds for relaxation.
The party proposing an exception must establish why compliance cannot satisfy the document's operational requirements.

Record the adopted issue, affected rule or dictionary requirement, exact scope, concrete incompatibility, and the requirement that remains in force instead.
For example, an externally mandated statement might require exact wording; verify that constraint and limit any necessary exception to that statement, not its surrounding explanation.
Do not infer an exception from an unfamiliar technical term or disable a category of rules without establishing the incompatibility.
Use an existing maintained project policy for recurring exceptions and identify a passage-specific exception where its scope is clear.
These records explain current applicability, not work progress or a history of revisions.
Do not describe text with local exceptions as unqualified ASD-STE100 compliance.

## Developer-documentation supplements

These supplements govern content selection, non-prose evidence, and relationships between documents.
They do not replace STE's language requirements or justify weaker wording rules.
If STE already covers a requirement, use the standard rather than maintaining a second definition here.

### Serve a reader's purpose

Identify the intended audience and its assumed knowledge before selecting content.
Distinguish four audience groups, or five when contributors and maintainers need separate guidance:

- Beginner users: use the subject for the first time and need a supported path to their first useful result.
- Intermediate users: know the basics and need to use the subject in practical tasks.
- Advanced users: need detailed behavior or internal knowledge to use the subject correctly for their purpose.
- Developers of the subject: change the subject itself. Separate contributors from maintainers when contribution tasks and maintenance responsibilities require different guidance.

Classify readers by their relationship to the subject, not their profession.
A developer who consumes a library or API is a user of that subject, not its developer.
An advanced user does not become a contributor or maintainer merely by understanding internals.

Every document must identify which groups it serves and respect their assumed knowledge.
Give each task or explanation a clear audience, and separate guidance for different groups into distinct sections or pages with explicit onward links.
Do not require readers to filter out material intended for another group or include all groups in every document.

Do not expose implementation internals to beginner or intermediate users unless that knowledge is indispensable to correct use.
For such an exception, explain only the behavior, conditions, and consequences the reader must understand; include the underlying mechanism only when those facts alone are insufficient.
Possible future interest, completeness, and the availability of implementation details do not justify an exception.

Choose learning, task execution, reference, or explanation by the intended group's purpose.
Include information only when it helps that group act, understand, decide, or look something up.

### State current guidance and its grounds

For documents about the current state or how to act now, state supported behavior, requirements, or recommendations.
Give concrete grounds when the reader needs them to understand or apply the guidance.
A past decision or incident alone does not justify a current rule, and commit-recoverable history does not belong merely because it is available.
Preserve a useful lesson as its current conclusion, applicability, and evidence.
Retain chronology when it is part of the document's purpose, such as a changelog, ADR, or incident investigation.
This distinction governs which information belongs, not a separate English writing style.

### Treat code and diagrams as substantive documentation

Code, commands, configuration, input/output examples, tables, and diagrams can carry the main explanation; they are not decoration subordinate to prose.
Evaluate each representation together with the context needed to use or interpret it.
Do not repeat in prose what a sufficient example or diagram already communicates.
Supply missing prerequisites, constraints, and result interpretation rather than generic introductions or summaries.

Preserve executable syntax, API identifiers, configuration keys, and faithfully quoted output.
Rewriting them to resemble controlled English can make an example incorrect or prevent readers from recognizing the actual interface.
Do not infer a blanket exception for code comments, explanatory strings, captions, or surrounding prose; determine their applicability separately.
Use the standard's permitted terminology where applicable before considering a local exception.

### Maintain document ownership and navigation

Give detailed guidance one canonical home and link to it from relevant entry points.
Document-set ownership and cross-page duplication require decisions beyond the wording of an individual passage.
Separate choosing a path from following it, and make linked prerequisites and destinations available at the point of use.
Use the repository's document conventions; default to GitHub Flavored Markdown when none are specified.

### Verify claims against their evidence

STE compliance does not establish that an API behaves as described, an example runs, or a link reaches the intended guidance.
Check claims against the relevant specification, implementation, or observed behavior, and distinguish verified facts from assumptions.
Preserve requirements, compatibility constraints, failure conditions, and meaningful trade-offs when selecting content or replacing prose with another representation.
Do not invent a prerequisite, consequence, or remedy to make a passage look complete.

## Translated editions

Write and assess the English source against this baseline; treat other editions as translations of that source.
Preserve meaning, terminology, conditions, and the role of code and diagrams in translation.
Do not impose English-specific dictionary or grammar constraints mechanically on Japanese or create a separate principles system for it.
Check translation fidelity and target-language correctness without treating translation as permission to change the source's requirements.

## Related skills

Use [documentation-quality](../documentation-quality/SKILL.md) for review procedures.
This principles skill does not contain a rule-by-rule rubric or certify the coverage of a separate review tool.
Use [share-artifact](../share-artifact/SKILL.md) for README, AGENTS.md, and ADR structure.
