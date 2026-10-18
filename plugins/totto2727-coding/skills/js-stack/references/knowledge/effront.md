# Effront Integration

Use this reference when selecting Effront packages, conditional imports, or deployment adapters.
Use the maintained [Effront repository](https://github.com/totto2727-org/effront) as the source entry point and follow its documentation for the installed release.
Do not use another application's local checkout path as a permanent integration dependency.

Effront composes React Server Components, SSR, browser behavior, and native Effect HTTP.
Its Alchemy adapter is separate from core.
Read the installed package exports and documentation before selecting RSC, SSR, or browser imports.
Check Effect, React, Vite, and Alchemy peer compatibility together rather than installing independently selected latest versions.
Keep actual versions in the manifest and lockfile, subject to [dependency safeguards](../stack/share.md#dependency-versions).

Use the [frontend profile](../stack/frontend.md) for execution-environment boundaries and the [backend profile](../stack/backend.md) for HTTP, authentication, and database wiring.
Do not add an independent Hono server to replace Effront's native Effect HTTP integration.
Do not infer a working Workers, Containers, Node, or Bun adapter from a framework-level claim alone.
Verify the adapter's supported host and lifecycle with the installed release and the actual build.
Keep development runtime selection distinct from the required Workers-first service-host policy.
