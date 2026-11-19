# Standalone HTTP policy recipes

For developers replacing Hono's Accept, cache, conditional-response, CSRF, and security-header behavior on standalone endpoints.
Import each policy from its public subpath. The package has no root export.
The [effect-http source](https://github.com/totto2727-org/effect-http/tree/feat/hono-http-utilities) uses Effect 4.1.4.
Confirm registry availability before installing a release; a repository or enabled publish workflow does not prove an npm release exists.
Do not add Hono as a dependency.
Use the [middleware scope and startup rules](middleware.md#composition-and-error-boundaries) for standalone routes.

## Contents

- [Accept parsing and negotiation](#accept-parsing-and-negotiation)
- [Cache policy and response storage](#cache-policy-and-response-storage)
- [Validators and preconditions](#validators-and-preconditions)
- [CSRF and security headers](#csrf-and-security-headers)
- [Order and service ownership](#order-and-service-ownership)
- [Sources](#sources)

## Accept parsing and negotiation

Paths: `hono/accepts`, `hono/utils/accept`.
The language middleware also uses this primitive, but query/cookie/path precedence remains a separate policy.

1. Choose `mediaType`, `language`, `encoding`, or `charset` explicitly.
2. For raw header text, call `Accepts.parse(kind, stringOrNull)` or `Accepts.negotiate(kind, header, serverOffers)`.
3. Outside middleware, call `negotiateHeaders` or `negotiateRequest` with Web `Headers` or `Request`.
   These functions do not consume the request body.
4. Within an Effect HTTP endpoint, use `negotiateEffect(kind, offers)` to read `HttpServerRequest`.
5. Handle malformed syntax separately from a valid header with no acceptable offer.
   Map the former to an explicit client error and the latter to 406 or another documented application policy.
6. Emit `Vary` for the selected request header when the representation depends on it.
   Negotiation itself does not set `Vary` or construct a response.

This example keeps pure negotiation separate from an HTTP middleware that requires JSON:

```ts
import * as Accepts from "@totto2727/effect-http/accepts";
import { Effect, Option, Result } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { listProducts } from "./products.ts";

export const rawPreference = Accepts.negotiate("mediaType", "application/json, text/plain;q=0.5", [
  "text/plain",
  "application/json",
]);

const acceptJson = <E, R>(handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
  Effect.gen(function* () {
    const choice = yield* Effect.result(Accepts.negotiateEffect("mediaType", ["application/json"]));
    if (Result.isFailure(choice)) return HttpServerResponse.empty({ status: 400 });
    if (Option.isNone(choice.success)) return HttpServerResponse.empty({ status: 406 });
    return yield* handler;
  }).pipe(Effect.map(HttpServerResponse.setHeader("vary", "Accept")));

export const Routes = HttpRouter.addAll([
  HttpRouter.route("GET", "/products", listProducts.pipe(acceptJson)),
]);
```

A missing header accepts every server offer.
An empty header accepts none, apart from implicit encoding `identity`.
Media specificity and `q=0` exclusions matter; do not take the first comma-separated value.
Language uses basic filtering: `en` can select `en-US`, not the reverse.
Equal qualities preserve server offer order; duplicate equally specific ranges use the lowest quality.
The strict bounded parser rejects malformed input as a whole rather than silently ignoring part of it.
These are intentional semantic differences from permissive parsers, not drop-in Hono return types.

## Cache policy and response storage

Path: `hono/cache`.

1. Use `CacheControl.middleware` when the requirement is a response caching header only.
   Use `CacheControl.parse` and `format` outside middleware for policy parsing/serialization.
2. If server-side response reuse is required, acquire `ResponseCache.make` once during route or application layer construction.
   Do not run a separate `Effect.runPromise` to create the cache.
3. Set capacity, TTL, maximum buffered body bytes, and all request-header variants explicitly.
   `publicRoute: true` asserts that output is independent of identity and undeclared inputs.
4. Put the route's cache header inside `cache.middleware`, so a stored response includes its policy.
5. Yield `invalidateAll` on the same cache instance after writes that invalidate this public representation, including writes outside the route.

```ts
import * as CacheControl from "@totto2727/effect-http/cacheControl";
import * as ResponseCache from "@totto2727/effect-http/responseCache";
import { Effect } from "effect";
import { HttpRouter } from "effect/http";
import { listProducts } from "./products.ts";

export const Routes = HttpRouter.addAll(
  Effect.gen(function* () {
    const cache = yield* ResponseCache.make({
      publicRoute: true,
      capacity: 128,
      ttlMilliseconds: 60_000,
      maxBodyBytes: 64 * 1024,
      vary: [],
    });
    const cachedProducts = listProducts.pipe(
      CacheControl.middleware({ public: true, maxAge: 30 }),
      cache.middleware,
    );
    return [HttpRouter.route("GET", "/products", cachedProducts)];
  }),
);
```

This is an in-memory, bounded, public GET route cache, not the platform Cache API or a distributed reverse proxy.
Cookie, Authorization, conditional/range requests, request freshness constraints, unknown `Vary`, private responses, Set-Cookie, unsupported cache directives, and streamed bodies bypass storage or reuse.
The response's freshness and Age/Date also bound TTL.
Use declared variants only for headers that really describe the representation.
Do not cache effront page, Flight, or Server Function output here.
Do not wrap effront or Effect static assets with this cache.

## Validators and preconditions

Path: `hono/etag`.

1. For an existing validator, use `ConditionalRequest.evaluate` before deciding whether to run an expensive read or a write.
   Its request header record uses lowercase keys.
2. For a selected response, use `ConditionalRequest.apply(response, request, validators)`.
3. For bounded in-memory GET output without a known validator, use `ConditionalRequest.middleware({ maxBodyBytes })` and provide `Digest` at the composition root.
4. Leave static files to their existing static server validators.
   Supply a known validator for streams instead of draining them to compute a digest.

Use `ConditionalRequest.parseEtag` to obtain the schema-validated ETag from the quoted validator.
Reject an invalid current validator before you evaluate the request.

```ts
import * as ConditionalRequest from "@totto2727/effect-http/conditionalRequest";
import { Option } from "effect";

const etag = Option.getOrThrow(Option.fromNullishOr(ConditionalRequest.parseEtag('"revision-8"')));

export const decision = ConditionalRequest.evaluate({
  method: "PUT",
  headers: { "if-match": '"revision-7"' },
  etag,
  exists: true,
});
```

Run the write only for `Proceed`.
`PreconditionFailed` maps to 412 before the write; `NotModified` maps to a bodyless 304 for a conditional read.
Automatic response middleware cannot prevent an already executed write.
HEAD reuses known validators and must not hash its empty body as the GET representation.
A 304 keeps applicable validators, Vary, and encoding metadata, but does not return the representation body or its body-length/type headers.

## CSRF and security headers

Paths: `hono/csrf`, `hono/secure-headers`.

1. Wrap state-changing standalone endpoints with `Csrf.middleware` before their Effects execute.
   Use `Csrf.decide` for the same policy outside middleware.
2. Configure additional exact origins only when the application intentionally trusts them.
   Missing proof, malformed origins, and contradictory Fetch Metadata fail closed for unsafe methods, including JSON requests.
3. Use `SecureHeaders.middleware` outside that guard if headers must also cover its denial response.
4. Enable HSTS only for an HTTPS-only deployment; provide a static CSP only when compatible with the actual content.
5. Map application failures inside the outer header policy when those error responses also require its headers.

```ts
import * as Csrf from "@totto2727/effect-http/csrf";
import * as SecureHeaders from "@totto2727/effect-http/secureHeaders";
import { HttpRouter } from "effect/http";
import { updateProfile } from "./profile.ts";

const guarded = updateProfile.pipe(
  Csrf.middleware({ allowedOrigins: ["https://trusted.example"] }),
  SecureHeaders.middleware(),
);
export const Routes = HttpRouter.addAll([HttpRouter.route("POST", "/profile", guarded)]);
```

CSRF protection does not authenticate a user or replace CORS.
The guard returns a no-store 403 without running the protected handler.
It does not trust forwarded headers automatically.
The default header policy removes `X-Powered-By`; disabling an individual documented header is different from replacing the entire policy.
Use `SecureHeaders.headers` and `serializeContentSecurityPolicy` when only serialization is needed.
Nonce generation and React nonce propagation remain outside this library.
effront's existing internal Server Function Origin checks are not replaced by this standalone guard.

## Order and service ownership

With automatic conditionals and Effect's deferred compression, apply both to the route handler and inject `Digest` at server startup:

```ts
import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as ConditionalRequest from "@totto2727/effect-http/conditionalRequest";
import { Layer } from "effect";
import { Digest } from "effect/crypto";
import { HttpMiddleware, HttpRouter } from "effect/http";
import { listProducts } from "./products.ts";

const conditionalProducts = listProducts.pipe(
  ConditionalRequest.middleware({ maxBodyBytes: 64 * 1024 }),
  HttpMiddleware.compression({ minSize: 0, algorithms: ["gzip"] }),
);
const Routes = HttpRouter.addAll([HttpRouter.route("GET", "/products", conditionalProducts)]);

HttpRouter.serve(Routes).pipe(
  Layer.provide([
    NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 3000 }),
    Digest.layerWebCrypto,
  ]),
  Layer.launch,
  NodeRuntime.runMain,
);
```

`minSize: 0` and `algorithms: ["gzip"]` let a small response exercise gzip when the client accepts it.
Omit those options to retain Effect's defaults.
`NodeHttpServer.layer` supplies the `HttpPlatform` service for compression.
`Digest.layerWebCrypto` supplies the digest service separately at the same startup boundary.
Compression registers before conditional processing; validators then apply to the selected response in the pre-response phase.
Compressed streams are not buffered to invent a strong ETag.
Use a known validator, often weak for equivalent representations across encodings, when automatic hashing cannot apply.
Test the real Web/native response path: observing only the handler's intermediate response misses these deferred transforms.

## Sources

- [Accepts](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/accepts.ts), [CacheControl](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/cacheControl.ts), and [ResponseCache](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/responseCache.ts).
- [ConditionalRequest](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/conditionalRequest.ts), [Csrf](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/csrf.ts), and [SecureHeaders](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/secureHeaders.ts).
- [Real Web Request integration examples](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/integration.test.ts).
