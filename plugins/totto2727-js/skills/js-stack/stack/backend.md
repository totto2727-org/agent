# Cloudflare services and storage

## Product API and data

Use Projektor's split when a browser UI and an independent API need the same business operations. Its [Alchemy composition](https://github.com/totto2727-org/projektor/blob/4efeefc30821341ba1fb1990e814134f5057d546/alchemy.ts) defines Frontend, API, and Core Workers. Frontend and API receive a binding to Core. A public endpoint and an internal Worker binding are different interfaces: authorize the public operation and enforce its domain constraints in the common service. A small app with only one caller can keep these boundaries in one Worker.

Projektor's [DB entry point](https://github.com/totto2727-org/projektor/blob/4efeefc30821341ba1fb1990e814134f5057d546/src/db/index.ts) exposes Drizzle over D1. Keep that schema and query path for an existing Drizzle application. Its [dependencies](https://github.com/totto2727-org/projektor/blob/4efeefc30821341ba1fb1990e814134f5057d546/package.json) include Hono and the Cloudflare Workers OAuth provider. Neither is a prerequisite for an Effront application. Select authentication for the actual public client and trust boundary, not from the UI framework.

## Durable workflows

Use this profile when execution has an identity and must resume after the initiating request ends. In the [Flowdeck TypeScript design, PR #9](https://github.com/totto2727-org/flowdeck/pull/9), versioned workflow definitions use `@typeonce/effect-machine` for transitions and Effect for tasks. Execution and the graph shown to the operator come from the same definition. Persist checkpoints and ordered events separately from rendering. A browser refresh should read the existing run, not start another one. For a request that finishes synchronously, an ordinary Effect service needs none of this machinery.

The [application composition](https://github.com/totto2727-org/flowdeck/blob/344353786b1473ace559d0d07afc69c68baeb19c/src/user-land/application.ts) wires development and production Layers. The [database design](https://github.com/totto2727-org/flowdeck/blob/344353786b1473ace559d0d07afc69c68baeb19c/docs/database.md) uses Atlas HCL for the SQLite schema, Reylo for typed SQL imports, and Alchemy to apply versioned SQL to D1. Choose this route when SQL files are the query contract. Do not add Drizzle or a second migration owner alongside it. Containers are for tasks that actually need a process or sandbox, not for the dashboard itself.

Flowdeck's [default-branch baseline](https://github.com/totto2727-org/flowdeck/blob/839b4400f46d66dab03daaabfc7e2e90ed75ee9f/README.md) is the earlier Rust application. The PR is evidence for the TypeScript design, not an install target. In both profiles, use the target project's locked adapters and exercise real Worker bindings and migrations in addition to unit tests.
