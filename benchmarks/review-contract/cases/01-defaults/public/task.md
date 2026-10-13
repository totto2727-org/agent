# Remove redundant configuration

Parcel Peek reads one parcel through an injected transport and returns JSON.
The transport defaults to UTF-8 decoding and zero retries. JSON is the only supported output format.
Remove the unnecessary `--encoding`, `--retries`, and `--format` options and their runtime/default overrides, rather than adding more configuration.
These removed options must now be rejected as unknown, including when supplied with their former default values.
Keep `--timeout` with a default of 500 ms and positive-integer validation, and keep the managed profile's concurrency of 2 rather than the transport default of 8.
Keep authorization forwarding and JSON output, including Unicode data.
Update the README to describe the current interface, without a migration log.
Add focused tests. The managed profile is an intentional customization, not a redundant default.
