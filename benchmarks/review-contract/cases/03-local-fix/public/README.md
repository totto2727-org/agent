# Dock Queue

Call `render(input, format, token, expected)` to list queued job names.
Text output splits LF lines and joins nonempty records with LF. JSON returns an ordered array.
Formats are `text` and `json`. Supply `Bearer <expected>` as the token.
See [output details](docs/output.md).
