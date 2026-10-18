---
name: js-coding
description: >-
  Apply Effect-TS-first implementation principles when writing or reviewing JavaScript and TypeScript types, boundaries, state, errors, collections, strings, dates, or HTTP operations.
  Use js-stack for toolchain selection and application composition, and js-test for test implementation.
---

# Effect-TS Coding Index

Implementation choices for advanced TypeScript users.
Use [share-coding](../share-coding/SKILL.md) for language-independent design and [js-stack](../js-stack/SKILL.md) for application composition.

## Write Effect-TS, not plain TypeScript

Use Effect APIs wherever they provide the operation, including pure data operations and HTTP, not only I/O wrappers.

| Concern        | Effect APIs                                                                             |
| -------------- | --------------------------------------------------------------------------------------- |
| Collections    | `Array`                                                                                 |
| Strings        | `String`                                                                                |
| Dates and time | `DateTime`, `Clock`                                                                     |
| Outbound HTTP  | `HttpClient`, `HttpClientRequest`, `HttpClientResponse`                                 |
| Server HTTP    | `HttpServerRequest`, `HttpServerResponse`, `HttpApi`, `HttpApiGroup`, `HttpApiEndpoint` |

Use pure Effect data APIs directly, without an `Effect` wrapper.
Keep native APIs at required host or third-party boundaries, or in a small adapter when Effect lacks the capability.
Use imports supported by the [installed Effect version](../js-stack/references/knowledge/effect.md).

These defaults do not authorize upstream-first fork rewrites or unnecessary Effect dependencies in public libraries.
Use [Effect CLI](../js-stack/references/stack/cli.md) for new CLIs and approved migrations.

## Reference routing

- [Anti-patterns](references/anti-patterns.md)
- [Effect Schema integration](../js-stack/references/knowledge/effect/schema.md)
- [Service exports, Layers, and runtimes](../js-stack/references/knowledge/effect/services-runtime.md)
- [Package manager](../js-stack/references/stack/share.md#package-manager) and [dependency versions](../js-stack/references/stack/share.md#dependency-versions)
- [Test implementation](../js-test/SKILL.md)

## Existing integrations

For existing Remix code: [client events](references/remix-client-events.md).
Use [Effront](../js-stack/references/stack/frontend.md) and [Effect HTTP plus Alchemy](../js-stack/references/stack/backend.md) for new applications.

Use [IME-safe submission](references/ime-safe-enter-submit.md) for custom browser Enter-to-submit behavior.
