# Complete Hono import-path migration map

For developers planning or reviewing a Hono-to-Effect migration.
Every row is a public import path, not an individual named export.
Read the linked recipe to perform the migration; the target column alone does not establish behavior parity or ready middleware.

## Contents

- [Baselines and coverage](#baselines-and-coverage)
- [Core](#core)
- [Middleware](#middleware)
- [Helpers](#helpers)
- [Routers](#routers)
- [JSX and DOM](#jsx-and-dom)
- [Host adapters](#host-adapters)
- [Utilities](#utilities)
- [Additional implementation](#additional-implementation)

## Baselines and coverage

- Hono 4.13.18: [`f6fbaf0299c48eea9e656e03e2ffe7ac755e8823`](https://github.com/honojs/hono/tree/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823).
- Effect 4.1.4: [`3e2030b43e86a60113f2f32671076ff3b1d84ce4`](https://github.com/Effect-TS/effect/tree/3e2030b43e86a60113f2f32671076ff3b1d84ce4).
- effront scope: [`3c8c55c8f99242b0c45c5a672fe3ea22f9e26614`](https://github.com/totto2727-org/effront/tree/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614).
- Maintained package policy: [effect-http correspondence table at `918fae1`](https://github.com/totto2727-org/effect-http/blob/918fae1eb08089b736e03e833b4a90f3ec8f845b/docs/hono-compatibility.md).

Hono's [exports](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/package.json) contain 76 literal paths and one `./utils/*` pattern.
Its [unbundled build](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/vite.config.ts) emits 28 non-test utility modules for that pattern.
The inventory is therefore **104 concrete paths: 54 Effect, 21 effront, 6 effect-http, and 23 excluded**.
All 81 non-excluded paths have concrete instructions below and a local recipe link.
Keep `hono/utils/jwt` and `hono/utils/jwt/index` as separate rows, although they resolve to one implementation.
External `@hono/*` packages and unexported `hono/context` or `hono/package.json` are not part of this baseline.

`Effect` means existing primitives can meet the general need, not that a ready middleware exists.
For authentication middleware, the `Effect` classification records available primitives, not the recommended integration.
`effect-http` means an existing shipped source API, not an unimplemented proposal or proof of npm publication.
`effront` means application or host work that must not be reimplemented in effect-http.
`Excluded` always includes a specific reason; it never means to silently delete a feature from a user's app.
All `Http*`, `Headers`, `Cookies`, `Mime`, `Url`, and `UrlParams` names use `effect/http` unless a recipe says otherwise.
`HttpApi*` uses `effect/http-api`, crypto services use `effect/crypto`, encoding uses `effect/encoding`, and IP APIs use `effect/net`.

## Core

| Hono path             | Owner    | Concrete migration                                                                                                                                                   | Recipe                                            |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `hono`                | effront  | Build `Application.effront()` pages/routes and export its application definition; use `HttpRouter` for standalone APIs.                                              | [Application](effront.md#application-and-factory) |
| `hono/request`        | Effect   | Yield `HttpServerRequest.HttpServerRequest`; decode body, search parameters, and headers with its schema readers instead of storing `.valid()` results.              | [Requests](core.md)                               |
| `hono/types`          | Excluded | Hono Env, middleware, and route-inference types describe Hono's own framework contract. Use Effect environment/error types; do not recreate its type system.         | Not applicable                                    |
| `hono/hono-base`      | effront  | Replace the base app class with one application-bound effront factory and its routes/middleware; do not subclass a compatibility Hono base.                          | [Application](effront.md#application-and-factory) |
| `hono/tiny`           | Excluded | This is a Hono router-size preset, not a missing HTTP policy. Select the target router rather than recreate a Hono preset.                                           | Not applicable                                    |
| `hono/quick`          | Excluded | This is a Hono startup-performance preset. Its router-selection implementation has no compatibility requirement in the target application.                           | Not applicable                                    |
| `hono/http-exception` | Effect   | Represent expected failures with `Data.TaggedError`, recover at the HTTP boundary, and declare HttpApi error schemas/statuses where used.                            | [Typed failures](core.md)                         |
| `hono/client`         | Effect   | Define a shared `HttpApi`, derive `HttpApiClient`, and inject an HTTP client; use `HttpClient` directly for untyped upstreams.                                       | [Clients](core.md)                                |
| `hono/validator`      | Effect   | Move each target's validation to `Schema` and `HttpServerRequest.schemaBodyJson`, form/header readers, or `HttpApiEndpoint` schemas; map decode failures explicitly. | [Validation](core.md)                             |

## Middleware

| Hono path                 | Owner       | Concrete migration                                                                                                                                                                                      | Recipe                                                              |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `hono/basic-auth`         | Effect      | Use Better Auth for application authentication. If clients still require Basic credentials and a `WWW-Authenticate` challenge, verify that contract. `HttpApiSecurity.basic` only extracts credentials. | [Authentication](middleware.md#authentication)                      |
| `hono/bearer-auth`        | Effect      | Use Better Auth for application authentication. Verify which Bearer credentials clients must still be able to use. `HttpApiSecurity.bearer` only extracts the token.                                    | [Authentication](middleware.md#authentication)                      |
| `hono/body-limit`         | Effect      | Set `HttpIncomingMessage.MaxBodySize` around body reads, bound decompression output, and map actual size-limit failures to 413; unread bodies are not prechecked automatically.                         | [Body limits](middleware.md)                                        |
| `hono/ip-restriction`     | Effect      | Read the peer `remoteAddress`, parse configured CIDRs with `IpNetwork`, and deny unmatched peers before the handler; only trust forwarding from configured proxies.                                     | [Access control](middleware.md)                                     |
| `hono/cache`              | effect-http | Acquire one bounded `ResponseCache` per public sharing boundary, declare all Vary inputs, apply `CacheControl`, and invalidate after writes.                                                            | [Cache](standalone-policies.md#cache-policy-and-response-storage)   |
| `hono/combine`            | Effect      | Replace `next()` branching with typed Effect composition and conditional selection of wrappers; distinguish denial from a recoverable alternative.                                                      | [Composition](middleware.md)                                        |
| `hono/compress`           | Effect      | Apply `HttpMiddleware.compression` and, separately, bounded `decompression`; verify deferred transforms through the actual response boundary.                                                           | [Compression](middleware.md)                                        |
| `hono/context-storage`    | Effect      | Define request-local Context services, provide them around the current handler, and yield them downstream instead of reading a global Hono context.                                                     | [Request services](middleware.md)                                   |
| `hono/cors`               | Effect      | Configure `HttpMiddleware.cors` origins, methods, credentials, and headers; test preflight and denial independently from authentication or CSRF.                                                        | [CORS](middleware.md)                                               |
| `hono/csrf`               | effect-http | Wrap unsafe endpoints with `Csrf.middleware` before writes, configure exact trusted origins, and handle a no-store 403 without executing the protected Effect.                                          | [CSRF](standalone-policies.md#csrf-and-security-headers)            |
| `hono/etag`               | effect-http | Use `ConditionalRequest` for bounded dynamic representations, inject Digest at the root, and evaluate write preconditions before mutations.                                                             | [Conditionals](standalone-policies.md#validators-and-preconditions) |
| `hono/jsx-renderer`       | effront     | Move the document shell and route renderer to application-bound `Layout` and `Page` definitions with the effront Vite pipeline.                                                                         | [Rendering](effront.md#jsx-and-html)                                |
| `hono/jwk`                | Effect      | Use Better Auth for application authentication. If a separate integration still verifies tokens against a trusted key set, use `Jwks` and `Jwt.verifyWithKeySet`.                                       | [Authentication](middleware.md#authentication)                      |
| `hono/jwt`                | Effect      | Use Better Auth for application authentication. For separate token verification, use `Jwt.verify` with the required issuer, audience, and expiry checks.                                                | [Authentication](middleware.md#authentication)                      |
| `hono/language`           | Effect      | Read allowed query/cookie/path values in a defined order, fall back to `Accepts` language negotiation, then provide the selected locale and correct Vary policy.                                        | [Locale policy](middleware.md)                                      |
| `hono/logger`             | Effect      | Apply `HttpMiddleware.logger`, configure Effect Logger output, and annotate application logs; do not depend on Hono's line formatting.                                                                  | [Logging](middleware.md)                                            |
| `hono/method-not-allowed` | Excluded    | Automatic Allow discovery depends on router route inventory and post-404 policy. Define explicit allowed methods in the app rather than transplant Hono match-history inspection.                       | Not applicable                                                      |
| `hono/method-override`    | Excluded    | Rewriting methods from forms or queries changes routing and CSRF boundaries. It requires an explicit application contract and is not a generic compatibility policy here.                               | Not applicable                                                      |
| `hono/mount`              | Effect      | Adapt a Web handler with `HttpEffect.fromWebHandler`, route it under a prefix, and explicitly choose whether the upstream sees the full or stripped path.                                               | [Web mounting](middleware.md)                                       |
| `hono/powered-by`         | Effect      | Set or remove a response header with `HttpServerResponse` setters; keep identification opt-in because the default security policy removes it.                                                           | [Response transforms](middleware.md)                                |
| `hono/pretty-json`        | Effect      | At the JSON producer, serialize with `JSON.stringify(value, null, 2)` and return a JSON content type; avoid draining arbitrary downstream bodies.                                                       | [Response transforms](middleware.md)                                |
| `hono/request-id`         | Effect      | Validate or replace an incoming ID, generate with caller-supplied `SecureRandom.uuidV4`, provide a Context service, and propagate it to logs and the response.                                          | [Request identity](middleware.md)                                   |
| `hono/secure-headers`     | effect-http | Apply `SecureHeaders.middleware` outside denial/error mapping as required; explicitly opt into deployment-compatible CSP and HTTPS-only HSTS.                                                           | [Headers](standalone-policies.md#csrf-and-security-headers)         |
| `hono/serve-static`       | effront     | Configure trusted asset roots/prefixes in native `serve` or `withAssets`, or use the Workers asset binding; retain built-in ranges and file validators.                                                 | [Assets](effront.md#static-assets)                                  |
| `hono/timeout`            | Effect      | Bound handler execution with `Effect.timeoutOrElse`, interrupt the losing work, and choose an explicit HTTP response; separately bound streaming bodies when required.                                  | [Timeout policy](middleware.md)                                     |
| `hono/timing`             | Effect      | Measure with Clock and spans, choose safe Server-Timing metric names, and add a response header without claiming deferred-body duration was measured.                                                   | [Timing](middleware.md)                                             |
| `hono/trailing-slash`     | Effect      | Use `HttpRouter.RouterConfig.ignoreTrailingSlash` for matching; use an explicit safe redirect policy if a canonical URL is required, preserving the query.                                              | [Canonical URLs](middleware.md)                                     |

## Helpers

| Hono path        | Owner       | Concrete migration                                                                                                                                                    | Recipe                                                           |
| ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `hono/accepts`   | effect-http | Choose a preference kind, negotiate raw text or Web Headers/Request, and map invalid syntax and no acceptable offer separately; add representation Vary.              | [Accepts](standalone-policies.md#accept-parsing-and-negotiation) |
| `hono/adapter`   | effront     | Read host bindings through Workers accessors or caller Config/Layer; do not recreate runtime auto-detection or global environment lookups.                            | [Bindings](effront.md#workers-and-bindings)                      |
| `hono/conninfo`  | Effect      | Yield the request and inspect its optional peer address; handle unavailable host metadata explicitly instead of inventing ports or address families.                  | [Connection information](core.md)                                |
| `hono/cookie`    | Effect      | Read request cookies, set/expire response cookies, and implement any signed-cookie MAC framing, verification, and rotation explicitly.                                | [Cookies](middleware.md)                                         |
| `hono/css`       | effront     | Move tagged-template styles and keyframes into stylesheets, React class names, and optionally `effrontTailwind()` in Vite.                                            | [Styles](effront.md#styles)                                      |
| `hono/dev`       | Excluded    | Hono router inspection and dumps are framework-specific. Use the target API description or Vite environment without promising the same debug API.                     | Not applicable                                                   |
| `hono/factory`   | effront     | Create one application-bound factory and use its typed definitions/services instead of reproducing Hono handler inference.                                            | [Factory](effront.md#application-and-factory)                    |
| `hono/html`      | effront     | Render untrusted values as React text/attributes; use an HTML response only for already safe HTML and never assume its content type escapes interpolated text.        | [HTML](effront.md#jsx-and-html)                                  |
| `hono/proxy`     | Effect      | Convert the request with `toClientRequest`, enforce a fixed trusted upstream and forwarding policy, and convert the streaming client response back with scope intact. | [Proxy](core.md)                                                 |
| `hono/route`     | Effect      | Yield `HttpRouter.RouteContext` inside a matched route and read route metadata/params; do not infer Hono's middleware-match history.                                  | [Route metadata](core.md)                                        |
| `hono/ssg`       | Excluded    | Build-time static generation is not generic HTTP policy. SSR and static asset hosting do not establish an effront SSG implementation.                                 | Not applicable                                                   |
| `hono/streaming` | Effect      | Produce bytes or encoded SSE through `Stream` and `HttpServerResponse.stream`; preserve cancellation and finalizers through body consumption.                         | [Streaming](core.md)                                             |
| `hono/testing`   | Effect      | Derive tests from `HttpApiTest.groups`, use a native server test client, or send real Web Requests through `HttpEffect.toWebHandler`; assert observable HTTP output.  | [Testing](core.md)                                               |
| `hono/ws`        | Effect      | Upgrade through the request's `upgrade` or `upgradeChannel`, then use `effect/socket` channels/streams in the host-owned scope.                                       | [WebSocket](core.md)                                             |

## Routers

| Hono path                    | Owner    | Concrete migration                                                                                                                             | Recipe             |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `hono/router`                | Effect   | Define route methods/patterns with `HttpRouter` and provide the resulting routing Layer; use effront's route builder for pages.                | [Routing](core.md) |
| `hono/router/reg-exp-router` | Excluded | This is Hono's regular-expression router implementation. Use the target router rather than add a duplicate algorithm.                          | Not applicable     |
| `hono/router/smart-router`   | Excluded | Hono's automatic router selection is internal framework machinery, not a missing HTTP behavior in Effect.                                      | Not applicable     |
| `hono/router/trie-router`    | Excluded | A Hono trie implementation is not required to express target routes; matching differences must be tested in the target app.                    | Not applicable     |
| `hono/router/pattern-router` | Excluded | Do not reproduce a Hono pattern-engine contract. Translate supported patterns into target routes and identify unsupported patterns explicitly. | Not applicable     |
| `hono/router/linear-router`  | Excluded | A size-oriented linear-search router is a framework implementation choice, not a reusable HTTP policy to add.                                  | Not applicable     |

## JSX and DOM

| Hono path                      | Owner   | Concrete migration                                                                                                                           | Recipe                                   |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `hono/jsx`                     | effront | Rewrite as React components, move interactive logic into Client Components, and keep server Effects inside effront render functions.         | [JSX](effront.md#jsx-and-html)           |
| `hono/jsx/jsx-dev-runtime`     | effront | Remove Hono jsxImportSource and compile through React's development JSX transform in effront Vite.                                           | [JSX](effront.md#jsx-and-html)           |
| `hono/jsx/jsx-runtime`         | effront | Select React automatic JSX compilation and let the compiler emit the React runtime calls; do not rename Hono node objects.                   | [JSX](effront.md#jsx-and-html)           |
| `hono/jsx/streaming`           | effront | Express loading with React Suspense and effront loading definitions, then use its RSC/SSR response stream rather than a JSX callback writer. | [Streaming UI](effront.md#jsx-and-html)  |
| `hono/jsx/dom`                 | effront | Move browser DOM/state behavior to React Client Components within effront hydration and navigation.                                          | [DOM](effront.md#jsx-and-html)           |
| `hono/jsx/dom/jsx-dev-runtime` | effront | Compile browser JSX with React's development transform and remove the Hono-specific DOM factory configuration.                               | [DOM transform](effront.md#jsx-and-html) |
| `hono/jsx/dom/jsx-runtime`     | effront | Use React automatic JSX within the browser graph instead of Hono's DOM runtime objects.                                                      | [DOM transform](effront.md#jsx-and-html) |
| `hono/jsx/dom/client`          | effront | Remove manual Hono mounting and use the framework client entry; reserve direct React DOM roots for separately owned UI.                      | [Hydration](effront.md#jsx-and-html)     |
| `hono/jsx/dom/css`             | effront | Use build-imported stylesheets and React className, with Tailwind integration where needed, rather than a second DOM style runtime.          | [Styles](effront.md#styles)              |
| `hono/jsx/dom/server`          | effront | Render through effront's RSC/SSR graphs and let the host own streamed resource lifetime.                                                     | [SSR](effront.md#jsx-and-html)           |

## Host adapters

These paths are deprecated but public at the Hono baseline; none is omitted.

| Hono path                 | Owner    | Concrete migration                                                                                                                                         | Recipe                                     |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `hono/cloudflare-workers` | effront  | Export `createFetchHandler(application)` as the Worker's fetch function, use the Cloudflare Vite plugin, and read per-request bindings with its accessors. | [Workers](effront.md#workers-and-bindings) |
| `hono/cloudflare-pages`   | Excluded | Pages EventContext and its middleware chain are not the Workers Fetch contract. No Pages compatibility adapter is supplied.                                | Not applicable                             |
| `hono/deno`               | Excluded | A generic Fetch handler does not supply Deno's file, upgrade, connection-info, or SSG integration. This host adapter is outside scope.                     | Not applicable                             |
| `hono/bun`                | effront  | Convert the app with `toHttpEffect`, pass handler/assets to `@effront/server/bun` serve, and launch its Layer at the executable boundary.                  | [Bun](effront.md#bun-and-native-listeners) |
| `hono/aws-lambda`         | Excluded | API Gateway/ALB events, binary flags, Lambda context, and streaming adapters need a distinct host contract; Web conversion alone is insufficient.          | Not applicable                             |
| `hono/vercel`             | Excluded | Vercel deployment and connection wrappers are not implemented by this HTTP policy package or established by Fetch portability.                             | Not applicable                             |
| `hono/netlify`            | Excluded | Netlify host context and handler adaptation are not implemented here; do not claim effront already supplies them.                                          | Not applicable                             |
| `hono/lambda-edge`        | Excluded | CloudFront request/response events and callback protocols differ from Fetch and require a separate adapter.                                                | Not applicable                             |
| `hono/service-worker`     | Excluded | Registering fetch events and respondWith is a host operation. This skill does not install an implicit global listener compatible with Hono fire.           | Not applicable                             |

## Utilities

| Hono path                | Owner       | Concrete migration                                                                                                                                                 | Recipe                                                              |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `hono/utils/accept`      | effect-http | Parse or negotiate raw header strings by kind and handle Result/Option explicitly; keep the same logic usable outside a request Effect.                            | [Raw Accept](standalone-policies.md#accept-parsing-and-negotiation) |
| `hono/utils/basic-auth`  | Effect      | Use Better Auth for application authentication. Use `Base64.decode` only if a separate raw Basic parser is still required.                                         | [Basic auth utility](utilities.md#honoutilsbasic-auth)              |
| `hono/utils/body`        | Effect      | Select the JSON/form/multipart request reader and decode with Schema; model repeated or dotted fields explicitly rather than assume Hono's expansion rules.        | [Body utilities](utilities.md)                                      |
| `hono/utils/buffer`      | Effect      | Convert bytes/text with Uint8Array and TextEncoder/TextDecoder; parse form data at the request boundary and use Mac/Signature for secret verification.             | [Bytes](utilities.md)                                               |
| `hono/utils/color`       | Excluded    | Terminal color capability belongs to logger formatting and host settings, not HTTP migration policy. No color detector is supplied.                                | Not applicable                                                      |
| `hono/utils/compress`    | Effect      | Let HttpMiddleware.compression own supported content types and encoding negotiation; do not port a separate compressibility regular expression.                    | [Compression utilities](utilities.md)                               |
| `hono/utils/concurrent`  | Effect      | Replace the Promise pool with Effect.forEach using an explicit concurrency bound; retain scoped interruption and resource cleanup.                                 | [Concurrency](utilities.md)                                         |
| `hono/utils/constants`   | Excluded    | Hono's composed-handler marker is meaningful only inside its own dispatcher and is unnecessary for Effect composition.                                             | Not applicable                                                      |
| `hono/utils/cookie`      | Effect      | Parse with Cookies, set/expire through response setters, and validate signed framing with Mac; do not treat serialization as signature verification.               | [Cookie utilities](utilities.md)                                    |
| `hono/utils/crypto`      | Effect      | Depend on Digest for supported hash algorithms and supply its platform Layer at the application root; do not create hidden crypto runtimes.                        | [Crypto](utilities.md)                                              |
| `hono/utils/encode`      | Effect      | Use Base64/Base64Url encode/decode with explicit failure handling instead of assuming Hono's exception and return-value contracts.                                 | [Encoding](utilities.md)                                            |
| `hono/utils/filepath`    | Effect      | Use a trusted static root and HttpStaticServer/HttpPlatform path resolution; use Path only for application path operations, not an invented containment guarantee. | [File paths](utilities.md)                                          |
| `hono/utils/handler`     | Excluded    | Function arity and Hono marker introspection detect its internal handler model. Use typed composition instead of duplicating the detector.                         | Not applicable                                                      |
| `hono/utils/headers`     | Effect      | Construct normalized Headers and use schemaHeaders for typed input, preserving repeated-header semantics where required.                                           | [Headers](utilities.md)                                             |
| `hono/utils/html`        | effront     | Replace raw/escaped markers and renderer callbacks with React text, components, and a deliberate sanitized raw-HTML boundary.                                      | [HTML safety](effront.md#jsx-and-html)                              |
| `hono/utils/http-status` | Effect      | Use HttpStatus.Literal/fromLiteral and response status options, with HttpApi error/success schemas where applicable.                                               | [Status](utilities.md)                                              |
| `hono/utils/ipaddr`      | Effect      | Parse NetAddress/IpNetwork values and use contains for IPv4/IPv6 membership; reject invalid input rather than copy a bigint address representation.                | [IP values](utilities.md)                                           |
| `hono/utils/jwt`         | Effect      | Use Jwt/Jwks for token signing and verification, then Schema-decode application claims; decoding alone is not verification.                                        | [JWT](utilities.md)                                                 |
| `hono/utils/jwt/index`   | Effect      | Replace this separate wildcard barrel import with the same public Jwt/Jwks workflow, retaining its own inventory row.                                              | [JWT barrel](utilities.md)                                          |
| `hono/utils/jwt/jwa`     | Effect      | Select Jwk algorithm and key types compatible with Mac or Signature, reject unsupported choices, and keep algorithm policy separate from token claims.             | [JWA](utilities.md)                                                 |
| `hono/utils/jwt/jws`     | Effect      | Use Jws signing/verifying with an explicitly typed key and caller crypto services; do not rebuild compact-signature framing.                                       | [JWS](utilities.md)                                                 |
| `hono/utils/jwt/jwt`     | Effect      | Use Jwt decode only for untrusted inspection; use verified key/claims policy before exposing a payload as an identity.                                             | [JWT payload](utilities.md)                                         |
| `hono/utils/jwt/types`   | Effect      | Replace Hono payload/error aliases with Jwt.RegisteredClaims, Jwt/Jose typed errors, and Schema-derived application claims.                                        | [JOSE types](utilities.md)                                          |
| `hono/utils/jwt/utf8`    | Effect      | Encode and decode using Web TextEncoder/TextDecoder with an explicit invalid-byte policy instead of re-exporting Hono's singleton.                                 | [UTF-8](utilities.md)                                               |
| `hono/utils/mime`        | Effect      | Use Mime.getType/getExtension for metadata or let the existing static boundary set MIME; choose an explicit unknown-type fallback.                                 | [MIME](utilities.md)                                                |
| `hono/utils/mount`       | Effect      | Use HttpEffect.fromWebHandler and explicit router prefix rewriting; preserve query/body/scope without porting Hono request-cloning helpers.                        | [Mount utilities](utilities.md)                                     |
| `hono/utils/stream`      | Effect      | Replace StreamingApi writer callbacks with Stream production and HttpServerResponse.stream; ensure cancellation closes the producing scope.                        | [Stream utilities](utilities.md)                                    |
| `hono/utils/types`       | Excluded    | Hono's generic type-inference helpers do not fill a missing HTTP runtime feature. Derive types from the target Schema/API or TypeScript standard utilities.        | Not applicable                                                      |
| `hono/utils/url`         | Effect      | Parse URLs/query using URL, Url/UrlParams and request.toURL; define target router patterns rather than reproducing Hono's optional-pattern/decode fallbacks.       | [URLs](utilities.md)                                                |

## Additional implementation

The preceding owner classifications preserve the existing correspondence table; they do not hide integration gaps.
Use [the separate implementation proposals](implementation-proposals.md) to identify policies that require substantial code even though Effect primitives exist.
For a migration, classify each used behavior as ready API, composition, implementation candidate, effront-owned, or excluded.
Do not call a proposed `RequestId`, IP guard, signed-cookie helper, or other prospective namespace as though it were exported.
Do not expand proposals into effront rendering/assets/host internals or excluded Hono contracts.
