# Sample resource contract

## Role

A document `sample.md` is a reproducible concrete rendered output of its sibling template. It demonstrates the specification in a reviewable form; it is not an external-link stub or an independently authored alternative.

## Vertical slice invariant

Every document slice has exactly `{document}/spec.md`, `{document}/template.md`, and `{document}/sample.md`: the specification constrains semantics, the template constrains the minimum rendered form while allowing justified extensions, and the sample is a reproducible concrete output of the sibling template. Internal maintenance areas use `internal/{spec,template,sample}/{spec,template}.md` only. An `internal/**/sample.md` is prohibited; use the `readme/`, `agents/`, and `adr/` slices as concrete examples.

## Required content

Record the document type, named fixture, sibling specification and template paths, render context, rendered output, provenance checks, and validation checks. Preserve the exact result of rendering the sibling template, except for final-newline normalization when the validation explicitly permits it.

## Naming and path

Name the resource `sample.md` and store it beside the matching [specification](spec.md) and [template](template.md) in a document slice. Never add an internal sample; the README, AGENTS, and ADR document slices are the only concrete examples for the internal contracts.

## Consistency and extension

Keep the sample consistent with the sibling specification and byte-reproducible from the sibling template and recorded fixture context. A justified extension is allowed only when it is present in both the rendered sample and its reproducible fixture and does not remove mandatory form.

## Validation

Render the sibling template with the recorded context under Jinja `StrictUndefined`, compare the result to the sample, and verify every provenance link and path. Reject samples that cannot be reproduced, omit their fixture identity, or substitute raw links for concrete rendered content.
