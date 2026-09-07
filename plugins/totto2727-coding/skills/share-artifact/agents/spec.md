# AGENTS specification

This specification defines the AI-agent and developer-facing document. Its companion minimum form is [template.md](template.md), and [sample.md](sample.md) is a concrete rendered output. Use the applicable constraints when authoring or reviewing repository guidance.

## Audience and decision rule

`AGENTS.md` tells AI agents and developers how to work correctly in the repository. Use the AI-agent test: if an agent needs the information to modify, build, test, or operate the project safely, it belongs here. Information that an end user needs to understand, install, or use the project belongs in [the README specification](../readme/spec.md).

| Content                                                                                                        | README.md              | AGENTS.md                                     | Decision                                         |
| -------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------- | ------------------------------------------------ |
| End-user overview, usage, features, prerequisites, setup, external user documentation, and license             | Yes                    | No                                            | Keep the user-facing explanation in README.      |
| Build, test, lint, format, deploy, CI, task, package-targeting, and contributor commands                       | No                     | Yes                                           | Give AI agents the complete executable guidance. |
| Repository structure, architecture, package management, aliases, conventions, tools, and execution constraints | No                     | Yes                                           | These are the repository’s operating rules.      |
| Repository development and operation command reference                                                         | No                     | Yes                                           | AGENTS is the canonical developer reference.     |
| Shared setup or cross-reference                                                                                | Brief summary and link | Brief link to the end-user source when needed | Keep detailed content with its primary audience. |

## Required output and minimum order

Render the sibling [template.md](template.md) as `AGENTS.md` with a project title and the provenance footer below.
Between them, include only relevant repository-specific context, in this order when present:

1. Repository structure: selected non-obvious paths, not an exhaustive tree
2. Development commands: execution rules and standard tasks, independently optional when genuinely inapplicable
3. Architecture: boundaries or invariants that affect safe changes
4. Development tools: non-obvious behavior not already explained by commands
5. Package-specific rules when applicable
6. Task-specific documentation: conditional navigation to detailed sources
7. MoonBit README maintenance when applicable

Omit irrelevant sections instead of filling headings with generic advice.
Do not omit applicable safety boundaries, environment requirements, working directories, or actual build, test, and operation commands merely to shorten the document.
Keep commands exact, including required flags, targets, and prerequisites; their descriptions explain applicability rather than requiring every task for every edit.
Do not invent an always-read checklist or a run-full-tests workflow.
The model chooses its investigation and validation scope within the repository's actual operational constraints.

Use task-specific documentation links when detailed guidance has a separate owner.
Each link states when it is relevant and points directly to the maintained source, rather than requiring all linked documents to be read for every task.
Keep shared safety and execution constraints visible in AGENTS even when detail is delegated.

The minimum form may be extended with justified repository-specific AI and developer sections, provided present sections stay ordered and the extension does not become an end-user getting-started guide.

### Render context and validation

Supply `project_name`, `repository_structure`, `execution_rules`, `standard_tasks`, `architecture_sections`, `development_tools`, `package_rules`, `documentation_links`, and `is_moonbit` explicitly.
Use an empty string for irrelevant repository structure, empty lists for irrelevant collections, and a boolean for `is_moonbit` (reject strings, numbers, null, and collections); empty content is intentional, while a missing key is a render error under Jinja `StrictUndefined`.
Task entries contain `command` and `description`, architecture entries contain `title` and `items`, tool entries contain `name` and `description`, and documentation links contain `when`, `title`, and `path`.
In this skill's authoring repository, the named fixture `tests/share_artifact_agents_fixture.py` records sample context and provenance paths; `tests/share_artifact_agents_template_test.py` checks byte-reproducibility, empty and populated sections, conditional navigation, MoonBit branches, and missing context under `StrictUndefined` with `keep_trailing_newline=True`.
These fixture paths are authoring-repository validation resources, not files required in an installed skill or a consuming project.

Render consecutive single-paragraph bullet items as a tight list without blank lines between items. Keep one blank line before and after the list so adjacent headings and paragraphs remain distinct.

End the file with this exact provenance footer without a heading:

```markdown
_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
```

The footer identifies only the sources used to create the current `AGENTS.md`; it is not a project documentation index.

## Root, package, and alias rules

The repository-root `AGENTS.md` is the canonical shared AI context. Create a package-level `AGENTS.md` only when that package has unique AI or developer rules not already covered by the root file; it supplements the root instead of duplicating it.

`CLAUDE.md -> AGENTS.md` is a relative symlink alias for the same canonical content. Never create a separate `CLAUDE.md` template or allow `CLAUDE.md` and `AGENTS.md` to diverge.

## Shared content and updates

For content serving both audiences, keep the detailed version with its primary audience and add a short relative link elsewhere. For example, AGENTS may link to `./README.md#setup` for consumer installation, while README may link to `./AGENTS.md#development-commands` for repository development commands. End-user CLI commands and generated help remain governed by the README specification; AGENTS documents only commands for modifying, building, testing, or operating the repository.

Updates preserve these invariants:

- Existing repository-specific constraints and applicable package rules remain authoritative unless the requested change supersedes them.
- Shared rules have one owner at the root; package documents contain only unique local context.
- Cross-audience content retains the shared-content link rule and valid local links.
- The `CLAUDE.md -> AGENTS.md` alias remains intact, and the sibling [template.md](template.md) and [sample.md](sample.md) remain the authoring references.

## Corrections for common mistakes

Do not place an end-user project description, installation walkthrough, marketing highlights, or license text in AGENTS; move it to README. Do not create divergent `CLAUDE.md` content; make it the `AGENTS.md` alias. Do not create a package AGENTS file that repeats the root document; add one only for unique local rules. Do not conceal build or test commands in README: they belong in AGENTS under Development commands.

## MoonBit README maintenance

For MoonBit projects, keep the canonical end-user content in the physical `README.mbt.md` file and maintain `README.md` as the relative symlink `README.md -> README.mbt.md`. Validate supported MoonBit blocks with `moon check README.mbt.md` and `moon test README.mbt.md`. This is maintainer guidance for AI agents and developers; never render canonical-file or symlink-maintenance instructions into the end-user README.

This layout follows MoonBit’s official literate Markdown documentation: <https://docs.moonbitlang.com/en/latest/language/docs.html>. The relative symlink layout is documented in the official MoonBit tutorial: <https://docs.moonbitlang.com/en/latest/toolchain/moon/tutorial.html>.
