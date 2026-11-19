# Middleware migration recipes

This guide serves intermediate and advanced users who replace Hono middleware with Effect handlers.
It does not reproduce Hono's `Context`, `next()` protocol, or renderer integration.
The fixed sources are [Hono f6fbaf0](https://github.com/honojs/hono/tree/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src), [Effect 4.1.4, 3e2030b](https://github.com/Effect-TS/effect/tree/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src), and [effront 3c8c55](https://github.com/totto2727-org/effront/tree/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614).
The six existing effect-http module subpaths are `accepts`, `cacheControl`, `conditionalRequest`, `csrf`, `responseCache`, and `secureHeaders`.
Use namespace imports for the module-qualified API names below; the package has no root export.
Names in [Implementation proposals](./implementation-proposals.md) are not additional exports.

## Contents

- [Composition and error boundaries](#composition-and-error-boundaries)
- [Basic auth](#basic-auth)
- [Bearer auth](#bearer-auth)
- [JWT and JWK](#jwt-and-jwk)
- [Body limit](#body-limit)
- [Cache](#cache)
- [Combine](#combine)
- [Compress](#compress)
- [Context storage](#context-storage)
- [CORS](#cors)
- [CSRF](#csrf)
- [ETag](#etag)
- [IP restriction](#ip-restriction)
- [Language](#language)
- [Logger](#logger)
- [Mount](#mount)
- [Powered by](#powered-by)
- [Pretty JSON](#pretty-json)
- [Request ID](#request-id)
- [Secure headers](#secure-headers)
- [Timeout](#timeout)
- [Timing](#timing)
- [Trailing slash](#trailing-slash)
- [Cookie](#cookie)
- [Connection information](#conninfo)
- [Proxy](#proxy)
- [Validation boundaries](#validation-boundaries)

## Composition and error boundaries

A middleware transforms an `Effect<HttpServerResponse, E, R>` and preserves or explicitly changes its error and service requirements.
For one route, pass `handler.pipe(policy)` directly to `HttpRouter.route` and register the route with `HttpRouter.addAll`.
For a group that shares the same policy, build it with `HttpRouter.middleware(policy).layer` and provide it to that group's registration layer with `Layer.provide`.
Use global middleware only when the policy must apply across route groups.
See the [shared policy server example](https://github.com/totto2727-org/effect-http/blob/74aa92388ba4a43dad0c5bb9261d97bb06b30a76/README.md#usage).
In `handler.pipe(inner, outer)`, `outer` starts first.
Ordinary `Effect.map` transforms a successful response only.
A response registered through `HttpEffect.withPreResponseHandler` runs at the HTTP boundary, including on responses produced by error conversion.
Do not infer final wire order from the order of `Effect.map` calls.
The compression recipe and conditional-request recipe depend on this distinction.

Provide services such as `Digest` and HTTP clients to `HttpRouter.serve(Routes)` at startup, alongside the host layer.
Leave those service requirements in the handler or middleware type.
Initialize shared state during route or application layer construction, not with a separate `Effect.runPromise` or inside each request.
Prefer `Effect.gen` and `yield*` for sequential work; use `pipe` to compose middleware, error policies, and layers.
Provide request-local values inside the request effect, not in a mutable global variable or a process-wide layer.
Map known domain failures to HTTP responses before outer successful-response decorators when those decorators must apply to errors too.
Keep defects observable and keep interruption intact rather than catching every cause and returning success.
`HttpServerError.RequestParseError` maps `BodyTooLarge` to 413 and other parse failures to 400 at the HTTP boundary.
A stream can still fail after headers are sent, when replacing the response with a new status is no longer possible.
See [HttpEffect](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpEffect.ts) and [HttpServerError](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpServerError.ts).

## Basic auth

Path: `hono/basic-auth`.
Use `HttpApiSecurity.basic` with `HttpApiMiddleware.Service` for typed HTTP APIs.
The scheme supplies `{ username, password }`, where `password` is redacted, to the security implementation.
The implementation must call an application credential service, fail with a declared 401 error on rejection, and provide an authenticated principal service on success.
Attach the middleware to the endpoint or group and provide its implementation layer to the API builder.
A security declaration is not a credential database or password verifier.
Configure a `WWW-Authenticate: Basic realm="..."` challenge at the error-response boundary if clients require it.
Use TLS, rate limits, and a password verification service rather than a plain string equality example.
Do not log decoded passwords or raw Authorization headers.
This typed-API adapter delegates verification and provides only the returned principal.
Provide `CredentialsVerifier` when building `BasicAuthLive`, then provide that layer to the API routes containing `protectedEndpoint`.
The declaration uses the built-in Unauthorized schema, so rejection remains a declared 401 error.

```ts
import { Context, Effect, Layer } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "effect/http-api";

export class CurrentUser extends Context.Service<CurrentUser, { readonly id: string }>()(
  "example/CurrentUser",
) {}
export class CredentialsVerifier extends Context.Service<
  CredentialsVerifier,
  {
    readonly verify: (
      credentials: HttpApiSecurity.Credentials,
    ) => Effect.Effect<CurrentUser["Service"], HttpApiError.Unauthorized>;
  }
>()("example/CredentialsVerifier") {}
export class BasicAuth extends HttpApiMiddleware.Service<BasicAuth, { provides: CurrentUser }>()(
  "example/BasicAuth",
  {
    security: { basic: HttpApiSecurity.basic },
    error: HttpApiError.Unauthorized,
  },
) {}
export const BasicAuthLive = Layer.effect(
  BasicAuth,
  Effect.gen(function* () {
    const verifier = yield* CredentialsVerifier;
    return {
      basic: (handler, { credential }) =>
        verifier
          .verify(credential)
          .pipe(Effect.flatMap((user) => Effect.provideService(handler, CurrentUser, user))),
    };
  }),
);
export const protectedEndpoint = HttpApiEndpoint.get("profile", "/profile").middleware(BasicAuth);
```

See [HttpApiMiddleware security contract](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http-api/HttpApiMiddleware.ts) and [HttpApiSecurity.Credentials](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http-api/HttpApiSecurity.ts).

## Bearer auth

Path: `hono/bearer-auth`.
Use `HttpApiSecurity.bearer` to extract a redacted token and an application authentication service to validate it.
For opaque tokens, use bounded database or introspection calls and distinguish invalid credentials from service outages.
Provide the principal only around the protected handler.
Return 401 for missing or invalid credentials and 403 for a valid principal that lacks permission.
Keep a browser cookie fallback opt-in, with CSRF protection, instead of silently accepting a second credential source.
For a plain handler, the following complete example uses an injected verifier and a strict, single Bearer credential.
The verifier is deliberately application-owned and must be supplied before serving this handler.

```ts
import { Context, Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

export class Principal extends Context.Service<Principal, { readonly subject: string }>()(
  "example/Principal",
) {}
export class TokenVerifier extends Context.Service<
  TokenVerifier,
  {
    readonly verify: (token: string) => Effect.Effect<Principal["Service"], "InvalidToken">;
  }
>()("example/TokenVerifier") {}

export const bearerApp = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization ?? "");
  const denied = HttpServerResponse.empty({
    status: 401,
    headers: { "www-authenticate": "Bearer" },
  });
  const token = match?.[1];
  if (token === undefined) return denied;
  const verifier = yield* TokenVerifier;
  const protectedHandler = Principal.use((principal) =>
    Effect.succeed(HttpServerResponse.text(principal.subject)),
  );
  return yield* verifier.verify(token).pipe(
    Effect.flatMap((principal) => Effect.provideService(protectedHandler, Principal, principal)),
    Effect.catch(() => Effect.succeed(denied)),
  );
});
```

The verifier's error channel contains only credential rejection, so this catch does not mask infrastructure errors.
Keep outages in a distinct error channel when extending this service.

```ts
import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";

export const invalidTokenBoundary = (check: Effect.Effect<string, "InvalidToken">) =>
  check.pipe(
    Effect.map((subject) => HttpServerResponse.text(subject)),
    Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 401 }))),
  );
```

## JWT and JWK

Paths: `hono/jwt`, `hono/jwk`.
Use `Jwt.verify(schema, token, key, options)` for a configured verification key.
Use `Jwt.verifyWithKeySet(schema, token, options)` with `Jwks.Jwks` and `Signature.Signature` for key-set selection.
The latter requires an explicit algorithm allow-list through its options.
Configure `Jwks.layerRemote(options)` once, including its configured URL and HTTP client dependencies, rather than fetching a key set on every request.
Allow only a deployment-configured HTTPS issuer/key URL, not a token-controlled URL.
The remote Jwks service validates an HTTPS URL without credentials or fragment, caches successful fetches, coalesces concurrent resolution, and bounds response bytes and key count.
Its default TTL is 10 minutes, cooldown is 30 seconds, and fetch/body timeout is 5 seconds.
Supply an HTTP client with redirects disabled.
`FetchHttpClient` follows redirects by default, so provide its `RequestInit` service with `{ redirect: "manual" }` on the client layer.
The key-set service rejects a redirected final response, but that check cannot undo a redirect request the client already sent.
Set issuer, audience, required claims, and token-age policy independently of signature validation.
`exp` is not mandatory unless policy requires it.
A decoded token from `Jwt.decodeUnverified` is untrusted data, not a principal.

```ts
import { Schema } from "effect";
import { Jwt } from "effect/jose";

const Claims = Schema.Struct({ sub: Schema.String });
export const verifyAccessToken = (token: string) =>
  Jwt.verifyWithKeySet(Claims, token, {
    algorithms: ["RS256"],
    issuer: "https://issuer.example",
    audience: "example-api",
    requiredClaims: ["exp", "sub"],
    clockTolerance: "5 seconds",
  });
```

Feed the verified result's `claims` into the application principal mapping, then provide the principal around the protected handler.
Map token format, signature, and claim rejection to 401 without exposing details.
Do not turn an upstream outage into a successful anonymous request.
The reusable adapter, challenge formatting, and error classification are still missing middleware, even though JOSE primitives exist.
See [Jwt](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jwt.ts), [Jwks](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jwks.ts), and [Jws verification options](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jws.ts).

## Body limit

Path: `hono/body-limit`.
`HttpIncomingMessage.MaxBodySize` is a reference for body readers, not an eager middleware gate.
Set it around the body-reading handler and use `HttpMiddleware.decompression({ maxDecompressedSize })` for expanded bytes.
An unread body is not necessarily rejected before the handler runs.
A `Content-Length` precheck alone cannot bound chunked data or decompression output.
Do not read the body once for checking and then expect a second independent stream read.
For an eager gate, buffer a bounded body once and replace the request view before running downstream code, or add a streaming counting layer with explicit late-failure semantics.
The latter cannot guarantee that no handler side effects occur before the limit is exceeded.

```ts
import { ByteSize, Effect } from "effect";
import {
  HttpIncomingMessage,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

export const boundedBody = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* request.text;
  return HttpServerResponse.text(text);
}).pipe(
  HttpMiddleware.decompression({ maxDecompressedSize: 1024 }),
  Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(1024)),
);
```

Decompression is lazy, accepts gzip and zlib deflate, reverses stacked codings, and ignores identity members.
Unsupported codings return 415 before the handler, with `Accept-Encoding: gzip, deflate`.
Malformed data fails the body read with a parse error.
Expanded-size breaches produce `RequestParseError` with `BodyTooLarge`, or multipart `BodyTooLarge`, which the HTTP error boundary maps to 413.
Its default expanded limit is `MaxBodySize`, otherwise 10 MiB, and it includes direct stream reads.
Uncompressed stream enforcement is adapter-dependent, so test the chosen server and accessor rather than treating `MaxBodySize` as a universal stream counter.
`request.source` remains the compressed original.
`toWeb` can therefore return compressed bytes for a Web source even though Effect accessors see expanded bytes.
See [decompression implementation](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts) and [Hono body-limit](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/middleware/body-limit/index.ts).

## Cache

Path: `hono/cache`.
Create `ResponseCache.make({ capacity, ttlMilliseconds, maxBodyBytes, vary, publicRoute: true })` once and use the returned `middleware` on explicitly public routes.
Creating it inside each request discards cache reuse.
Run authentication or private-route selection before any shared cache lookup.
The cache skips Authorization, Cookie, forbidden cache directives, undeclared Vary, and unsupported body forms conservatively.
It is bounded process-local storage, not a distributed cache or an effront page/Flight cache.
Use `CacheControl` to parse and serialize policy rather than concatenating unvalidated directives.
Keep compression outside cache policy and test the final encoded representation and Vary behavior.
See [existing ResponseCache source](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/responseCache.ts).

## Combine

Path: `hono/combine`.
Replace sequential composition with `pipe`, conditional execution with `Effect.if` or `Effect.gen`, and explicit fallback with recovery of a dedicated rejection error.
An authentication rejection must not be represented as an arbitrary failed cause, because a catch-all fallback can hide an outage or defect.
Do not race middleware alternatives that can both consume one request body or run side effects.
A pure predicate can choose a branch before either branch reads the body.
Use the [middleware scope rules](#composition-and-error-boundaries) to choose direct application or a shared router layer.
Preserve request requirements rather than asserting them away.
See [HttpRouter.middleware](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpRouter.ts).

## Compress

Path: `hono/compress`.
Wrap the handler with `HttpMiddleware.compression({ algorithms, minSize })` and provide the runtime's `HttpPlatform` service.
Compression registers a deferred pre-response transform, so obtaining an Effect response value directly does not prove that its body is compressed.
Test it through `HttpEffect.toWebHandler` or the actual server.
The implementation negotiates in server preference order among accepted, platform-supported algorithms.
Unknown-length eligible bodies are compressed regardless of `minSize`.
Known bodies below the threshold are skipped but still receive `Vary: Accept-Encoding`.
It skips 1xx, 204, 206, 304, existing encoding, no-transform, unsuitable or absent content type, empty bodies, and FormData.
`Content-Encoding: identity` disables compression and is removed before transmission.
Do not enable it again on a runtime that already compresses responses.
Disable it where attacker-controlled content and secrets share an observable compressed response.
A compressed stream can fail during transmission after the HTTP status is committed.
Web CompressionStream does not promise per-chunk flushing.
The following handler leaves `HttpPlatform` as an explicit host requirement.
Use the host's platform layer before converting it with `HttpEffect.toWebHandler`.

```ts
import { Effect } from "effect";
import { HttpMiddleware, HttpServerResponse } from "effect/http";

export const compressedApp = Effect.succeed(HttpServerResponse.text("payload ".repeat(500))).pipe(
  HttpMiddleware.compression({ algorithms: ["gzip"], minSize: 1024 }),
);
```

See [HttpMiddleware.compression](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts).

## Context storage

Path: `hono/context-storage`.
Define a `Context.Service` for each request-local value and provide it around downstream effects.
Handlers obtain `HttpServerRequest.HttpServerRequest` from the same environment.
Keep service requirements in the effect type so missing context is caught before serving.
Do not use a process-global map or call `Effect.runPromise` inside a request merely to imitate a synchronous `getContext()` accessor.
Use an explicit adapter if a third-party callback cannot participate in Effect context propagation.
The [request ID example](#request-id) shows scoped service provision.

## CORS

Path: `hono/cors`.
Use `HttpMiddleware.cors({ allowedOrigins, allowedMethods, allowedHeaders, exposedHeaders, credentials, maxAge })` outside authentication when preflight must succeed without credentials.
The middleware short-circuits OPTIONS to 204, not only recognized browser preflight requests.
An empty allowedOrigins list means wildcard, not deny-all.
For credentialed requests, supply explicit trusted origins and do not combine wildcard origins with credentials.
A predicate is synchronous and receives the origin string, not Hono context.
CORS controls browser access to responses, not request authorization or CSRF protection.
It registers final-response headers, including appropriate Origin variation, rather than simply mapping successful handler values.
See [cors source](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts).

## CSRF

Path: `hono/csrf`.
Use existing `Csrf.middleware({ allowedOrigins })` before unsafe handlers and before body consumption or state changes.
It evaluates Origin and Fetch Metadata, not a synchronizer-token protocol.
Unlike Hono's content-type-gated default, this policy checks every unsafe method, including JSON requests.
Its Web-request branch uses the original source URL, so trusted forwarded-header normalization alone does not rewrite that origin.
Configure the trusted public origins explicitly and test the chosen ingress adapter.
Use `Csrf.decide` when the host already owns the response boundary and pass normalized method, URL, Origin, and Sec-Fetch-Site.
Malformed policy is configuration failure, not an authentication success.
CORS does not replace this check for cookie-authenticated endpoints.
Do not insert this policy into effront Server Functions without checking their existing origin enforcement.
See [existing Csrf source](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/csrf.ts).

## ETag

Path: `hono/etag`.
Use existing `ConditionalRequest.middleware({ maxBodyBytes })` with a `Digest.Digest` service for bounded in-memory GET responses.
It does not consume files, streams, raw bodies, or FormData to manufacture a tag.
HEAD can use supplied validators but does not invent a body hash.
For write preconditions, call `ConditionalRequest.evaluate` before the write, then return 412 on failure.
A post-response decorator cannot undo a mutation.
With compression, the supported order is `handler.pipe(ConditionalRequest.middleware(options), HttpMiddleware.compression(options))`.
The deferred compression transform then runs first.
Compressed streams need supplied validators, preferably weak validators that are valid across encodings.
Do not generate one strong hash for multiple different wire representations.
Static ETag, range, and file serving remain owned by Effect/effront.
See [existing ConditionalRequest source](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/conditionalRequest.ts).

## IP restriction

Path: `hono/ip-restriction`.
Parse CIDR configuration once with `IpNetwork.fromString`, parse the selected client address with `NetAddress.ipFromString`, normalize mapped addresses, and apply deny rules before allow rules.
Choose an explicit fail-closed rule for missing or malformed addresses.
For an allow-list, an empty list needs an explicit policy rather than accidental allow-all.
Use `remoteAddress` only after an intentional trusted-proxy transform, or use `peerAddress` for direct transport restrictions.
Never read the leftmost X-Forwarded-For entry unconditionally.
Effect already supplies `HttpMiddleware.xForwardedHeaders({ trustedProxies })`, which checks the original peer and walks the chain from the right.
It also keeps `peerAddress` unchanged and only accepts aligned host/protocol lists.
Apply this transform outside the restriction and outside policies that use the public origin.
CIDR primitives and trusted-proxy normalization exist, but a reusable deny/allow middleware with a documented decision policy does not.
This narrow allow-list example rejects unknown addresses and normalizes IPv4-mapped IPv6 before comparison.
It deliberately does not infer proxy trust from the request.

```ts
import { Effect, Option, Result } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { IpNetwork, NetAddress } from "effect/net";

const allowed = IpNetwork.fromStringUnsafe("192.0.2.0/24");
export const allowDocumentationNetwork = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const input = Option.getOrUndefined(request.remoteAddress);
    const denied = HttpServerResponse.empty({ status: 403 });
    if (input === undefined) return denied;
    const address = NetAddress.ipFromString(input);
    if (Result.isFailure(address)) return denied;
    if (!IpNetwork.contains(allowed, NetAddress.toCanonical(address.success))) return denied;
    return yield* handler;
  });
```

See [IpNetwork](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/net/IpNetwork.ts) and [trusted proxy middleware](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts).

## Language

Path: `hono/language`.
Use existing `Accepts.negotiateEffect("language", supported)` for header negotiation.
Treat a malformed header as a parse failure and a valid but unmatched preference as `Option.none`, not the same condition.
Choose and document query, cookie, path, and header precedence in the application.
Validate each candidate against a finite supported-language list before using it in resource paths.
Provide the selected language as a request-local service and merge `Vary: Accept-Language` when headers affect the representation.
If Cookie or query affects the choice, the cache key and cacheability must reflect that choice too.
A reusable header-only service adapter is possible, but a universal locale policy would bake in application decisions.
See [existing Accepts source](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/accepts.ts).

## Logger

Path: `hono/logger`.
Use `HttpMiddleware.logger` outside the handler to observe request completion and use `Effect.log` with structured annotations inside it.
Use `HttpMiddleware.tracer` for distributed trace context rather than generating an unrelated request ID from a trace ID.
Redact credentials, cookies, and sensitive URL parameters.
Do not assume handler completion means a streaming response reached the client intact.
Tracing and access logs need runtime exporter/logger layers as appropriate for the deployment.
See [logger and tracer implementation](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts).

## Mount

Path: `hono/mount`.
Convert an existing `(Request) => Promise<Response>` with `HttpEffect.fromWebHandler` and register it under the chosen router prefix.
Use `HttpRouter.prefixPath` or prefixed route registration deliberately, then test whether the downstream handler must see the original or stripped path.
Do not assume a Hono env or executionCtx argument is transferred.
Provide host dependencies as explicit services or through the Web handler closure.
Avoid passing a consumed request body to the mounted handler.
See [fromWebHandler](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpEffect.ts).

## Powered by

Path: `hono/powered-by`.
Use `HttpServerResponse.setHeader` for intentional product identification or `removeHeader` to remove it.
Prefer removal in public deployments.
Existing `SecureHeaders` removes X-Powered-By, so placing an ordinary setter inside it does not establish a final wire-header guarantee.
A one-line response transform does not warrant a new library namespace.

## Pretty JSON

Path: `hono/pretty-json`.
Construct the representation at the JSON-producing handler with `HttpServerResponse.text(JSON.stringify(value, null, 2), { contentType: "application/json" })`.
Do not consume arbitrary downstream streams merely because a query parameter requests formatting.
Catch serialization failures at a typed boundary if values can contain cycles or unsupported values.
Select pretty versus compact representation before generating validators or storing the response in a cache.
Treat a query-driven formatting choice as part of the cache key.

## Request ID

Path: `hono/request-id`.
Generate the ID once per request, provide it as a service, annotate logs, and return the same value in a response header.
Accept an incoming ID only from a trusted upstream, after a length and character check.
The example always generates a fresh UUID, which avoids an implicit trust decision.
Its `map` only decorates successful responses, so put domain-error conversion inside it or use a final pre-response handler for the full error boundary.

```ts
import { Context, Effect } from "effect";
import { SecureRandom } from "effect/crypto";
import { HttpServerResponse } from "effect/http";

export class RequestId extends Context.Service<RequestId, string>()("example/RequestId") {}
export const requestId = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.gen(function* () {
    const random = yield* SecureRandom.SecureRandom;
    const id = yield* random.uuidV4();
    return yield* handler.pipe(
      Effect.provideService(RequestId, id),
      Effect.annotateLogs({ requestId: id }),
      Effect.map(HttpServerResponse.setHeader("x-request-id", id)),
    );
  });
```

Provide `SecureRandom.layerWebCrypto` or the selected runtime service at startup.
A tracer span ID is a separate propagation contract.
The missing reusable middleware must also define duplicate-header handling, rejected upstream IDs, and decoration of errors.
See [SecureRandom](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/crypto/SecureRandom.ts).

## Secure headers

Path: `hono/secure-headers`.
Use existing `SecureHeaders.middleware(config)` outside route-local code after converting the relevant domain errors to responses.
Its current implementation uses `Effect.map`, so it decorates successful response values, not every failure that the outer server later converts.
Use a host-owned final response policy if security headers must also appear on uncaught failures.
Configure HSTS only where HTTPS deployment guarantees make it valid.
Configure CSP for the actual renderer and asset origins rather than copying a broad policy.
Nonce generation, nonce insertion into rendered scripts, and React/effront integration are outside this middleware's ownership.
Do not return unvalidated CSP directive values from request data.
See [existing SecureHeaders source](https://github.com/totto2727-org/effect-http/blob/feat/hono-http-utilities/src/secureHeaders.ts).

## Timeout

Path: `hono/timeout`.
Use `Effect.timeoutOrElse` to map only this handler deadline to a response.
`Effect.timeout` plus recovery of `TimeoutError` is also available, but a generic catch can also catch a downstream operation's independent timeout.
The following pattern uses 504 to match Hono's default, not because every application timeout is a gateway failure.
Choose 503 or another status only as an explicit application policy.

```ts
import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";

export const deadline = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  handler.pipe(
    Effect.timeoutOrElse({
      duration: "2 seconds",
      orElse: () => Effect.succeed(HttpServerResponse.text("Gateway Timeout", { status: 504 })),
    }),
  );
```

Timeout interrupts interruptible Effect work and waits for interruption/finalization according to Effect semantics.
It cannot undo a database write, cancel a raw Promise that has no cancellation integration, or preempt a long synchronous function.
An uninterruptible region can delay the timeout response.
The handler deadline does not impose a deadline on a response stream consumed later by the server.
A stream deadline requires its own stream policy and cannot rewrite the status after headers are sent.
Avoid a separate `Promise.race` timer, which can leave untracked work running.
See [Effect.timeout](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/Effect.ts) and [Hono timeout](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/middleware/timeout/index.ts).

## Timing

Path: `hono/timing`.
Use `Clock.currentTimeMillis` before and after an effect for response-construction duration, or `Effect.withSpan` for traced operations.
For Server-Timing, serialize controlled metric names and numeric durations and add the header before final transmission.
Do not put raw SQL, tokens, internal hostnames, or user-controlled descriptions into the header.
Use request-local state only if multiple named measurements must contribute to one header.
Timing a handler is not a measurement of the full response stream or client delivery.
Tracing is already available, while a reusable Server-Timing registry/serializer would be additional glue.

## Trailing slash

Path: `hono/trailing-slash`.
For matching tolerance, provide `HttpRouter.RouterConfig` with `ignoreTrailingSlash: true` when constructing the router.
That does not redirect clients or define one canonical URL.
For canonicalization, inspect the path before routing and return `HttpServerResponse.redirect(location, { status: 308 })` while preserving the query.
Use a relative local Location and never trust an arbitrary Host header to build a redirect target.
Exclude root, avoid redirect loops, and decide how duplicate slashes and escaped separators are handled.
Hono's redirect-on-404 behavior is route-sensitive and is not reproduced by a blanket pre-routing redirect.
Do not apply URL normalization to effront assets or routing without its integration contract.
See [Hono trailing-slash](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/middleware/trailing-slash/index.ts).

## Cookie

Path: `hono/cookie`.
Read `request.cookies`, use `HttpServerResponse.setCookie` for validated serialization, and use `expireCookie` with the same path/domain attributes for deletion.
These setters return effects because invalid cookie names or options can fail.
Effect cookie `maxAge` accepts `Duration.Input`, where a numeric value is milliseconds, while Hono's numeric `maxAge` is seconds.
Use an explicit duration such as `"1 hour"` instead of copying the number unchanged.
Choose HttpOnly, Secure, SameSite, and path explicitly, and enforce __Host- constraints rather than merely adding the prefix.
Signed cookies require an authenticated envelope in addition to serialization.
Obtain the service with `yield* Mac.Mac`, then call its `sign(key, bytes)` and `verify(key, tag, bytes)` operations with fixed encoding and a versioned format.
`verify` returns false for a wrong tag and uses timing-safe comparison.
Do not compare signatures with ordinary string equality.
Separate absent, malformed, invalid signature, and crypto-service failure outcomes.
Signatures do not encrypt values or impose expiry unless the authenticated payload includes and validates expiry.

```ts
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

export const cookieApp = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const theme = request.cookies.theme === "dark" ? "dark" : "light";
  return yield* HttpServerResponse.setCookie(HttpServerResponse.text(theme), "theme", theme, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
});
```

To preserve existing Hono cookies, MAC the UTF-8 value with HMAC-SHA-256, append a dot and the standard padded Base64 tag, and let cookie serialization percent-encode the combined value once.
On read, split the decoded cookie at the last dot and verify the tag over the original value bytes.
Hono only attempts verification for a 44-character tag ending in `=`.
Its helper returns undefined for absent or structurally ignored input, false for a structurally valid but wrong signature, and the unsigned value for a valid signature.
Test these details against fixtures before switching writers.
Do not assume a new Base64Url or versioned envelope is wire-compatible.
See [Hono cookie helper](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/helper/cookie/index.ts), [Hono cookie codec](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/utils/cookie.ts), and [Mac service](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/crypto/Mac.ts).

## Conninfo

Path: `hono/conninfo`.
Use request `peerAddress` for the transport peer and `remoteAddress` for the selected client address.
Both are optional and depend on the runtime adapter.
Use trusted proxy processing only at a documented boundary, as in [IP restriction](#ip-restriction).
Do not synthesize a source port or address family if the host does not provide it.
Connection metadata is not a reliable user identity or authorization factor on its own.

## Proxy

Path: `hono/proxy`.
Convert with `HttpServerRequest.toClientRequest`, set a deployment-controlled upstream URL, execute with `HttpClient`, and convert with `HttpServerResponse.fromClientResponse`.
Keep the upstream response scope alive until its body is consumed.
Do not perform an inner scoped client call that closes before the downstream stream is sent.
Preserve interruption and backpressure rather than buffering an unbounded upstream response.
Strip hop-by-hop headers on both directions, including names nominated by Connection according to a documented strictness policy.
Decide Host, Authorization, Cookie, Set-Cookie, forwarded headers, redirects, and upstream error mapping explicitly.
A redirect-following client can escape the original SSRF allow-list unless each destination is checked or redirects are disabled.
Do not forward credentials to a request-controlled destination.
The converters alone do not establish this security boundary, so a production proxy requires more than two conversion calls.
Inbound `xForwardedHeaders` is already implemented by Effect and is not the missing outbound proxy policy.
See [request conversion](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpServerRequest.ts), [response conversion](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpServerResponse.ts), and [Hono proxy](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/helper/proxy/index.ts).

## Validation boundaries

The examples target the installed Effect 4.1.4 source, not the older `@effect/platform` import layout.
Typechecking establishes signatures and service/error requirements, not compression on the wire, interruption timing, adapter body limits, or cryptographic interoperability.
All ten TypeScript fences were extracted and passed strict typechecking against the installed baseline.
Web-handler checks exercised bearer acceptance/rejection, uncompressed and expanded body overflow (413), malformed gzip (400), unsupported coding (415), unread compressed-body laziness, cookie headers, concurrent request-ID isolation, and timeout finalization.
A separate Web-platform compression check verified that direct evaluation is uncompressed while the HTTP boundary emits valid gzip bytes, with q=0 and small-body Vary behavior.
IP checks covered normal and mapped addresses, missing/malformed input, denial before handler execution, and trusted versus untrusted forwarded chains.
The compression smoke check used a no-op filesystem only to supply the real Web HttpPlatform layer and did not test file serving.
JWT/JWKS cryptographic verification, Basic-auth API integration, signed-cookie interoperability, production adapters, and outbound proxy lifetime were not runtime-tested here.
Run the actual server or Web handler boundary for those acceptance checks.
Renderer, static serving, and related effront integration are outside this document.
`hono/method-not-allowed` and `hono/method-override` remain excluded rather than being implied middleware exports.
