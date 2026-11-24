---
name: js-stack
description: Choose a TypeScript stack for a Cloudflare web application, durable workflow, native macOS GUI, or standalone CLI.
---

# Choose a TypeScript application stack

| What must run?                                                          | Start with                                                                                                                             | Read                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A browser product with pages, forms and a public or agent-facing API    | Effront and React for pages, Effect services behind Cloudflare Worker boundaries. Projektor is the reference.                          | [Web UI](stack/frontend.md) and [services and storage](stack/backend.md#product-api-and-data) |
| A workflow that pauses, survives refresh, and resumes from a checkpoint | An Effect Machine definition, persisted run state and events, with a separate Effront inspection UI. Flowdeck is the reference design. | [Durable workflows](stack/backend.md#durable-workflows)                                       |
| A native macOS window, menu, or popup that needs OS integration         | NSH hosts TypeScript/TSX. Share Effect application services with other entry points. GlossShift is the reference design.               | [Native GUI](stack/desktop.md)                                                                |
| A command used in scripts or a pipeline                                 | Effect CLI on Node, with no desktop host or UI permission requirement.                                                                 | [CLI](stack/cli.md)                                                                           |

Use the [toolchain guide](stack/share.md) for builds and checks. Start with one entry point unless the product needs another. Choosing React does not imply a Worker backend, and choosing TypeScript does not imply a browser GUI.

For a Hono migration, use the installed [effect-http skill](https://github.com/totto2727-org/effect-http/blob/main/.agents/skills/effect-http/SKILL.md); it owns the public import map and its coverage check.
