# README specification

This specification defines the end-user-facing document. Its companion minimum form is [template.md](template.md), and [sample.md](sample.md) is a concrete rendered output. Read this specification before rendering or extending the template.

## Audience and decision rule

`README.md` serves end users first: it explains what the project does and how to use it. Use the end-user test: if a person who only wants to use the project needs the information, it belongs here. If an AI agent or contributor needs it to modify, build, test, or operate the repository, it belongs in [the AGENTS specification](../agents/spec.md).

| Content                                                                                                                        | README.md                              | AGENTS.md                              | Decision                                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Project overview, user-visible features, usage examples, end-user prerequisites and setup, external documentation, and license | Yes                                    | No                                     | Explain the user outcome and the smallest usable path.               |
| Detailed build, test, lint, deploy, CI, task, or contributor commands                                                          | No                                     | Yes                                    | These are developer and AI execution instructions.                   |
| Repository structure, architecture, package management, path aliases, conventions, development tools, and AI constraints       | No                                     | Yes                                    | These govern work on the repository.                                 |
| Full CLI reference                                                                                                             | Brief summary and link only            | Yes                                    | Keep the complete operational reference with the developer audience. |
| Contribution guidance                                                                                                          | Link to a dedicated guide when present | No                                     | Do not turn the README into a contributor manual.                    |
| A cross-reference needed by both audiences                                                                                     | Brief summary and link                 | Detailed form for its primary audience | Keep one source of truth; do not duplicate the detailed text.        |

## Required output and minimum order

Render the sibling [template.md](template.md) as the project `README.md` unless the MoonBit exception below applies. The minimum form uses this order:

1. Title and one-paragraph overview
2. Usage
3. Key features
4. Prerequisites
5. Setup
6. Development — one short link to `AGENTS.md`, without operational detail
7. Documentation — required provenance links when the template includes it
8. License

The minimum form may be extended with purpose-specific end-user sections, provided the required sections remain in this order, `License` stays last, and the extension does not introduce developer, contributor, AI, or internal-operation guidance. An extension must not replace the sibling template or sample with an old role-based template path.

## Shared content and updates

For shared content, write the detailed version in the document serving the primary audience, then add only a brief summary and relative link in the other document. For example, README may link to `./AGENTS.md#development-commands`; AGENTS may link to `./README.md#setup` for end-user setup.

When updating an existing project:

1. Read its existing `README.md` and `AGENTS.md` first.
2. Classify the proposed content using the table and end-user test.
3. Update only the correct document, preserving its required order.
4. When the content serves both audiences, split it using the shared-content link rule.
5. Preserve valid local links and use the sibling [template.md](template.md) and [sample.md](sample.md) as the current authoring references.

## Corrections for common mistakes

Do not add AI rules such as “never use npx” to README; move them to `AGENTS.md` and retain only the Development link. Do not put detailed build, test, lint, or contributor setup commands in README; those commands fail the end-user test and belong in `AGENTS.md`. Do not add repository architecture or directory structure to README merely because it is useful to developers.

## MoonBit exception

For a MoonBit project, render the sibling [template.md](template.md) to canonical `README.mbt.md`, then make `README.md` a relative symlink: `README.md -> README.mbt.md`. Keep the Markdown and its supported MoonBit code blocks valid for `moon check README.mbt.md` and `moon test README.mbt.md`. Do not maintain a second independently authored README.

This layout follows MoonBit’s official literate Markdown documentation: <https://docs.moonbitlang.com/en/latest/language/docs.html>. The relative symlink layout is documented in the official MoonBit tutorial: <https://docs.moonbitlang.com/en/latest/toolchain/moon/tutorial.html>.
