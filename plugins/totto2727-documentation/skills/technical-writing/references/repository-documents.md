# Repository document outlines

Follow the repository's existing template. If there is none, use the outline for the reader's task and omit empty sections.

## README: use the project

1. State what the project does and who can use it.
2. Show one supported public operation and its result. For a CLI, give a command and its output. For a library, show a call and its return value.
3. List the prerequisites for the default route. Present alternative installation methods as choices, not successive steps. Put route-specific prerequisites before the command that needs them.
4. Link directly to the public reference or usage example. Link to AGENTS.md for repository maintenance rather than including development setup. Identify the license.

## AGENTS.md: change the project

1. State where to run commands and which environment they require.
2. List the commands contributors actually use. Distinguish checks that exercise behavior from formatting and static checks.
3. Explain only architecture or package constraints that affect a change. Link each specialized guide from the task that needs it.

Keep shared instructions at the root. Put package-specific differences in the package guide.
For example, if `README.md` links to a canonical `README.mbt.md`, say which file to edit and how to run its executable examples in the real package.

## ADR: record a decision

Use the project's ADR location and approval convention. If none exists, `docs/adr/YYYY-MM-DD-short-title.md` is a useful starting point.

- **Context:** Which problem and constraints required a decision?
- **Decision:** What did the owner choose, and why? Mark a proposal as unapproved until the decision owner confirms it.
- **Alternatives:** Which realistic options were rejected, and on what grounds?
- **Consequences:** What changes for existing users, and what costs or constraints does the team accept?

If the decision changes, write a new record and link both records. Do not rewrite the original rationale to match the new decision.
