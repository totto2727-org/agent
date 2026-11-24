# Mechanical checks

## Fenced-code language

`code-fence-language` checks whether each fenced code block has a language label.
This review supplement supports visual distinction and syntax highlighting; an omitted label is not by itself invalid GFM syntax.
Use `text` for literal non-executable output when the project has no more specific convention.
The check does not validate the label, compile the code, or prove rendering support.
An unclosed fence is a source defect, not a successful language declaration.
Required exact quotations or prescribed templates need a specific exception proposal; do not relabel protected source silently.

## Explicit prohibited terms

Use `check.kind: "prohibited-terms"` only for a known, exact project restriction.
Configure `terms`, optional `protectedTerms`, and optional `caseSensitive`.
The checker compares whole tokens in eligible prose, excluding code, URLs, HTML markup, frontmatter, and explicit heading IDs.
For example, a project can prohibit its retired product name in current instructions while protecting a required case-sensitive API identifier.
This is not the STE dictionary: a token list does not establish permitted meanings, parts of speech, or technical-name exceptions.
Do not create a guessed STE banned-word list.

## Interpretation

Run the checker without credentials using `--mechanical-only`.
Inspect each reported source location before making a content change.
A deterministic finding establishes the configured property, not every reason the passage might be wrong.
Semantic checks remain deferred and review-required in this mode.
