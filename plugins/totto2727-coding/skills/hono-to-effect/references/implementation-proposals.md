# Implementation proposals

This reference serves maintainers who decide which reusable HTTP policies belong in effect-http.
It is a proposal, not an implementation plan approved for execution.
No API described as proposed below is an existing export.
Use [Middleware recipes](./middleware.md) for the migration that is possible now.

## Contents

- [Evidence and package boundary](#evidence-and-package-boundary)
- [Priority summary](#priority-summary)
- [IP restriction](#ip-restriction)
- [Request ID](#request-id)
- [Signed cookies](#signed-cookies)
- [Authentication adapters](#authentication-adapters)
- [HTTP timeout mapping](#http-timeout-mapping)
- [Eager body gate](#eager-body-gate)
- [Outbound proxy policy](#outbound-proxy-policy)
- [Server timing](#server-timing)
- [Language selection](#language-selection)
- [Canonical slash policy](#canonical-slash-policy)
- [Do not add duplicate middleware](#do-not-add-duplicate-middleware)
- [Acceptance and dependency policy](#acceptance-and-dependency-policy)

## Evidence and package boundary

The inspected package index exports exactly `Accepts`, `CacheControl`, `ConditionalRequest`, `Csrf`, `ResponseCache`, and `SecureHeaders`.
See the [fixed effect-http index](https://github.com/totto2727-org/effect-http/blob/a6b9ee6409a54c510108e49a92068303061d48cd/src/index.ts).
These are existing repository APIs, not evidence that every remaining Hono middleware is already packaged.
Registry publication is a separate operational concern.

The baseline is [Hono f6fbaf0](https://github.com/honojs/hono/tree/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src), [Effect 4.1.4 at 3e2030b](https://github.com/Effect-TS/effect/tree/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src), and [effront 3c8c55c](https://github.com/totto2727-org/effront/tree/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614).
The distinction is between a cryptographic, networking, or effect primitive and a complete reusable HTTP policy.
Available primitives remove the need to rebuild cryptography, timers, or CIDR parsers.
They do not remove the need for parsing, trust policy, request-local services, error mapping, final-response integration, and security tests.

Propose narrow Effect-native adapters, not a Hono `Context` compatibility framework.
Keep credential storage, role decisions, issuer selection, upstream selection, locale precedence, and deployment trust in the application.
Keep rendering, static files, RSC/Flight, Server Functions, runtime deployment integration, and nonce insertion in effront or its underlying platform.
The excluded `hono/method-not-allowed` and `hono/method-override` do not become implementation candidates through this review.

## Priority summary

| Priority | Proposed area             | Hono paths                                                    | Recommendation                                                                   |
| -------- | ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1       | `IpRestriction`           | `hono/ip-restriction`, `hono/conninfo`                        | Implement a pure decision engine and thin middleware                             |
| P1       | `RequestId`               | `hono/request-id`                                             | Implement request service, trust validation, logs, and final response header     |
| P1       | `SignedCookies`           | `hono/cookie`, `hono/utils/cookie`                            | Implement authenticated codec and cookie helpers without new cryptography        |
| P1       | `Authentication` adapters | `hono/basic-auth`, `hono/bearer-auth`, `hono/jwt`, `hono/jwk` | Implement credential extraction and HTTP integration, inject verification policy |
| P2       | `HttpTimeout`             | `hono/timeout`                                                | Small candidate only if a reusable response/error contract is needed             |
| P2       | `BodyGate`                | `hono/body-limit`                                             | Implement only for demonstrated eager-rejection requirements                     |
| P2       | `Proxy`                   | `hono/proxy`                                                  | Implement a constrained streaming forwarder, not an open proxy                   |
| P3       | `ServerTiming`            | `hono/timing`                                                 | Optional serializer and request-local measurement registry                       |
| P3       | `Language`                | `hono/language`                                               | Optional header-only adapter, keep detector precedence in apps                   |
| P3       | `CanonicalPath`           | `hono/trailing-slash`                                         | Optional explicit redirect policy, not router-history inspection                 |

P1 means a reusable security-sensitive HTTP boundary is absent and copy-paste is error-prone.
P2 means the primitive composition is short or scope-sensitive, so adopt it only when the documented shared behavior is useful.
P3 means application policy dominates or existing functionality already solves the common case.
These priorities are recommendations, not measured demand or a release commitment.

## IP restriction

**Paths:** `hono/ip-restriction`, with `hono/conninfo` as input.
**Existing primitives:** `IpNetwork.fromString`, `IpNetwork.contains`, `NetAddress.ipFromString`, address canonicalization, optional `remoteAddress` and `peerAddress`, and `HttpMiddleware.xForwardedHeaders`.
See [Effect trusted proxies](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpMiddleware.ts) and [Hono rule implementation](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/middleware/ip-restriction/index.ts).

**Missing behavior:** A reusable allow/deny policy with validated startup configuration, explicit rule precedence, unknown-address handling, mapped-address normalization, and a uniform 403 boundary.
CIDR membership alone is not a middleware.
**Suggested scope:** Proposed `IpRestriction.compile(config)`, `decide(policy, address)`, and `middleware(policy)`.
Represent the decision as allowed or rejected with a machine-readable reason.
Validate CIDRs at startup and define deny-before-allow and the meaning of an empty allow-list.
Select peer versus trusted normalized client address explicitly.
Do not parse forwarded headers again or invent a second trusted-proxy implementation.

**Security:** Fail closed for missing/malformed addresses by default, never trust a header without checking the transport peer, and avoid leaking internal rule configuration in the response.
Do not imply IP addresses are authenticated user identities.
**Tests:** IPv4, IPv6, mapped IPv4-in-IPv6, exact hosts, prefix edges, /0, invalid CIDR, overlapping allow/deny, missing peer, spoofed X-Forwarded-For, multiple proxy hops, and a blocked handler that demonstrably does not execute.
**Dependencies:** Effect net/http only, no IP parsing package.
**Boundary:** A generic network gate belongs here, while deployment proxy ranges and business access policy remain application configuration.

## Request ID

**Path:** `hono/request-id`.
**Existing primitives:** The `SecureRandom.SecureRandom` service's `uuidV4` operation, `Context.Service`, `Effect.annotateLogs`, and pre-response handlers.
[Hono's implementation](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/middleware/request-id/request-id.ts) accepts an incoming value only within a length and character limit and stores it in context.

**Missing behavior:** One reusable contract that generates or accepts one ID, provides it to all downstream work, annotates logs, and writes the same final response header, including error responses.
**Suggested scope:** Proposed `RequestId.RequestId` service and `RequestId.middleware({ headerName, acceptIncoming, maxLength, generate })`.
Make incoming trust opt-in and keep the default generator effectful and injectable.
Register the response handler after the ID is chosen, before downstream code runs.
Do not make the UUID service requirement disappear through an unsafe assertion.

**Security:** Reject invalid characters, empty values, overlong IDs, and ambiguous combined header values.
Bound IDs before adding them to logs.
Do not equate a request ID with a distributed trace ID, principal, or idempotency key.
**Tests:** Fresh IDs per concurrent request, stable service/log/header equality, trusted versus untrusted input, oversized and combined values, downstream typed failure, and absence of cross-request state leakage.
**Dependencies:** Effect crypto/http only.
**Boundary:** This is nontrivial reusable plumbing despite the short UUID generation call.
Applications still decide whether a specific upstream is trusted.

## Signed cookies

**Paths:** `hono/cookie`, relevant `hono/utils/cookie` helpers.
**Existing primitives:** `Cookies`, request cookies, effectful response cookie setters, `Mac` HMAC keys/sign/verify, and Base64/Base64Url codecs.
See [Mac](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/crypto/Mac.ts) and [Hono cookie wire codec](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/utils/cookie.ts).

**Missing behavior:** Authenticated wire encoding, strict decoding, key rotation, malformed-input classification, and safe integration with cookie serialization.
A MAC primitive alone does not define these rules.
**Suggested scope:** Proposed `SignedCookies.encode`, `decode`, `read`, and `set`.
Use an injected current key and bounded verification key ring.
Define a versioned authenticated envelope and distinguish absent, invalid, and verified outcomes from infrastructure failure.
Offer Hono wire interoperability only as an explicitly tested codec mode, not an undocumented format assumption.

**Security:** Verify tags through `Mac.verify`, authenticate the complete envelope, bound all inputs, and prevent substitution between cookie names or applications through domain separation for a new codec.
Do not silently change Hono's signed input when claiming compatibility.
A new format can bind cookie name and version, while the Hono-compatible mode must retain Hono's actual signed bytes.
Document that signing is not encryption or session expiry.
Preserve __Host-/__Secure-, Secure, SameSite, path, and domain constraints through existing serializers.
**Tests:** Hono-generated fixtures in both directions, Unicode, URL escaping, dots in values, invalid Base64, tag truncation, wrong keys, rotation, maximum length, missing cookie, prefix constraints, expiry if supported, and ordinary valid unsigned-cookie behavior remaining separate.
**Dependencies:** Effect Mac, SecureRandom layer dependency where required, encoding, and HTTP cookies only.
**Boundary:** Session storage, refresh/revocation policy, and encryption remain outside the helper.

## Authentication adapters

**Paths:** `hono/basic-auth`, `hono/bearer-auth`, `hono/jwt`, `hono/jwk`.
**Existing primitives:** `HttpApiSecurity.basic` and `.bearer`, `HttpApiMiddleware.Service`, redacted credentials, `Jwt.verify`, `Jwt.verifyWithKeySet`, `Jwks` local/remote layers, schema decoding, and crypto services.
See [HttpApiSecurity](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http-api/HttpApiSecurity.ts) and [Jwt](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jwt.ts).

**Missing behavior:** Plain-handler credential extraction and challenge responses, typed principal provision, credential-source policy, and consistent mapping of malformed/invalid credentials versus verification service failure.
The API security scheme is not a ready authentication service.
**Suggested scope:** Proposed `Authentication.basic`, `.bearer`, and a JOSE verifier adapter that accepts a schema, configured verification policy, and a principal mapper.
Accept effectful verifier functions rather than credentials embedded in middleware configuration.
For HttpApi users, provide an adapter or documented layer recipe over existing security services, not a second API framework.
Keep 401 challenge construction and 403 authorization distinct.

**Security:** Default to Authorization only, reject ambiguity, require algorithm allow-lists, support mandatory issuer/audience/expiry policy configuration, and redact tokens from errors/logs.
Never fetch a token-supplied JWK URL.
Construct remote JWKS services once with bounded cache/refresh settings and configured HTTPS origins.
Supply a no-redirect HTTP client, because the built-in post-response redirect rejection cannot prevent a client from already following the redirect.
Do not accept `decodeUnverified` output as authentication.
Keep credential rejection separate from key retrieval outages and other operational failures.
**Tests:** Missing header, malformed Base64/basic encoding, username/password edge cases, scheme casing, duplicate or combined credentials, invalid signature, disallowed algorithm, wrong issuer/audience, expired/not-yet-valid/missing required claims, rotated/missing key IDs, network failure, challenge formatting, and principal isolation under concurrency.
**Dependencies:** Effect http-api/jose/crypto and injected HttpClient only, no parallel JOSE library.
**Boundary:** Identity provider choice, password verification, token introspection, authorization, and user persistence remain application-owned.
A complete login/session framework is not proposed.

## HTTP timeout mapping

**Path:** `hono/timeout`.
**Existing primitives:** `Effect.timeout`, `Effect.timeoutOrElse`, interruption, scopes, and response constructors.
See the [current recipe](./middleware.md#timeout).

**Missing behavior:** A common HTTP deadline contract and response mapping, not timer scheduling.
**Suggested scope:** Proposed `HttpTimeout.middleware({ duration, onTimeout })` only when applications need the same timeout response and observability policy repeatedly.
Prefer `Effect.timeoutOrElse` or the existing typed `TimeoutError` path, not `Promise.race`.
Do not accidentally catch a downstream operation's unrelated timeout as the outer request deadline.
A dedicated timeout error or local fallback can preserve that distinction.

**Security and runtime:** Retain interruption/finalizers, do not hide defects, and do not promise rollback or cancellation of non-cooperative Promises.
Document that uninterruptible work can delay the response and that response-construction deadlines do not limit later streaming.
**Tests:** Completion before deadline, deadline response, finalizer execution, client cancellation, uninterruptible section, downstream independent TimeoutError, and a response stream that outlives handler completion.
**Dependencies:** Effect only, no timer package.
**Boundary:** This is a small optional convenience API.
A one-off application can use direct composition without creating a package feature.

## Eager body gate

**Path:** `hono/body-limit`.
**Existing primitives:** `MaxBodySize`, limited buffered request reads, decompression's expanded-byte limit, Stream, and request replacement.
See [body-limit semantics](./middleware.md#body-limit).

**Missing behavior:** An optional guarantee that an oversized unknown-length body is rejected before the protected handler can perform side effects.
The existing lazy readers cannot give that guarantee for unread bodies.
**Suggested scope:** Proposed `BodyGate.buffered({ maxBytes })` for deliberately bounded payloads only.
Consume once, check the actual byte count, and give downstream code a coherent replacement request/body view.
Keep a streaming counting transform separate and name its weaker late-failure guarantee.
Define compressed versus expanded limits explicitly, apply decompression before the expanded gate, and avoid leaking the original compressed Web source through a replacement that claims expanded semantics.

**Security:** Never trust Content-Length as sole enforcement, bound memory, and reject malformed lengths/encodings consistently.
Do not duplicate decompression or multipart parsers.
**Tests:** Length absent, chunked overflow, false Content-Length where the adapter permits it, unread body, exact boundary, malformed compressed data, expansion bomb, multipart overflow, second-accessor consistency, and handler non-execution on eager rejection.
**Dependencies:** Effect http/Stream only.
**Boundary:** This is conditional scope because buffering trades away streaming and can conflict with host-owned request handling.
It must not be installed globally over effront's streaming protocols.

## Outbound proxy policy

**Path:** `hono/proxy`.
**Existing primitives:** HttpClient, request/response conversion, scoped streams, Headers, and inbound trusted-proxy normalization.
See [Hono proxy source](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/helper/proxy/index.ts) and the [migration recipe](./middleware.md#proxy).

**Missing behavior:** Safe bidirectional header filtering, upstream URL construction, redirect policy, stream lifetime transfer, and typed upstream error mapping.
**Suggested scope:** Proposed `Proxy.forward({ upstream, requestHeaders, responseHeaders, redirectPolicy })` for a fixed or allow-listed upstream.
Share a pure hop-by-hop filtering function and retain cancellation/backpressure through the server response scope.
Strip standard hop-by-hop headers and define handling of Connection-nominated names, including attempts to nominate security-sensitive headers.
Do not reuse a server request's client-supplied Host as the upstream authority.

**Security:** Block open-proxy/SSRF use by default, avoid cross-origin credential forwarding, validate redirects or disable them, and document DNS/private-address concerns where upstream URLs are dynamic.
Filter response cookies according to explicit application policy.
**Tests:** Connection lists and casing, nominated headers, Host replacement, Authorization/Cookie stripping, multiple Set-Cookie fields, redirects, upstream timeout/disconnect, client abort, large streaming bodies, no-body statuses, and scope lifetime through full body consumption.
**Dependencies:** Effect HttpClient/http only, with a runtime client provided by the host.
**Boundary:** Inbound trusted proxy processing already exists and should not be reimplemented.
Service routing, retries of unsafe methods, and arbitrary public proxy endpoints are application concerns.

## Server timing

**Path:** `hono/timing`.
**Existing primitives:** Clock, spans, request-local Context, and response headers.
**Missing behavior:** Safe Server-Timing serialization and aggregation of multiple named measurements.
**Suggested scope:** Optional proposed `ServerTiming.measure(name, effect)` and `ServerTiming.middleware`, plus a pure serializer.
Use controlled token names, numeric durations, properly escaped optional descriptions, and final-response integration.
Do not include internal measurements by default on public endpoints.
**Tests:** Multiple measurements, duplicate names, concurrent fibers, invalid names, quote/control-character handling, error responses, and no assertion that a header measures complete client delivery.
**Dependencies:** Effect Clock/Context/http only.
**Boundary:** Existing tracing already solves observability for many users.
Do not add a registry merely to rename `withSpan`.

## Language selection

**Path:** `hono/language`.
**Existing primitives:** Existing `Accepts` language negotiation, request query/cookies/path, and Context.
**Missing behavior:** Selected-language service, header variation, and optional persistence of a choice.
**Suggested scope:** A small optional header-only adapter over `Accepts`, not a new language parser.
Applications specify supported languages, fallback, detector precedence, and whether a cookie is written.
Do not silently reproduce Hono's detector order as a universal default.
**Tests:** Quality ordering, exclusions, wildcard, malformed versus unmatched, supported-language validation, fallback, Vary merging, and cache key separation.
**Dependencies:** Existing `Accepts` and Effect only.
**Boundary:** Query/cookie/path precedence and localization resources remain application-owned.
Prefer a documented composition until repeated use establishes a stable adapter contract.

## Canonical slash policy

**Path:** `hono/trailing-slash`.
**Existing primitives:** RouterConfig.ignoreTrailingSlash and explicit redirect responses.
**Missing behavior:** Canonical redirect construction that preserves query parameters and has a documented method/status policy.
**Suggested scope:** Optional proposed `CanonicalPath.middleware({ trailingSlash, status })` for explicit opt-in route families.
Do not inspect route history or automatically turn a 404 into a redirect unless the router exposes a supported inventory contract.
**Security:** Return local relative locations, preserve escaped path semantics, reject unsafe authority-like locations, and avoid Host-header open redirects.
**Tests:** Root, query preservation, duplicate slash, encoded slash, percent escapes, POST/308, loop prevention, and unmatched routes.
**Dependencies:** Effect http and URL primitives only.
**Boundary:** Matching tolerance is already implemented.
Global canonicalization and effront URL policy are not justified by the Hono helper alone.

## Do not add duplicate middleware

The following remain direct composition or already implemented policy:

- `hono/compress`: Existing Effect compression, with runtime HttpPlatform and deferred pre-response semantics.
- `hono/cors`: Existing Effect CORS, with explicit origin/credentials configuration.
- `hono/logger`: Existing logger/tracer and application logging configuration.
- `hono/context-storage`: Request-local Context services, not a new synchronous context API.
- `hono/combine`: Effect sequencing, branching, and typed recovery.
- `hono/mount`: Web-handler conversion and router prefix configuration.
- `hono/powered-by`: A response header setter/remover.
- `hono/pretty-json`: Representation construction in the JSON-producing handler.
- `hono/cache`, `hono/csrf`, `hono/etag`, `hono/secure-headers`, and `hono/accepts`: The existing six namespaces already cover the documented bounded scope, including `CacheControl` alongside `ResponseCache`.

No candidate rebuilds a renderer, static file server, range implementation, RSC cache, nonce insertion, host adapter, WebSocket event framework, method override, or automatic Allow discovery.

## Acceptance and dependency policy

Before adopting a proposal, define the public behavior and test it through the real HTTP boundary as well as pure decision tests.
Typechecking cannot establish wire headers, stream lifetime, deferred compression, cancellation timing, or Hono cookie interoperability.
Keep the Effect peer dependency and runtime services visible in signatures.
No candidate currently requires a new third-party runtime dependency.
Do not add packages merely to avoid composing Effect's existing primitives.
For each implemented adapter, export it only after its behavior, error mapping, and service requirements are documented and acceptance tests pass.
