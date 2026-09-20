---
name: share-artifact
description: >-
  Formats and Jinja templates for README, AGENTS.md, and ADR authoring or review.
  Use documentation-principles for shared writing principles and content quality.
---

# Share artifact

## Scope

Use [documentation-principles](../documentation-principles/SKILL.md) when planning, writing, editing, or reviewing document content.
This skill owns document-specific formats: sections, fields, file layout, metadata, and rendering contracts.
It does not define a separate writing philosophy or research, editing, or review workflow.

## Resource selection

Select only the document slice relevant to the request.
Its specification defines the format contract, its Jinja template renders that form, and its sample demonstrates the output.
For a small edit, consult the applicable rule rather than loading every sibling resource.
Template changes require the matching sample and reproducibility checks; internal contracts apply only when maintaining these resources.

## Table of contents

### Document slices

- [README format](readme/spec.md)
- [AGENTS format](agents/spec.md)
- [ADR format](adr/spec.md)

### Internal contracts

- [Specification contract](internal/spec/spec.md)
- [Template contract](internal/template/spec.md)
- [Sample contract](internal/sample/spec.md)
