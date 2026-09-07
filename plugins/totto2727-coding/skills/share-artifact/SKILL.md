---
name: share-artifact
description: >-
  Specifications and Jinja forms for README, AGENTS.md, and ADR authoring or review.
---

# Share artifact

## Resource selection

Select only the document slice relevant to the request.
Its specification defines meaning and invariants, its Jinja template defines rendered form, and its sample demonstrates that form.
For a small edit, consult the applicable rule rather than loading every sibling resource.
Template changes require the matching sample and reproducibility checks; internal contracts apply only when maintaining these resources.
The model owns the investigation, editing, and validation sequence within those constraints.

## Table of contents

### Document slices

- [README specification](readme/spec.md)
- [AGENTS specification](agents/spec.md)
- [ADR specification](adr/spec.md)

### Internal contracts

- [Specification contract](internal/spec/spec.md)
- [Template contract](internal/template/spec.md)
- [Sample contract](internal/sample/spec.md)
