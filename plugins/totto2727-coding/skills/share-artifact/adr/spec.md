# ADR format

Use [documentation-principles](../../documentation-principles/SKILL.md) for documentation principles and content-quality decisions.
This slice defines ADR structure, storage, metadata, and record-state constraints, not an implementation or approval workflow.
The companion [template.md](template.md) defines the Jinja form, and [sample.md](sample.md) is its rendered example.

## Document boundary and storage

An Architecture Decision Record (ADR) records a durable project decision with `scope: general`.
Implementation-local decisions and retrospective observations are outside this document kind.
Store records at `docs/adr/<YYYY-MM-DD>-<title>.md`, using a kebab-case title.
Create `docs/adr/` when filing its first record, not as an empty directory.
The filename and rendered storage path must agree.

## Frontmatter and state

Every ADR starts with this shape:

```yaml
---
confirmed: false
scope: general
---
```

`confirmed` is a boolean indicating whether the decision owner has approved the record itself.
A new unapproved record uses `false`; implementation status or an unrelated approval does not imply `true`.
The body of a `confirmed: true` record is immutable except for the supersession addendum below.
A changed decision is represented by a new ADR, not a rewrite, move, or narrowing of the confirmed record.

## Section order and render context

| Position | Form                           | Required context                                                                               |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1        | YAML frontmatter               | `confirmed`; `scope: general` is literal.                                                      |
| 2        | `# ADR: <title>`               | `title`                                                                                        |
| 3        | Metadata bullets               | `filed_at`, `decision_owner`, `origin`, `storage_path`                                         |
| 4        | `Context`                      | `context`: decision scope, constraints, and forces.                                            |
| 5        | `Decision` and option table    | `decision`; `options` entries with `name`, `summary`, `result`, and `rationale`.               |
| 6        | `Consequences` bullets         | `consequences.added`, `.existing_impact`, `.future_constraints`, and `.costs_and_limitations`. |
| 7        | Optional `Related records`     | `related_records` entries with `title` and `path`.                                             |
| 8        | Provenance footer              | Literal footer below.                                                                          |
| 9        | Optional supersession addendum | `superseded_by.title` and `.path`.                                                             |

Supply an empty list for no related records and an empty mapping for no superseding record.
The option-table columns are `Option`, `Summary`, `Result`, and `Rationale`.
Directly dependent records link to this ADR and appear in its related-record list.
Additional sections may extend the form without reordering required sections or changing storage and record-state constraints.
Render with Jinja `StrictUndefined` and `keep_trailing_newline=True`.

## Provenance

Append this exact footer without a heading:

```markdown
_This ADR was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [ADR template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/adr/template.md)._
```

## Supersession form

A superseding ADR links back to the old record and contains the active decision.
The only permitted change to the old confirmed record is this single-line terminal addendum, keeping its original body, `confirmed: true`, and `scope: general`:

```markdown
> Superseded by [<new ADR title>](path-to-new-adr)
```

The template renders this after the provenance footer when `superseded_by` is populated.

## Resource consistency

Keep this format, its template, and its sample aligned under the shared [template](../internal/template/spec.md) and [sample](../internal/sample/spec.md) contracts.
Format validation covers the storage path, frontmatter, ordered sections, option-table fields, consequence fields, related links, exact provenance, and supersession addendum.
Content-quality judgments use documentation-principles rather than a separate ADR writing rubric.
