# Parcel Peek

Read one parcel as JSON with the exported `parseArgs` and `peek` APIs.
Set `--encoding utf8 --retries 0 --format json` explicitly for predictable output.
Use `--timeout 500` for the timeout in milliseconds.
The managed profile uses concurrency 2 to respect the provider's quota.
Supply authorization at the runtime boundary, not on the command line.
