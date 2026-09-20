# AGENTS format

Use [documentation-principles](../../documentation-principles/SKILL.md) for documentation principles and content-quality decisions.
This slice defines AGENTS structure, field placement, file aliases, and rendering constraints.
The companion [template.md](template.md) defines the Jinja form, and [sample.md](sample.md) is its rendered example.

## Document boundary

`AGENTS.md` contains repository development and AI-agent instructions: build, test, lint, deploy, architecture, tools, and execution constraints.
Consumer installation, usage, public API references, and license information belong in the [README format](../readme/spec.md).

## Section order

Render a project title followed by the populated sections in this order:

1. `Repository structure`
2. `Development commands`, with optional `Execution rules` and `Standard tasks` subsections
3. `Architecture`
4. `Development tools`
5. `Package-specific rules`
6. `Task-specific documentation`
7. `MoonBit README maintenance` when `is_moonbit=true`
8. Provenance footer

Empty sections are omitted.
Additional repository-specific sections may extend the form without reordering existing sections or becoming a consumer getting-started guide.
Render single-paragraph bullet items as tight lists, with one blank line before and after each list.

## Render context

Supply every top-level input explicitly:

| Input                   | Type and item fields                                          |
| ----------------------- | ------------------------------------------------------------- |
| `project_name`          | Title string.                                                 |
| `repository_structure`  | Markdown string, empty when unused.                           |
| `execution_rules`       | List of repository execution-rule strings.                    |
| `standard_tasks`        | List of mappings with `command` and `description`.            |
| `architecture_sections` | List of mappings with `title` and `items`, a list of strings. |
| `development_tools`     | List of mappings with `name` and `description`.               |
| `package_rules`         | List of rule strings.                                         |
| `documentation_links`   | List of mappings with `when`, `title`, and `path`.            |
| `is_moonbit`            | Boolean, not a string, number, null, or collection.           |

Use empty lists for unused collections.
Task-specific links render their `when` condition with the destination link.
Use Jinja `StrictUndefined` and `keep_trailing_newline=True`; missing required fields and invalid `is_moonbit` values are render errors.

## File layout and aliases

The repository-root `AGENTS.md` owns shared repository instructions.
Package-level `AGENTS.md` files supplement it with package-specific rules.
`CLAUDE.md -> AGENTS.md` is a relative symlink to the same canonical content, not a separately rendered document.
The README `Development` section links here; consumer setup references link back to `README.md#setup`.

## MoonBit README layout

For MoonBit projects, the physical consumer document is `README.mbt.md`, with the relative symlink `README.md -> README.mbt.md`.
The conditional maintenance section records this layout and the `moon check README.mbt.md` and `moon test README.mbt.md` commands.
These are maintainer instructions and do not appear in the rendered consumer README.
Executable-example evidence follows the [sample contract](../internal/sample/spec.md#validation).

This layout follows the official [literate Markdown documentation](https://docs.moonbitlang.com/en/latest/language/docs.html) and [MoonBit tutorial](https://docs.moonbitlang.com/en/latest/toolchain/moon/tutorial.html).

## Provenance

Append this exact footer without a heading:

```markdown
_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
```

## Resource consistency

Keep this format, its template, and its sample aligned under the shared [template](../internal/template/spec.md) and [sample](../internal/sample/spec.md) contracts.
The authoring repository's `tests/share_artifact_agents_fixture.py` records the sample context, and `tests/share_artifact_agents_template_test.py` checks byte-reproducibility, empty and populated sections, conditional navigation, MoonBit branches, and missing or invalid context.
These are authoring resources, not dependencies of an installed skill or consuming project.
