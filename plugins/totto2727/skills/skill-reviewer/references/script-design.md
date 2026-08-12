# Script Design

Read this reference when the target skill contains scripts or complex executable commands. Evaluate the interface from an agent's perspective rather than requiring a particular implementation language.

## Choose commands or scripts

Reference an existing tool directly when the command is short, clear, and unlikely to be reconstructed incorrectly. Bundle a tested script when logic is repeated, complex, fragile, or error-prone.

For one-off tools:

- Pin versions when reproducibility matters.
- State prerequisites and environment requirements.
- Follow the target project's execution and package-manager rules.

For bundled scripts:

- Reference them with paths relative to the skill root.
- List available scripts and show representative invocations in `SKILL.md`.
- Make dependencies self-contained or document them clearly.
- Keep dependency versions reproducible at the level justified by the task.

## Design an agent-usable interface

Scripts used in normal operation must not depend on TTY prompts, password dialogs, or confirmation menus. Accept inputs through flags, environment variables, or standard input and fail promptly when required values are missing.

Provide concise `--help` output with:

- A short purpose statement.
- Required arguments and available flags.
- Defaults and accepted values.
- One or two representative examples.
- Documented exit-code meanings when distinct failure classes affect recovery.

Write actionable errors that state what failed, what was expected, what was received, and how to correct the invocation.

Use structured output when downstream automation needs to parse the result. Keep data on stdout and diagnostics on stderr. For human-oriented output, prefer a stable, concise format rather than forcing JSON without a consumer.

## Make retries and failures safe

Evaluate safeguards according to risk:

- Make repeated execution idempotent where practical.
- Reject ambiguous inputs instead of guessing.
- Provide dry-run support for destructive or stateful plans when previewing can reduce risk.
- Choose safe defaults and require explicit flags for dangerous behavior.
- Use meaningful nonzero exit codes and document recovery-relevant distinctions.
- Bound large output with summaries, limits, pagination, or an explicit output-file option.

Verify scripts by executing representative normal, invalid-input, and help cases. Record the command, exit status, stdout or output artifact, and stderr. Do not award executed evidence based only on source inspection.
