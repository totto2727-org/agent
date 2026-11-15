# Core HTTP migration recipes

Audience: application authors replacing Hono request handlers with Effect HTTP APIs, not authors implementing a Hono compatibility runtime.
Use these recipes for independent HTTP endpoints; keep effront application construction, UI rendering, assets, and host integration in the [skill entry point](../SKILL.md).
The comparison is pinned to Hono `f6fbaf0299c48eea9e656e03e2ffe7ac755e8823` and Effect 4.1.4 `3e2030b43e86a60113f2f32671076ff3b1d84ce4`.
The examples use public `effect/http`, `effect/http-api`, `effect/encoding`, and `effect/socket` exports, not the Effect 3 platform packages.
Each TypeScript block is a separate module unless a step explicitly tells you to extend a preceding module.

## Contents

- [Requests and validation](#requests-and-validation)
- [Router and route metadata](#router-and-route-metadata)
- [Typed HTTP errors](#typed-http-errors)
- [Clients](#clients)
- [Streaming and SSE](#streaming-and-sse)
- [WebSockets](#websockets)
- [Testing](#testing)
- [Connection information](#connection-information)
- [Sources and verification boundaries](#sources-and-verification-boundaries)

## Requests and validation

Paths: `hono/request`, `hono/validator`.

1. Replace `c.req` with `yield* HttpServerRequest.HttpServerRequest` inside the handler.
2. Read `request.method`, `request.url`, `request.headers`, and `request.cookies` directly; these are instance fields, not namespace getters.
3. Replace `c.req.json()` followed by a validator with `HttpServerRequest.schemaBodyJson(BodySchema)`.
4. Pass the decoded value to domain code directly instead of installing a mutable `.valid()` slot on a Context.
5. Catch schema failures at the HTTP boundary and return an explicit client-error response.
6. For headers, use `schemaHeaders`; for route params, use `HttpRouter.params` or `schemaParams`; for query data, use `schemaSearchParams` in a router handler, where `ParsedSearchParams` is provided.

```ts
import { Effect, Schema } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http";

const Input = Schema.Struct({ name: Schema.String });

const handler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const input = yield* HttpServerRequest.schemaBodyJson(Input);
  return yield* HttpServerResponse.json({
    name: input.name,
    method: request.method,
    userAgent: request.headers["user-agent"] ?? null,
    sessionPresent: request.cookies["session"] !== undefined,
  });
}).pipe(
  Effect.catchTag("SchemaError", () =>
    Effect.succeed(HttpServerResponse.text("Invalid JSON shape", { status: 400 })),
  ),
);

export const fetch = HttpEffect.toWebHandler(Effect.interruptible(handler));
```

`HttpEffect.toWebHandler` runs supplied request work uninterruptibly by default.
Wrap ordinary request effects in `Effect.interruptible`, as above, so aborting the Web Request can interrupt pending work and run finalizers.
Use an uninterruptible region only for a deliberately bounded critical section, not the whole request.
Router handlers created through `HttpRouter` are interruptible by default.
This concerns response construction; streamed-body cancellation still needs its own lifecycle test.

`schemaBodyJson` can fail on body reading as well as schema decoding; do not label every infrastructure failure as malformed input.
For a declared API, put `payload`, `params`, `query`, `headers`, and `success` schemas on `HttpApiEndpoint` and let `HttpApiBuilder` decode the boundary once.
Endpoint codecs can encode/decode transport strings; a low-level request schema must explicitly accept the actual wire representation.
For example, a low-level query schema accepting `Schema.String` gets text, not an implicitly converted number.

For `c.req.parseBody()`, select the reader by your accepted media types, not by Hono's method name:

- Use `schemaBodyUrlParams` for URL-encoded forms and a schema whose encoded fields accept strings or arrays of strings.
- Use `schemaBodyMultipart` for persisted multipart fields and files, with `Scope`, `FileSystem`, and `Path` supplied by the host.
- Use `schemaBodyForm` when the same endpoint accepts either URL-encoded or multipart form data.
- Use `request.multipartStream` when you must process incoming parts without persisting the whole upload.
- Define repeated-field, dotted-key, missing-field, and unknown-field policy in your schema and domain mapping.

Hono's body cache, dotted-key expansion, `.valid()` typing, and middleware validation targets are not compatibility contracts here.
Do not consume a body stream once in middleware and expect a second independent streaming read to work.
Bound the body with the body-limit recipe in [middleware](middleware.md) before decoding untrusted payloads.

## Router and route metadata

Paths: `hono/router`, `hono/route`.

1. Register HTTP methods and patterns with `HttpRouter.add`, which returns a Layer, not a mutable Hono app.
2. Compose route layers with `Layer.mergeAll`.
3. Provide host services at the composition root and build `HttpRouter.toWebHandler` once.
4. Use `RouteContext.params` for captured values and `RouteContext.route.path` for the matched pattern.
5. Validate params before passing them to domain code.
6. Dispose the handler's retained layer when the application shuts down.

```ts
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";

const getItem = Effect.gen(function* () {
  const { params, route } = yield* HttpRouter.RouteContext;
  const query = yield* HttpServerRequest.schemaSearchParams(
    Schema.Struct({ format: Schema.optional(Schema.String) }),
  );
  const id = yield* Schema.decodeUnknownEffect(Schema.String)(params["id"]);
  return yield* HttpServerResponse.json({
    id,
    pattern: route.path,
    format: query.format ?? "json",
  });
}).pipe(
  Effect.catchTag("SchemaError", () =>
    Effect.succeed(HttpServerResponse.text("Invalid parameters", { status: 400 })),
  ),
);

const Routes = Layer.mergeAll(
  HttpRouter.add("GET", "/items/:id", getItem),
  HttpRouter.add("POST", "/items", HttpServerResponse.empty({ status: 201 })),
);

export const app = HttpRouter.toWebHandler(Routes.pipe(Layer.provide(HttpServer.layerServices)), {
  disableLogger: true,
  routerConfig: { ignoreTrailingSlash: true },
});
```

Use `app.handler(new Request("https://example.test/items/42?format=json"))` at a Web boundary and `await app.dispose()` during shutdown.
`HttpRouter.params` is an Effect requiring `RouteContext`; it is not a synchronous function of a Hono Context.
`RouteContext` describes the selected route, not Hono's sequence of middleware matches or route-index history.
For grouping, prefix the router with its `prefixed(prefix)` instance method or declare prefixed patterns explicitly.
Do not translate a Hono regex/trie/smart/linear router implementation into an Effect algorithm-selection layer.
The root matrix records those implementation-specific paths as excluded.
Test optional params, wildcard captures, duplicate slash handling, method fallback, and URL decoding against your intended routes instead of assuming Hono pattern equivalence.
Do not infer an automatic 405 `Allow` inventory from this example.

## Typed HTTP errors

Path: `hono/http-exception`.

1. Represent an expected domain failure with `Data.TaggedError` or an existing typed domain error.
2. Fail in the Effect error channel, rather than throwing an `HTTPException` from arbitrary code.
3. Map known failures to a response at the handler boundary with `Effect.catchTag`.
4. Preserve unexpected failures for the server's error handling and logging.
5. For a schema-defined API, declare error schemas and status annotations with `HttpApiSchema.status` instead of manually duplicating error codecs in client and server.

```ts
import { Data, Effect } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";

class MissingItem extends Data.TaggedError("MissingItem")<{
  readonly id: string;
}> {}

const lookup = (id: string) => Effect.fail(new MissingItem({ id }));

const handler = lookup("42").pipe(
  Effect.flatMap((item) => HttpServerResponse.json(item)),
  Effect.catchTag("MissingItem", (error) =>
    HttpServerResponse.json({ error: "not_found", id: error.id }, { status: 404 }),
  ),
);

export const fetch = HttpEffect.toWebHandler(Effect.interruptible(handler));
```

There is no `getResponse()` compatibility method or universal thrown-error-to-status coercion.
A tagged error alone does not acquire an HTTP status.
Avoid catching every failure into 200 or exposing internal error messages in a public JSON response.
Use the timeout recipe in [middleware](middleware.md) for interruptible deadlines and a separate explicit timeout-to-status policy.

## Clients

Path: `hono/client`.

For a plain remote endpoint:

1. Inject `HttpClient.HttpClient` at your program boundary.
2. Execute through a client with an explicit successful-status policy.
3. Decode the response using a schema before using it as domain data.
4. Provide `FetchHttpClient.layer` only at the executable composition root.

```ts
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";

const readItem = Effect.gen(function* () {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
  const response = yield* client.get("https://example.test/items/42");
  return yield* HttpClientResponse.schemaBodyJson(Schema.Struct({ id: Schema.String }))(response);
});

export const main = readItem.pipe(Effect.provide(FetchHttpClient.layer));
```

For a typed client, share the API description rather than the inferred Hono application type:

```ts
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

const Item = Schema.Struct({ id: Schema.String });
export const Api = HttpApi.make("inventory").add(
  HttpApiGroup.make("items").add(
    HttpApiEndpoint.get("get", "/items/:id", {
      params: { id: Schema.String },
      success: Item,
    }),
  ),
);

const readItem = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(Api, { baseUrl: "https://example.test" });
  return yield* client.items.get({ params: { id: "42" } });
});

export const main = readItem.pipe(Effect.provide(FetchHttpClient.layer));
```

`HttpApiClient.make` needs a client service and any declared client middleware services.
Status, codec, and transport errors remain typed failures; a TypeScript return type does not prove a remote server follows the schema.
Hono `hc<AppType>`, `$get`, `$post`, route-type accumulation, and its client response aliases do not carry across.
Retain cancellation and scopes when consuming streaming responses instead of converting every request to an unscoped Promise.
Neither example runs a network request at module initialization.

## Streaming and SSE

Paths: `hono/streaming`, `hono/utils/stream`.

1. Express the producer as `Stream`, including its failure and cleanup behavior.
2. Encode strings into bytes before constructing `HttpServerResponse.stream`.
3. Encode SSE fields with `Sse.encoder` or the `Sse.encode` channel rather than concatenating untrusted field lines.
4. Set the SSE content type and avoid shared caching.
5. Let stream consumption own production and interruption; do not start an independent untracked producer fiber.

```ts
import { Stream } from "effect";
import { Sse } from "effect/encoding";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { Effect } from "effect";

const events: ReadonlyArray<Sse.Event> = [
  { _tag: "Event", event: "message", id: "1", data: JSON.stringify({ value: 1 }) },
  { _tag: "Event", event: "message", id: "2", data: JSON.stringify({ value: 2 }) },
];

const bytes = Stream.fromIterable(events).pipe(
  Stream.map((event) => new TextEncoder().encode(Sse.encoder.write(event))),
);

export const fetch = HttpEffect.toWebHandler(
  Effect.succeed(
    HttpServerResponse.stream(bytes, {
      contentType: "text/event-stream",
      headers: { "cache-control": "no-cache" },
    }),
  ).pipe(Effect.interruptible),
);
```

For a typed HTTP API, declare the streaming response schema rather than trying to put a Stream in a JSON success schema:

```ts
import { Effect, Layer, Schema, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

export const Events = HttpApiEndpoint.get("events", "/events", {
  success: HttpApiSchema.StreamSse({
    data: Schema.Struct({ value: Schema.Number }),
    keepAlive: "15 seconds",
  }),
});

const Api = HttpApi.make("events-api").add(HttpApiGroup.make("events").add(Events));
const EventsLive = HttpApiBuilder.group(Api, "events", (handlers) =>
  handlers.handle("events", () => Effect.succeed(Stream.make({ value: 1 }, { value: 2 }))),
);

export const apiApp = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(Api).pipe(
    Layer.provide(EventsLive),
    Layer.provide(HttpServer.layerServices),
  ),
  { disableLogger: true },
);
```

Call `apiApp.handler` at the Web boundary and `apiApp.dispose()` at shutdown, as with the router example.

The typed builder handler returns the Stream of decoded data values expected by `StreamSse`; the HTTP API runtime performs framing and client decoding.
`StreamSse` is response-only and is rejected as a request payload.
For named event unions, use its `events` codec option rather than the `data` option.
A failure after headers have been sent cannot become a fresh JSON 500 response; model any recoverable in-band error event deliberately.
The SSE encoder sanitizes ID and event fields and splits multiline data; this is not a callback writer with Hono's `writeSSE` or `onAbort` methods.
For non-SSE text streaming, omit SSE encoding and use `Stream.map` with `TextEncoder` and the intended media type.
For effectful stream resources, provide or capture required services before calling `HttpServerResponse.stream`, whose body accepts a Stream without a remaining environment requirement.
Keep effront RSC/SSR streaming in effront, not in this generic SSE recipe.

## WebSockets

Path: `hono/ws`.

1. Use an actual server adapter that supports upgrades; a standalone Web `Request` test handler is not a WebSocket listener.
2. Validate origin, authentication, and negotiated subprotocol before upgrading.
3. Acquire `request.upgrade` to obtain a `Socket`.
4. Acquire its scoped reader and writer, then process frame batches with Effect.
5. Keep the reader scope alive for the session; close/interruption ends the loop and releases resources.

```ts
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

export const echo = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const socket = yield* request.upgrade;
  const { pull } = yield* socket.reader;
  const writer = yield* socket.writer;
  while (true) {
    const batch = yield* pull;
    yield* writer.writeAll(batch);
  }
  return HttpServerResponse.empty();
}).pipe(Effect.scoped);
```

The trailing response satisfies the HTTP handler shape but the session loop normally exits through socket close/failure, not successful HTTP body completion.
A clean peer close is still represented by `SocketError` containing its close reason; handle that reason if your application needs to distinguish normal closure from failure.
Do not use a blanket catch that suppresses authentication failures or transport faults.
The scoped writer's `write` accepts a string, bytes, or `Socket.CloseEvent`; `writeAll` accepts a nonempty batch and honors transport backpressure.
Use `HttpServerRequest.upgradeChannel()` when the application is already a Channel pipeline instead of building a callback-to-Stream bridge.
Hono `WSContext`, event callbacks, and `upgradeWebSocket` runtime adapters are not reproduced.
The source directory named `helper/websocket` corresponds to public import `hono/ws`, not an extra public `hono/websocket` path.

## Testing

Path: `hono/testing`.

1. Test an HTTP handler with real Web `Request` and `Response` objects through `HttpEffect.toWebHandler`.
2. For router tests, use the router example's `app.handler` and dispose the retained application layer after the suite.
3. For a schema-defined API, use `HttpApiTest.groups` to build a typed in-memory client from handler layers, or `HttpServer.makeTestClient` with a real server layer for transport coverage.
4. Do not mistake an in-memory request test for host upgrade, network, proxy, or deployment verification.

```ts
import { Effect } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http";

const fetch = HttpEffect.toWebHandler(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    return HttpServerResponse.text(request.method);
  }).pipe(Effect.interruptible),
);

export async function checkRequestBoundary(): Promise<void> {
  const response = await fetch(new Request("https://example.test/check", { method: "POST" }));
  if (response.status !== 200 || (await response.text()) !== "POST") {
    throw new Error("HTTP request boundary failed");
  }
}
```

Extend this pattern with malformed JSON, schema-invalid data, repeated query fields, encoded params, interrupted streams, and explicit status assertions relevant to the migrated endpoint.
Hono's `testClient(app)` inference is replaced by an `HttpApi` description or ordinary HTTP assertions, not a cast of an untyped response.

## Connection information

Path: `hono/conninfo`.

1. Read `request.remoteAddress`, an `Option<string>`, from the current server request.
2. Handle missing peer information explicitly; a Fetch-only host might not provide it.
3. If trusted-proxy middleware is installed, distinguish the validated client address from the transport peer address according to that middleware's contract.
4. Obtain remote port and address family only from host APIs that actually provide them.

```ts
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

export const connection = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* HttpServerResponse.json({
    address: Option.getOrNull(request.remoteAddress),
  });
});
```

Never trust `X-Forwarded-For` merely because it exists, and never synthesize a port or IPv4/IPv6 classification to satisfy a Hono shape.
Use the [IP address recipe](utilities.md#ip-addresses) when validation or CIDR membership is required.

## Sources and verification boundaries

The API contracts above were inspected in the installed Effect 4.1.4 source independently of the compatibility inventory.
Relevant pinned sources are [HttpServerRequest](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpServerRequest.ts), [HttpRouter](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpRouter.ts), [HttpEffect](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http/HttpEffect.ts), [HttpApiClient](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http-api/HttpApiClient.ts), [HttpApiSchema](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/http-api/HttpApiSchema.ts), [Sse](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/encoding/Sse.ts), and [Socket](https://github.com/Effect-TS/effect/blob/3e2030b43e86a60113f2f32671076ff3b1d84ce4/packages/effect/src/socket/Socket.ts).
The Hono side is pinned at its [export map](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/package.json), [request implementation](https://github.com/honojs/hono/blob/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/request.ts), and [helpers](https://github.com/honojs/hono/tree/f6fbaf0299c48eea9e656e03e2ffe7ac755e8823/src/helper).
These recipes establish migration structure and signatures, not identical Hono routing, cancellation, validation-message, or host behavior.
Run the actual endpoint and host-specific integration tests after adapting the examples.
