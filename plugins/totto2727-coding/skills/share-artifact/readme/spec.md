# README format

Use [documentation-principles](../../documentation-principles/SKILL.md) for documentation principles and content-quality decisions.
This slice defines only README structure, field placement, and rendering constraints.
The companion [template.md](template.md) defines the Jinja form, and [sample.md](sample.md) is its rendered example.

## Document boundary

An entry `README.md` contains consumer documentation.
Repository development commands, architecture, contributor toolchains, and AI instructions belong in [AGENTS.md](../agents/spec.md).
A developer using a development tool is still a consumer; maintaining that tool's repository is a separate audience.
A directory-index README that is not a consumer entrypoint does not require this form.

## Section order

Set `entry_scope` to `root`, `independent`, or `nested`, and `usage_placement` to `owned` or `linked`.
`root` and `independent` entries require `usage_placement=owned` and this order:

1. Project title and overview
2. `Usage`
3. `Key features`
4. `Prerequisites`
5. `Setup`
6. `API`
7. `Development`: a link to `AGENTS.md`, not repository operation instructions
8. `License`
9. Provenance footer

A `nested` entry contains only the title, package or directory overview, `Usage`, `API`, and provenance footer.
Every form uses literal `## Usage` and `## API` headings.
Additional consumer sections may extend the full form without reordering required sections; `License` remains the final section.
Render single-paragraph bullet items as tight lists, with one blank line before and after each list.

## Entry hierarchy

- `root`: the repository consumer entrypoint, owning common prerequisites, setup, development links, and license.
- `independent`: a separately acquired or configured package, directory, or standalone example with its own full consumer entrypoint.
- `nested`: a package or directory sharing the root consumer flow, with its own API and owned or directly linked Usage.

For `nested` entries, `usage_placement=owned` renders the selected surface's inline Usage; `linked` renders `usage_guide.summary` and a direct link using `usage_guide.title` and `usage_guide.path`.
Root and independent entries cannot use `usage_placement=linked`.
Reference-only directory content belongs in a guide rather than this entry README form.

## Usage fields

Set `usage_surface` to exactly one supported value:

| Value     | Render context and form                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `library` | `usage_examples` entries contain `summary`, `language`, and `code`.                                                         |
| `cli`     | Nonempty `cli_usage_examples` entries contain `summary`, `command`, and `result`, rendered as bash input and text output.   |
| `agent`   | Nonempty `agent_usage_examples` entries contain `summary`, `prompt`, and `result`, rendered as text blocks.                 |
| `gui`     | `gui_usage` contains `image_alt`, `image_path`, and `interaction_result`, rendered as an image and interaction description. |

Usage represents the public operation and its result; dependency declarations, imports, and acquisition commands occupy Setup.
For a multi-package library root, an empty `usage_examples` list and populated `usage_links` render links to package-owned Usage sections.
Each link contains `title`, `path`, and `summary`; this branch is valid only for `root`.
For a root or independent library linking to an example instead of rendering one inline, leave both lists empty and provide `usage_guide.title`, `usage_guide.path`, and `usage_guide.summary`.
This library fallback targets a concrete example or implementation Usage, not a package landing page or API index.
Other surfaces have no owned-Usage link fallback.

## Prerequisites and Setup fields

`prerequisites` entries contain `name` and `detail` for consumer requirements before setup.
An empty list renders `No prerequisites.`
Runtime behavior and results occupy Usage or API, not Setup.

For `library`, supply `setup_steps` entries containing `language`, `command`, and optional `description` for consumer dependency declarations, imports, or aliases.
An empty list renders `No setup is required.`

For `cli`, `agent`, or `gui`, supply all three inputs:

| Input                      | Rendered form                                                                     |
| -------------------------- | --------------------------------------------------------------------------------- |
| `temporary_setup_options`  | Entries with `command`, grouped in one bash block under `Run without installing`. |
| `persistent_setup_options` | Entries with `command`, grouped in one bash block under `Install`.                |
| `consumer_flake_setup`     | Mapping with complete `code`, rendered in one nix block under `Nix flake`.        |

Use empty lists for unavailable command modes and an empty mapping for an unavailable consumer flake.
Empty modes omit their headings; when all three are empty, render `No setup is required.`
These acquisition modes are parallel alternatives, not numbered steps.

## API fields

Set `api.mode` to exactly one supported value:

| Value      | Render context and destination                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `registry` | `api.registry_name` and `api.registry_url` link directly to a maintained, accessible API index.        |
| `inline`   | `api.entries` cover the public API with `name`, `summary`, `language`, and `example` for each entry.   |
| `guide`    | `api.guide_title`, `api.guide_path`, and `api.guide_summary` link to a maintained guide under `docs/`. |

A package landing page without an API index does not satisfy `registry`; a missing target does not satisfy `guide`.
The `API` heading remains present when its content is delegated.
For CLI references, README may contain the reference, link a consumer guide, or give the exact generated-help command and relevant subcommand help paths.
`AGENTS.md` is not a consumer CLI-reference destination.

## Remaining context

Supply `project_name` and `overview` in every form.
Full forms also require `features`, `prerequisites`, the selected Setup inputs, `development_summary`, and `license`.
`features` is a list of bullet text; `development_summary` contains the development-documentation link.
Use Jinja `StrictUndefined` and `keep_trailing_newline=True`; missing required fields and unsupported discriminators are render errors.

## Provenance

Append this exact footer without a heading after `License` in the full form or `API` in the compact form:

```markdown
_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
```

## Resource consistency

Keep this format, its template, and its sample aligned under the shared [template](../internal/template/spec.md) and [sample](../internal/sample/spec.md) contracts.
The authoring repository's `tests/share_artifact_readme_fixture.py` records the sample context, and `tests/share_artifact_readme_template_test.py` checks rendering branches and executable MoonBit examples.
These are authoring resources, not dependencies of an installed skill or consuming project.
MoonBit file and symlink conventions are defined in the [AGENTS format](../agents/spec.md#moonbit-readme-layout).
