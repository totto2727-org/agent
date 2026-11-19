# Utility and helper migration recipes

Audience: application authors who currently import Hono helpers or low-level utilities and need an explicit replacement, not a Hono-compatible utility package.
The baseline is Hono `f6fbaf0299c48eea9e656e03e2ffe7ac755e8823` and Effect 4.1.4 `3e2030b43e86a60113f2f32671076ff3b1d84ce4`.
Every supported utility path has its own mapping below, including nested JWT paths that reach related implementations.
Each TypeScript block is a separate module.
Read [core recipes](core.md) for request, router, client, streaming, WebSocket, connection, and test boundaries.
The root matrix owns the excluded paths and effront rendering inventory; this document does not implement those contracts.

## Contents

- [Body and byte conversion](#body-and-byte-conversion)
- [Encoding and crypto](#encoding-and-crypto)
- [Headers, status, and MIME](#headers-status-and-mime)
- [URLs, mounts, and files](#urls-mounts-and-files)
- [Concurrency and compression](#concurrency-and-compression)
- [IP addresses](#ip-addresses)
- [Authentication and cookies](#authentication-and-cookies)
- [JWT paths](#jwt-paths)
- [Proxy](#proxy)
- [Negotiation and rendering delegation](#negotiation-and-rendering-delegation)
- [Sources and verification boundaries](#sources-and-verification-boundaries)

## Body and byte conversion

### hono/utils/body

1. Replace Hono body parsing with the `HttpServerRequest` body reader for the accepted content type.
2. Decode the resulting shape with `schemaBodyJson`, `schemaBodyUrlParams`, `schemaBodyForm`, or `schemaBodyMultipart`.
3. Supply filesystem, path, and scope services at the host composition root for persisted multipart processing.
4. Convert decoded fields to your domain model once, including your own repeated-key and dotted-key policy.

```ts
import { Effect, Schema } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http";

const Form = Schema.Struct({ title: Schema.String });
const handler = Effect.gen(function* () {
  const form = yield* HttpServerRequest.schemaBodyUrlParams(Form);
  return yield* HttpServerResponse.json({ title: form.title });
});

export const fetch = HttpEffect.toWebHandler(Effect.interruptible(handler));
```

This endpoint accepts URL-encoded form fields, not an unrestricted mixture of uploads and JSON.
`schemaBodyForm` dispatches multipart versus URL-encoded parsing and can require host filesystem services even when one particular request is URL-encoded.
For large uploads, consume `request.multipartStream` and enforce limits while processing, rather than buffering or persisting everything first.
Hono's `{ all: true }`, dotted property expansion, body cache, and array normalization are not reproduced automatically.
Use the [request recipe](core.md#requests-and-validation) for JSON validation and error mapping.

### hono/utils/buffer

1. Use `Uint8Array` to carry bytes across HTTP and crypto APIs.
2. Use `TextEncoder` and `TextDecoder` for UTF-8 rather than treating binary data as a JavaScript string.
3. Choose strict decoding when malformed UTF-8 is invalid application input.
4. For standard multipart Web requests, use `Request.formData()` or `Response.formData()` where the Web API boundary is appropriate; keep Effect server upload handling in the body reader above.
5. Verify secrets with the crypto service that owns the signature or MAC, not with a handwritten byte equality loop.

```ts
export const encodeUtf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

export const decodeUtf8 = (bytes: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);

export async function readWebForm(request: Request): Promise<FormData> {
  return request.formData();
}
```

Strict `TextDecoder.decode` can throw for invalid bytes; if it is used inside Effect domain code, capture that boundary failure with `Effect.try` and a domain-appropriate error.
`Uint8Array` equality is not authentication and is not promised to be timing-safe.
A slice or view may share its underlying buffer; copy with `new Uint8Array(bytes)` when ownership requires isolation.

## Encoding and crypto

### hono/utils/encode

1. Replace Base64 helpers with `Base64.encode`, `Base64.decode`, or `Base64.decodeString`.
2. Select `Base64Url` for URL-safe token segments, not a manual `+` and `/` substitution.
3. Handle the decoder's `Result`, including malformed external input.
4. Keep bytes as bytes when the data is not UTF-8 text.

```ts
import { Result } from "effect";
import { Base64, Base64Url } from "effect/encoding";

export const standard = Base64.encode(new TextEncoder().encode("hello"));
export const urlSafe = Base64Url.encode("hello");

export const decoded = Result.match(Base64Url.decode(urlSafe), {
  onFailure: (error) => ({ ok: false as const, error }),
  onSuccess: (bytes) => ({ ok: true as const, bytes }),
});
```

Decode returns `Result<Uint8Array, EncodingError>`, not a Promise and not an Effect requiring a runtime.
`Base64Url.encode` emits unpadded output; use `encodePadded` only when the protocol requires padding.
Text decoding and signature verification are separate operations; Base64URL decoding a JWT never authenticates it.

### hono/utils/crypto

1. Encode input text as UTF-8 bytes.
2. Obtain `Digest.Digest` from the Effect environment and select an explicit algorithm such as `Digest.sha256`.
3. Return bytes with `digest` or lowercase hexadecimal text with `digestHex`.
4. Let the caller provide the crypto layer at the executable composition root.

```ts
import { Effect } from "effect";
import { Digest } from "effect/crypto";

export const sha256Hex = (input: Uint8Array) =>
  Effect.gen(function* () {
    const digest = yield* Digest.Digest;
    return yield* digest.digestHex(Digest.sha256, input);
  });

const program = sha256Hex(new TextEncoder().encode("hello"));

export const main = program.pipe(Effect.provide(Digest.layerWebCrypto));
```

`sha256Hex` retains `Digest.Digest` in its environment; the final line is an example caller composition, not a layer hidden inside the helper.
Select the host's crypto implementation at that boundary and verify that the host supplies WebCrypto when choosing `layerWebCrypto`.
The layer can build without `crypto.subtle`, but a SHA digest then defects rather than providing a working fallback.
Do not use MD5 or SHA-1 for new authentication or signature designs merely because compatibility algorithms exist.
For authenticated integrity use `Mac` or `Signature` and their verification operations, as described in the cookie and JWS recipes.
A digest is not an HMAC and cannot authenticate a cookie or token.

## Headers, status, and MIME

### hono/utils/headers

1. Normalize raw input with `Headers.fromInput` or read the current request's normalized headers.
2. Use `Headers.get` to obtain an `Option`, or use a known normalized lowercase key on the request record.
3. Use `HttpServerRequest.schemaHeaders` for a required or structured header contract.
4. Set response headers through `HttpServerResponse.setHeader` or `setHeaders`, which return a new response.

```ts
import { Effect, Option, Schema } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";

export const headers = Headers.fromInput({ "X-Example": "one" });
export const value = Option.getOrNull(Headers.get(headers, "x-example"));

export const headerHandler = Effect.gen(function* () {
  const input = yield* HttpServerRequest.schemaHeaders(
    Schema.Struct({ "x-request-id": Schema.String }),
  );
  return HttpServerResponse.text(input["x-request-id"]).pipe(
    HttpServerResponse.setHeader("x-example", "two"),
  );
});
```

A Hono known-header-name union does not validate wire input and does not need a replacement package.
For multi-valued `Set-Cookie`, use `Cookies` and response cookie operations instead of collapsing all cookies into one comma-separated header.
Do not reflect untrusted header values into redirects, host selection, or identity without a separate validation policy.

### hono/utils/http-status

1. Use a numeric response status or `HttpStatus.fromLiteral` for a named code.
2. For typed APIs, annotate success/error schemas with `HttpApiSchema.status` so the generated client shares the status contract.
3. Keep empty-body statuses empty and test the actual response rather than only its TypeScript type.

```ts
import { Schema } from "effect";
import { HttpServerResponse, HttpStatus } from "effect/http";
import { HttpApiSchema } from "effect/http-api";

const status: HttpStatus.Literal = "NotFound";
export const missing = HttpServerResponse.text("Not found", {
  status: HttpStatus.fromLiteral(status),
});

export const MissingBody = Schema.Struct({ error: Schema.Literal("not_found") }).pipe(
  HttpApiSchema.status(404),
);
```

`HttpStatus.Literal` contains names such as `NotFound`, not Hono's numeric status union.
A schema annotation declares a transport status when used by the HTTP API runtime; it does not change an arbitrary low-level response by itself.
Do not reproduce deprecated Hono status aliases or assume all statuses may carry a body.

### hono/utils/mime

1. Use `Mime.getType(path)` to look up a file content type.
2. Handle `Option.none` with your explicit fallback rather than a guessed extension rule.
3. Use `Mime.getExtension(contentType)` for the reverse lookup when needed.
4. For files served by effront or `HttpStaticServer`, leave MIME selection in the existing serving pipeline.

```ts
import { Option } from "effect";
import { HttpServerResponse, Mime } from "effect/http";

export const extension = Mime.getExtension("application/json");
export const fileType = Option.getOrElse(
  Mime.getType("example.json"),
  () => "application/octet-stream",
);
export const response = HttpServerResponse.text("{}", { contentType: fileType });
```

The lookup table and unknown-extension behavior need not match Hono's table byte for byte.
A MIME lookup is not file validation, upload authorization, or proof that arbitrary bytes match their declared type.

## URLs, mounts, and files

### hono/utils/url

1. At a Web boundary, use `URL` and `URLSearchParams` for resolution, escaping, and query access.
2. Inside a server handler, use `HttpServerRequest.toURL(request)` and handle its `Option` when an absolute URL cannot be formed.
3. Use `getAll` for repeated query fields instead of silently converting the first value into the whole request contract.
4. Validate domain values with schemas, then pass the decoded values downstream.

```ts
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

export const urlHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const url = HttpServerRequest.toURL(request);
  return yield* HttpServerResponse.json(
    Option.match(url, {
      onNone: () => ({ path: null, tags: [] as Array<string> }),
      onSome: (value) => ({ path: value.pathname, tags: value.searchParams.getAll("tag") }),
    }),
  );
});

export const target = new URL("../items?tag=a&tag=b", "https://example.test/api/");
```

`request.url` can be relative; do not call `new URL(request.url)` without a known base.
Trusting forwarded host/scheme is a proxy-boundary decision, not an implication of successful URL parsing.
Do not clone Hono route pattern splitting, optional-segment expansion, or malformed-percent-decoding fallbacks.
Use actual Effect router tests for matching and `Url`/`UrlParams` when an Effect-specific URL transformation is needed.

### hono/utils/mount

1. Convert the external Web handler with `HttpEffect.fromWebHandler`.
2. Register the intended prefix or explicit route with `HttpRouter`.
3. Decide whether the external handler sees the full path or a rewritten prefix-stripped path.
4. When rewriting, construct a new Web `Request` only at this boundary, preserving method, body, headers, and cancellation.

```ts
import { HttpEffect, HttpRouter } from "effect/http";

const externalFetch = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  return Response.json({ pathname: url.pathname });
};

export const ExternalRoute = HttpRouter.add(
  "*",
  "/external/*",
  HttpEffect.fromWebHandler(externalFetch),
);
```

This is deliberate full-path forwarding, not an implicit Hono-style prefix stripping example.
`fromWebHandler` converts the active request to Web form and the returned Web response back to Effect form.
It does not synthesize Hono `env`, `executionCtx`, background tasks, or a sub-application Context.
Use the same boundary for `hono/mount` middleware; the [middleware reference](middleware.md) describes its middleware composition placement.
Test exact-prefix requests separately from wildcard children, because router wildcard semantics are not promised to match Hono.

### hono/utils/filepath

1. Keep effront assets in effront's `withAssets` pipeline.
2. For an independent static HTTP root, create `HttpStaticServer.make({ root, index, ... })` once using the host filesystem, path, and HTTP platform services.
3. Register the returned handler on the intended route.
4. Use `Path.Path` for filesystem path operations, not URL concatenation.
5. Validate containment with the static server's safe root resolution rather than rebuilding Hono's default-document helper.

```ts
import { Effect } from "effect";
import { HttpRouter, HttpStaticServer } from "effect/http";

export const registerFiles = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;
  const serve = yield* HttpStaticServer.make({
    root: "/srv/public",
    index: "index.html",
    spa: false,
    cacheControl: "public, max-age=60",
  });
  yield* router.add("GET", "/*", serve);
});
```

`registerFiles` intentionally retains host filesystem, path, and platform services in its environment.
Provide real host services at the caller; `HttpServer.layerServices` includes a no-op filesystem and is not a production file-serving implementation.
The static server already owns file MIME, range, and conditional-response behavior, so do not wrap it in a duplicate file cache or ETag implementation.
The root path is a filesystem path, not a URL or arbitrary client-controlled request value.

## Concurrency and compression

### hono/utils/concurrent

1. Replace a Promise pool with `Effect.forEach` and an explicit concurrency bound.
2. Keep work as Effects so failure interrupts sibling fibers and scopes release their resources.
3. Use the returned ordered results instead of mutating a shared result array.
4. Specify a separate retry or partial-success policy when not all failures should fail the batch.

```ts
import { Effect } from "effect";

export const batch = Effect.forEach([1, 2, 3, 4], (value) => Effect.succeed(value * 2), {
  concurrency: 2,
});
```

A concurrency bound limits active tasks, not incoming queue length or request rate.
Do not wrap an already-started array of Promises and expect the bound to stop those operations from starting.
Interruption can stop Effect-managed work but cannot retroactively cancel an external operation that ignored its abort signal.

### hono/utils/compress

1. Apply `HttpMiddleware.compression(options)` to the handler or through router middleware.
2. Supply `HttpPlatform` from the host composition root.
3. Let the middleware negotiate `Accept-Encoding`, choose a supported algorithm, and determine compressibility.
4. Test content type, known/unknown content length, and any custom threshold relevant to the application.

```ts
import { Effect } from "effect";
import { HttpMiddleware, HttpServerResponse } from "effect/http";

export const compressed = Effect.succeed(
  HttpServerResponse.text("A response body to compress"),
).pipe(HttpMiddleware.compression({ algorithms: ["gzip"], minSize: 16 }));
```

The result still requires the current request and `HttpPlatform`; it is not a closed program suitable for `Effect.runSync`.
The default preference is `br`, `gzip`, then `deflate`; unknown-length bodies are compressed without a known-size threshold check.
Use the middleware's `compressible` option only when the application's content policy requires it, rather than copying Hono's regex as a second exported helper.
Request decompression is a separate operation with its own expanded-size limit; response compression does not protect inbound bodies.

## IP addresses

Path: `hono/utils/ipaddr`.

1. Parse addresses with `NetAddress.ipFromString` and networks with `IpNetwork.fromString`.
2. Handle each parse `Result` before using the value.
3. Compare a parsed address to a parsed network with `IpNetwork.contains`.
4. Format through `NetAddress.formatIp` or `IpNetwork.format` instead of relying on Hono bigint representations.

```ts
import { Result } from "effect";
import { IpNetwork, NetAddress } from "effect/net";

export function inNetwork(
  address: string,
  network: string,
): Result.Result<boolean, NetAddress.NetAddressError> {
  return Result.flatMap(NetAddress.ipFromString(address), (ip) =>
    Result.map(IpNetwork.fromString(network), (cidr) => IpNetwork.contains(cidr, ip)),
  );
}
```

When used for access control, reject invalid input explicitly instead of treating a parse failure as membership.
Decide IPv4-mapped IPv6 policy deliberately and test it with the actual address families accepted by the host.
Use a trusted transport peer or a validated proxy policy as the address source, not an arbitrary client header.
The [connection recipe](core.md#connection-information) covers missing addresses and host limitations.
The `hono/ip-restriction` middleware recipe owns the allow/deny policy; this utility only parses and compares addresses.

## Authentication and cookies

### hono/utils/basic-auth

For application authentication, follow the [Better Auth migration policy](middleware.md#authentication).
If a separate integration requires raw parsing, check the Basic scheme, limit the input size, decode with `Base64.decode`, and split valid UTF-8 at the first colon.
Parsing does not verify credentials.

### hono/cookie and hono/utils/cookie

1. Read parsed request cookies from `HttpServerRequest.HttpServerRequest.cookies`.
2. For raw header work, use `Cookies` parse/serialization operations rather than a new delimiter parser.
3. Set cookies with `HttpServerResponse.setCookie` and remove them with `expireCookie`, retaining the resulting response or Effect and its validation failures.
4. For signed cookies, use `Mac.Mac` to sign and verify a canonical byte representation, with explicit key selection and expiry policy.
5. Inject crypto services and secrets at the top-level caller, not inside the cookie helper.

Use the concrete [cookie recipe](middleware.md#cookie) for response setters, signing, and verification.
`hono/cookie` maps the Context-facing read/set/delete calls to request and response APIs.
`hono/utils/cookie` maps low-level parsing, serialization, and signature handling to `Cookies` and `Mac` without recreating Hono option types.
A signed cookie is not encrypted and does not hide its value.
Keep `Secure`, `HttpOnly`, `SameSite`, path/domain, prefix constraints, and key rotation explicit; verify before trusting a cookie-derived identity.
Expire a cookie with the same scope used when setting it.

## JWT paths

Use these mappings for token processing outside [application authentication](middleware.md#authentication).
The following mappings remain separate because the Hono wildcard exposes each import independently.
No mapping means that token decoding alone authenticates a request.

### hono/utils/jwt

1. Replace the barrel's signing and verification calls with `Jwt.sign`, `Jwt.verify`, or `Jwt.verifyWithKeySet`.
2. Declare the payload schema and required issuer, audience, expiration, and algorithm policy.

This fixed export and `hono/utils/jwt/index` happen to reach the same Hono implementation but remain different migration paths.
Effect verification returns a structured result with decoded claims and protected-header information, not Hono's payload alias.

### hono/utils/jwt/index

1. Remove the nested barrel import rather than creating another local barrel that mimics Hono's `Jwt` object.
2. Import `Jwt` and, for rotating keys, `Jwks` from `effect/jose`.
3. Apply the same verification and signing workflow as `hono/utils/jwt`.

The filename `index` does not require a second runtime implementation or a separate validation policy.

### hono/utils/jwt/jwa

1. Select an allowed `Jwk.Algorithm` at configuration time.
2. Import or generate a key using JWK APIs that constrain its algorithm and purpose.
3. Retain `Jwk.SigningKey` or `Jwk.VerificationKey` types across calls instead of passing Hono's permissive key unions.
4. Provide `Mac` for symmetric operations and `Signature` for asymmetric operations according to the chosen key type.

Do not trust an attacker-controlled token `alg` to select an arbitrary verification algorithm or key.
The concrete JWS recipe below imports an HS256 secret key and leaves the crypto service to the caller.

### hono/utils/jwt/jws

1. Import the configured key with `Jwk.importSecret` for an octet key, or the public/private-key import API for the selected asymmetric algorithm.
2. Sign arbitrary payload bytes with `Jws.sign`.
3. Verify the compact token with `Jws.verify` using the configured key.
4. Decode the verified payload only after verification succeeds.

```ts
import { Effect, Layer, Redacted } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Jwk, Jws } from "effect/jose";

export const roundTrip = (secret: Redacted.Redacted<Jwk.SecretJwk>) =>
  Effect.gen(function* () {
    const key = yield* Jwk.importSecret(secret, "HS256");
    const token = yield* Jws.sign(new TextEncoder().encode("hello"), key);
    const verified = yield* Jws.verify(token, key);
    return new TextDecoder("utf-8", { fatal: true }).decode(verified.payload);
  });

const CryptoLive = Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));

export const runRoundTrip = (secret: Redacted.Redacted<Jwk.SecretJwk>) =>
  Effect.runPromise(roundTrip(secret).pipe(Effect.provide(CryptoLive)));
```

Supply generated, appropriately sized secret key material from a secret store at the caller, never a tutorial secret in production.
The compact token returned by signing is `Redacted<string>`; keep that protection except at the deliberate transport boundary.
JWS verifies bytes but does not validate JWT claims or assert that the payload is JSON.
The resulting Effect retains the key-import/sign/verify crypto service requirements; do not close it with `runSync` or silently select WebCrypto inside this function.
`runRoundTrip` is the example executable boundary that selects and supplies `Mac` and its `SecureRandom` dependency.
The reusable `roundTrip` function makes no runtime choice; applications using asymmetric keys instead select the corresponding `Signature` implementation at their composition root.

### hono/utils/jwt/jwt

1. Replace token/header inspection with `Jwt.decodeUnverified` only for explicitly unauthenticated inspection.
2. Use `Jwt.verify(schema, token, key, policy)` or `verifyWithKeySet` for authorization input.
3. Inspect the returned verified claims, not a separately decoded unverified payload.
4. Reject missing required claims and invalid time, issuer, audience, and schema values.

Effect's `Jwt.verify(schema, token, key, options)` uses a different argument order from Hono's `verify(token, secret, alg)`.
Verified signature alone is not sufficient when the application also requires audience, issuer, or expiry restrictions.
Do not log raw tokens or expose signature validation details as public authentication responses.

### hono/utils/jwt/types

1. Replace Hono JWT payload aliases with an application `Schema` and its inferred Type.
2. Use `Jwt.RegisteredClaims` only for registered JWT claim structure, not as proof of required application claims.
3. Handle `Jwt.JwtError` and `JoseError.JoseError` in the typed error channel without copying Hono exception classes or enums.

A structural payload type does not perform runtime validation; use the schema passed to `Jwt.verify`.
Use the [typed-error recipe](core.md#typed-http-errors) when the application must translate a token-processing error into HTTP.

### hono/utils/jwt/utf8

1. Replace the exported encoder singleton with `new TextEncoder()` and `new TextDecoder("utf-8", { fatal: true })` where strict input is required.
2. Pass bytes to JWS/crypto operations and decode only verified textual payloads.
3. Capture decoding failures at the input boundary instead of allowing malformed text into domain code.

The complete [byte conversion example](#honoutilsbuffer) applies unchanged.
No global singleton or Hono-specific UTF-8 wrapper is required.

## Proxy

Path: `hono/proxy`.

1. Use `HttpServerRequest.toClientRequest` to convert the active request while preserving its body semantics.
2. Construct a destination from trusted configuration and an explicitly allowed path/query policy.
3. Remove hop-by-hop headers, including fields named by `Connection`, and apply deliberate Host, cookie, authorization, and forwarded-header policies.
4. Execute with the injected `HttpClient` and convert the result through `HttpServerResponse.fromClientResponse`.
5. Retain streaming and cancellation scopes instead of buffering the entire response.

The concrete [proxy recipe](middleware.md#proxy) shows the request/client/response boundary and reusable policy glue proposal.
This document maps `hono/proxy` explicitly but does not duplicate the security-sensitive forwarding implementation.
Do not accept an arbitrary target URL from a query parameter, automatically follow cross-origin redirects with credentials, or call the result SSRF-safe merely because the URL parsed.
A Fetch-backed client may have runtime-specific redirect and decompression behavior; test the host and configure forwarding accordingly.
Hono's proxy option object and rewrite conventions are not an equivalence guarantee.

## Negotiation and rendering delegation

`hono/utils/accept` maps to the same generic `Accepts.parse` and negotiation workflow as `hono/accepts` in [Accept parsing and negotiation](standalone-policies.md#accept-parsing-and-negotiation).
Parse by negotiation kind, handle invalid input explicitly, negotiate against a configured list, and handle no match rather than copying Hono's parser return shape.
Do not use generic negotiation to replace effront's HTML/Flight protocol selection or its associated `Vary` and cache behavior.
`hono/utils/html` belongs to [JSX and HTML](effront.md#jsx-and-html): render with the chosen React/effront renderer, keep raw HTML trust boundaries explicit, and do not transplant Hono escaped-string brands or callback phases.
These delegated paths are documented here to make the utilities mapping complete, not to add a second implementation.

## Sources and verification boundaries

The compatibility inventory is a starting point, not evidence that function names or argument orders match Hono.
The recipes were checked against installed Effect 4.1.4 sources, including [Digest](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/crypto/Digest.ts), [Base64Url](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/encoding/Base64Url.ts), [Headers](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/Headers.ts), [HttpStaticServer](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpStaticServer.ts), [IpNetwork](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/net/IpNetwork.ts), [Jwk](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jwk.ts), [Jws](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jws.ts), and [Jwt](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/jose/Jwt.ts).
Hono utilities are pinned at [src/utils](https://github.com/honojs/hono/tree/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/utils), with the nested JWT files interpreted separately under its wildcard export.
Do not infer real cryptographic runtime availability, filesystem access, upstream network behavior, or proxy safety from TypeScript compilation alone.
Validate those boundaries with the actual injected host services and application policy.
