# Effect Knowledge Index

Use this index for exact Effect API verification and reusable composition conventions.
Read the project's manifest and resolved lockfile first, including adapter peer dependencies.
The installed version is the execution contract, not a moving upstream branch or an old example.
Do not infer that all projects use a beta release or the same major version.

- Read [services and runtime](effect/services-runtime.md) when defining service exports, composing Layers, or selecting runtime lifetime.
- Read [Schema integration](effect/schema.md) when choosing decoders, encoders, or serialization contracts.
- Use [backend composition](../stack/backend.md), [frontend composition](../stack/frontend.md), or [CLI composition](../stack/cli.md) for cross-library wiring.
- Use [js-coding](../../../js-coding/SKILL.md) for generic Effect-first principles and anti-patterns.

## Official sources and version checks

Start with [Effect documentation](https://effect.website/docs/) and the official [Effect repository](https://github.com/Effect-TS/effect).
For v4 API changes, consult the official [migration guide](https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md) and [Schema guide](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/SCHEMA.md).
These `main` links are discovery entries, not version-pinned evidence for a resolved dependency.
Match the source revision or published package declarations to the installed version before copying an import or signature.
Use [raw migration Markdown](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/MIGRATION.md) or [raw Schema Markdown](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/SCHEMA.md) when a text source is needed.
Check HTTP, CLI, Schema, Context, Layer, and runtime APIs independently because their module locations can change between versions.
If documentation and installed declarations disagree, report that discrepancy and resolve it before teaching an example.

## Migration Guide

Use the official migration guide above for import renames, package consolidation, services, causes, forking, and yieldable APIs.
Do not start a dependency migration merely to follow a source link.

## Schema Guide

Use the official Schema guide above for codecs, decoding, encoding, filters, serialization, and migration mappings.
Keep organization-specific boundary decisions in the linked Schema integration reference rather than copying upstream documentation.

## How to Refresh

Recheck the installed release and its official source before updating guidance.
Do not treat the latest `main` content as the authoritative contract for an older installed release.
