# Parcel Peek

Read one parcel as JSON with the exported `parseArgs` and `peek` APIs.
Use `--timeout 900` to set a positive integer timeout in milliseconds. The default is 500 ms.
The transport supplies UTF-8 decoding and zero retries. JSON is the only output format.
The managed profile uses concurrency 2 to respect the provider's quota.
Supply authorization at the runtime boundary, not on the command line.
