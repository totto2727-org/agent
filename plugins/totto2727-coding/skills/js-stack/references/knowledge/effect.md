# Effect Version and Transport Constraints

For advanced Effect users who integrate HTTP codecs or change an installed Effect release.
Use [services and runtime](effect/services-runtime.md) when changing service identity, Layer outputs, or disposal ownership.

## Official sources and version checks

Use [Effect documentation](https://effect.website/docs/) and the [official repository](https://github.com/Effect-TS/effect).
Match API references to the installed release and adapter peer dependencies.
HTTP, CLI, Schema, Context, Layer, and runtime module locations can differ between versions.

## Migration Guide

Use the official [v4 migration guide](https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md) ([raw Markdown](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/MIGRATION.md)).

## Transport codecs

Use the official [Schema guide](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/SCHEMA.md) ([raw Markdown](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/SCHEMA.md)).
Match codec and decoder APIs to the installed release.
Select codecs for the actual transport, such as JSON, form data, or URL parameters.
Keep HTTP contract schemas within the supported Effect HTTP API, not a parallel transport type system.

## How to Refresh

Match these moving `main` sources to the installed release's revision or published declarations before updating guidance.
A source link does not authorize a dependency migration.
