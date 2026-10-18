# CLI Composition

Use Effect CLI for new command-line applications and approved migrations, including parsing and help generation.
Keep existing CLI contracts during unrelated maintenance.

Check CLI exports against the [installed Effect version](../knowledge/effect.md).
An older `@effect/cli` example can use a different module from the installed release.
Do not introduce hand-written `process.argv` parsing or another CLI framework for new commands.

Use the installed Effect platform APIs for filesystem, process, HTTP, and terminal access where available.
Keep Promise conversion at required host or SDK adapters.

Use [shared JS tooling](share.md) for packaging, including Bun for Nix application builds.
That build choice does not select Bun for dependency management or production hosting.
