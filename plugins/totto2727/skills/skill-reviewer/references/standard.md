# Agent Skills Standard

Use the [official Agent Skills specification](https://agentskills.io/specification) as the authority for standard format findings.
The checks below summarize its format constraints and distinguish them from recommendations.
Client extensions are a separate compatibility concern, not evidence of a standard requirement.

## Standard constraints

A skill directory contains a file named `SKILL.md` with YAML frontmatter delimited by `---`, followed by Markdown content.
The frontmatter requires `name` and `description`.

| Field           | Constraint                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | 1–64 characters. Lowercase Unicode alphanumeric characters and hyphens only. No leading or trailing hyphen and no consecutive hyphens (`--`). Must match the parent directory name. |
| `description`   | 1–1024 characters. Describes what the skill does and when to use it.                                                                                                                |
| `license`       | Optional license name or reference to a bundled license file.                                                                                                                       |
| `compatibility` | Optional string, 1–500 characters when present. Include only when the skill has environment-specific requirements.                                                                  |
| `metadata`      | Optional mapping from string keys to string values.                                                                                                                                 |
| `allowed-tools` | Optional, experimental space-delimited string of pre-approved tools. Client support varies.                                                                                         |

Check parsed YAML values, not raw line lengths or quoting syntax.
For example, an unquoted numeric value in `metadata` is not a string merely because it looks like a version.
Do not treat `allowed-tools` as a portable security boundary or assume every client enforces it.

The body has no required format or section structure.
`scripts/`, `references/`, and `assets/` are optional, and other files or directories are permitted.
The standard does not prohibit particular vendor names or XML angle brackets.

## Recommendations, not validity thresholds

The specification recommends keeping the main body under approximately 5,000 tokens and `SKILL.md` under 500 lines, with supporting detail loaded as needed.
Exceeding either is a reason to examine reading cost, not a format failure.
References should be easy to locate and shallow enough to discover without following a long chain.
A short self-contained skill need not add reference files just to create multiple layers.

There is no minimum description length beyond the required nonempty 1-character lower bound, prescribed keyword count, mandatory trigger phrase, or universal workflow shape.
Judge clarity and usefulness separately from length validity.

For optional design and evaluation reading, see [Sources](sources.md).
