# Specification resource contract

Use [documentation-principles](../../../documentation-principles/SKILL.md) for shared writing principles.
This contract covers resource structure and rendering consistency only.

## Role

A document `spec.md` defines its sibling document format: section order, render fields, file layout, metadata, and record-state constraints.
Shared writing principles belong to documentation-principles, not the document slice.

## Vertical slice invariant

Every document slice has exactly `{document}/spec.md`, `{document}/template.md`, and `{document}/sample.md`: the specification defines document-specific format constraints, the template constrains the minimum rendered form while allowing justified extensions, and the sample is a reproducible concrete output of the sibling template. Internal maintenance areas are intentionally asymmetric: `internal/spec/` contains this contract and its common specification template, while `internal/template/` and `internal/sample/` contain only `spec.md` because their concrete forms vary by document kind. An internal `sample.md` or a meta-template under `internal/template/` or `internal/sample/` is prohibited; use the `readme/`, `agents/`, and `adr/` slices as concrete examples.

## Required content

Define the resource role, required content, naming and path rule, consistency obligations, extension rule, and validation criteria. State which sibling files the specification constrains and preserve relevant audience, storage, symlink, or immutability constraints.

## Naming and path

Name the resource `spec.md` and store it beside the matching [maintenance template](template.md) and `sample.md` in a document slice, or beside that template in an internal maintenance area. Do not introduce another specification filename or a second specification for the same document kind.

## Consistency and extension

Keep requirements implementable by the sibling template and demonstrable by the sibling sample. Add a purpose-specific requirement only when it does not contradict the common vertical-slice invariant or the selected document contract; explain the justification near the extension.

## Validation

Check that the required headings and rules are present, the relative sibling references resolve, the template can express every mandatory requirement, and the sample remains reproducible from the template. Reject a missing reproducibility rule and any internal `sample.md`.
