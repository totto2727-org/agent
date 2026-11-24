# Toolchain by runtime

Projektor and Flowdeck use pnpm and Vite+ for development. A Node-based build does not make Node the deployed runtime: Alchemy bundles Workers, NSH hosts the native GUI, and Node runs the standalone CLI. Read the project's locked package and host configuration before selecting a build or test command.

## Dependency versions

Treat Effect, Effront, Alchemy, and the Vite adapter as a compatible set. Resolve version and release-age requirements from the project, not from a reference application's manifest. For a `rules/<id>` diagnostic, use the [Oxlint library's guide](https://github.com/totto2727-org/oxlint/blob/main/skills/oxlint/SKILL.md), not a second set of rules here.

## Testing

Choose the environment that implements the behavior: Vitest for pure logic, the Cloudflare Workers Vitest integration for service bindings and D1, and Playwright for the browser. Exercise NSH-specific features in the native host, not jsdom. In Flowdeck, SQL module type inference is part of the [project's check task](https://github.com/totto2727-org/flowdeck/blob/344353786b1473ace559d0d07afc69c68baeb19c/docs/database.md), not something a passing unit test establishes.
