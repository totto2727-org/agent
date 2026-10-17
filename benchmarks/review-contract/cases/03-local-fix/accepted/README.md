# Dock Queue

Call `render(input, format, token, expected)` to list queued job names.
Both `text` and `json` accept LF or CRLF delimiters and omit empty records, without changing their order.
Spaces and bare carriage returns inside names remain data.
Text joins records with LF. JSON returns an ordered array of the same records.
Supply `Bearer <expected>` as the token.
See [output details](docs/output.md).
