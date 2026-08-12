# ADR specification

## Role and scope

An Architecture Decision Record (ADR) preserves a durable decision whose effect extends beyond one implementation effort. Use it for a decision shared across independent work, across multiple roadmaps, or across multiple implementation efforts in one roadmap. The mode follows the decision's actual scope, not the activity that discovered it.

| Mode    | Use when                                                                                         | File location                                           | Required `scope` value |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------- |
| General | The decision affects the project, independent efforts, or more than one roadmap.                 | `docs/adr/<YYYY-MM-DD>-<title>.md`                      | `general`              |
| Roadmap | The decision is shared by multiple milestones or implementation efforts within one roadmap only. | `docs/roadmap/<roadmap-id>/adr/<YYYY-MM-DD>-<title>.md` | `roadmap:<roadmap-id>` |

Roadmap is an ADR mode only. This specification does not create a roadmap document, milestone document, roadmap template, or retrospective template. A decision confined to one implementation effort, such as its implementation-local cache choice, belongs in that effort's local design artifact rather than an ADR.

## Filing and minimum form

Create the selected `adr/` directory only when filing its first ADR; do not commit an empty directory. Name the record `<YYYY-MM-DD>-<title>.md`, using a short kebab-case title. The filename, selected storage path, and frontmatter scope must agree.

Start every filed ADR with exactly this required frontmatter shape:

```yaml
---
confirmed: false
scope: general | roadmap:<roadmap-id>
---
```

Replace the `scope` placeholder with the selected concrete value. File with `confirmed: false`, have the decision owner review the ADR record itself, and set `confirmed: true` only after that owner approves it. Do not infer approval from an implementation, a status update, or stale project state.

The sibling [template](template.md) defines the minimum Jinja-rendered form. Its required sections and order are mandatory; authors may add a purpose-specific section only when they keep every required section and do not violate this specification's scope, storage, confirmation, or immutability rules. The sibling [sample](sample.md) is the reproducible concrete output that demonstrates the form. Apply the shared [specification contract](../internal/spec/spec.md), [template contract](../internal/template/spec.md), and [sample contract](../internal/sample/spec.md) when maintaining these resources.

## Lifecycle and maintenance

When creating an ADR, select its mode, render the sibling template, replace every required context value, review the rendered record against the quality criteria, and present the ADR itself to the decision owner when approval is required. Persist an approved ADR with the change that establishes the decision; when a roadmap's machine-readable state tracks the ADR path, update that state in the same change. This is artifact persistence guidance, not an implementation workflow or a roadmap document guide.

Maintain the ADR specification, template, and sample as a coordinated set: after changing one, verify that the sibling resources still describe and reproduce the same minimum form. Add a required field or section only when the specification, template, and sample are updated together. Do not create an `internal/**/sample.md` or restore roadmap, milestone, or retrospective guides or templates.

## Required rendered content

The rendered ADR must contain, in the template's required order:

1. `Context` — why a durable decision is necessary, its applicable scope, constraints, and decision forces.
2. `Decision` — the precise selected option and a comparison with viable alternatives. Alternatives must be real options with evidence-based tradeoffs; do not invent placeholders merely to meet a count.
3. `Consequences` — additions, existing-work impact, future constraints, migration cost, benefits, and limitations.
4. `Related records` when direct dependencies exist — link every roadmap, milestone, implementation design, prior ADR, or other dependent record that directly relies on the decision. Each dependent record must also link back to this ADR.
5. `Authoring resources` — the two canonical raw provenance links below.

Every rendered ADR must include this exact raw skill URL and exact raw ADR-template URL in its `Authoring resources` block:

- `https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md`
- `https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/adr/template.md`

These raw links establish authoring provenance; they do not replace the locally rendered ADR, required content, or linked dependent records.

## Confirmation, immutability, and supersession

The body of a `confirmed: true` ADR is immutable. A proposal to edit a confirmed body must be rejected, even when it appears to be a correction or a scope adjustment. File a new superseding ADR that carries the active decision and links back to the old ADR instead.

The only permitted change to the old confirmed record is one single-line addendum appended at the end of its body, while keeping `confirmed: true` and its original scope:

```markdown
> Superseded by [<new ADR title>](path-to-new-adr)
```

Do not move, rewrite, narrow, or otherwise revise the old record. If a Roadmap ADR later applies outside that roadmap, file a General ADR and append this addendum to the Roadmap ADR. If the applicable scope changes from General, supersede with a new ADR; never demote or rewrite the confirmed General ADR.

## Reference and retrospective boundary

Before implementation, read applicable confirmed General ADRs and, for work within a roadmap, applicable confirmed Roadmap ADRs. Do not implement a design that contradicts a confirmed ADR; file and confirm a superseding ADR first.

An ADR records a durable decision, its alternatives, and its consequences. A retrospective records observations, causes, and proposed improvements. Extract a durable cross-effort decision discovered in a retrospective into an ADR; leave non-decision observations in the retrospective. This boundary does not authorize retrospective authoring in this ADR specification.

## Quality and validation criteria

Accept an ADR only when all of the following are true:

- It concerns a durable shared decision, and its selected General or Roadmap mode matches its actual scope and storage path.
- Its file name, frontmatter, `confirmed` state, owner approval, and confirmation transition are internally consistent.
- Its context states scope and constraints, its decision is actionable, and its alternatives are real and honestly compared.
- Its consequences cover benefits, costs, limitations, migration or existing-work impact, and future constraints.
- Every direct dependent record is linked in both directions when such records exist.
- A confirmed record has an unchanged body except, when superseded, the exact one-line terminal addendum; the new ADR links back and holds the active decision.
- Its minimum form is rendered from [template.md](template.md), can justify any extension, and is reproducibly represented by [sample.md](sample.md).
- Its authoring-resources URLs are the exact canonical raw links listed above and resolve to the sibling skill and template paths.

Reject malformed or ambiguous scope, a file/path/frontmatter mismatch, false confirmation, a local-only design decision, invented alternatives, missing consequences, a stale dependent-record assumption, or any attempted confirmed-body mutation. Route rejected local decisions to the implementation's local design artifact and confirmed-decision changes to a new superseding ADR.
