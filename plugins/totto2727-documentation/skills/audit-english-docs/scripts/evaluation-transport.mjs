// oxlint-disable-next-line rules/no-node-imports -- The standalone CLI invokes curl as its transport process.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Hash the logical request using the local Node host without external dependencies.
import { createHash } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Each request owns temporary body and header files.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Request files belong in the host temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Construct temporary request paths using the host path conventions.
import path from "node:path";

import { isRecord, matchesNull } from "./native-predicates.mjs";
import { EvaluationError, text } from "./evaluation-validation.mjs";

// oxlint-disable-next-line unicorn/custom-error-definition -- Keep the exported constructor and native Error name used by existing callers.
export class TransportFailure extends EvaluationError {}

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const FATAL_STATUS = new Set([HTTP_UNAUTHORIZED, HTTP_PAYMENT_REQUIRED, HTTP_FORBIDDEN]);
// Cloudflare AI Gateway cache headers. A custom cache key opts an individual
// Request into caching even when caching is disabled gateway-wide, and the TTL
// Only controls the lifetime of already cacheable requests (60s minimum).
export const CACHE_KEY_PREFIX = "decision-v1";
// Request up to 30 days of reuse for unchanged document evaluations.
// Gateway cache storage remains volatile even within this TTL.
export const CACHE_TTL_SECONDS = 2_592_000;
export const CACHE_SKIP = "false";
const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com";
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/iu;
const GATEWAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const HEADER_SAFE_PATTERN = /^[\u0021-\u007E]+$/u;

/** @type {(model: string) => boolean} */
export const isNativeModel = (model) => model.startsWith("clef");

/** @type {(model: string, accountId: string) => string} */
export const endpointFor = (model, accountId) => {
  const base = `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${accountId}/ai/run`;
  return isNativeModel(model) ? `${base}/@cf/cloudflare/${model}` : base;
};

/** @type {(model: string, state: unknown, questions: unknown) => Record<string, unknown>} */
export const payloadFor = (model, state, questions) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the two Gateway request bodies in their existing serialized field order.
  isNativeModel(model) ? { model, state, questions } : { model, input: { state, questions } };

const sortsBefore = -1;
/** @type {(left: string, right: string) => number} */
const compareKeys = (left, right) => (left < right ? sortsBefore : Number(left > right));

/** @type {(value: unknown) => string | undefined} */
const encodeJson = JSON.stringify;

// Deterministic JSON used only for cache-key derivation. Object keys are
// Serialized directly in sorted order rather than through JSON.stringify of a
// Re-keyed object, because JSON.stringify reorders integer-like keys and would
// Ignore the requested canonical ordering.
/** @type {(value: unknown) => string} */
export const canonicalJson = (value) => {
  if (isRecord(value)) {
    const keys = Object.keys(value).toSorted(compareKeys);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  return encodeJson(value) ?? "null";
};

// Full-equivalence fingerprint for one logical Gateway request. The material
// Intentionally includes the endpoint (account route), gateway id, gateway
// Token, and canonical body so that models, state, criteria, question order,
// And account/gateway/token routes never share a cache entry.
/** @type {(request: { apiKey: string, body: unknown, gatewayId: string, url: string }) => string} */
export const cacheFingerprint = ({ url, gatewayId, apiKey, body }) => {
  const material = `${url}\n${gatewayId}\n${apiKey}\n${canonicalJson(body)}\n`;
  const digest = createHash("sha256").update(material, "utf8").digest("hex");
  return `${CACHE_KEY_PREFIX}-${digest}`;
};

// oxlint-disable-next-line unicorn/no-null -- Preserve the existing absent-header sentinel in reports and transport errors.
const ABSENT_HEADER = null;

/** @type {(headers: string) => string | null} */
export const parseCacheStatus = (headers) => {
  // oxlint-disable-next-line eslint/require-unicode-regexp -- HTTP field names use ASCII case folding, which the iu combination would widen to long s.
  const value = /^cf-aig-cache-status:\s*(?<status>\S+)\s*$/im.exec(headers)?.groups?.status;
  return value?.toUpperCase() ?? ABSENT_HEADER;
};

/** @type {(headers: string) => string | null} */
export const parseTraceId = (headers) =>
  /^cf-ray:\s*(?<trace>\S+)\s*$/imu.exec(headers)?.groups?.trace ?? ABSENT_HEADER;

/** @type {(environment: Record<string, string | undefined>) => { accountId: string, apiKey: string, gatewayId: string }} */
export const readCredentials = (environment) => {
  const accountId = text(environment.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID");
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new EvaluationError("CLOUDFLARE_ACCOUNT_ID must be 32 hexadecimal characters");
  }
  const apiKey = text(environment.CLOUDFLARE_AI_GATEWAY_API_KEY, "CLOUDFLARE_AI_GATEWAY_API_KEY");
  if (!HEADER_SAFE_PATTERN.test(apiKey)) {
    throw new EvaluationError("CLOUDFLARE_AI_GATEWAY_API_KEY must be a header-safe secret");
  }
  const gatewayId = text(environment.CLOUDFLARE_AI_GATEWAY_ID, "CLOUDFLARE_AI_GATEWAY_ID");
  if (!GATEWAY_ID_PATTERN.test(gatewayId)) {
    throw new EvaluationError("CLOUDFLARE_AI_GATEWAY_ID must be a safe gateway slug");
  }
  return { accountId, apiKey, gatewayId };
};

/** @type {(value: string) => string} */
const curlEscape = (value) =>
  value.replaceAll("\\", String.raw`\\`).replaceAll('"', String.raw`\"`);

/** @type {(options: { apiKey: string, cacheKey: string, gatewayId: string, headersFile: string, requestFile: string, url: string }) => string} */
const curlConfig = ({ url, apiKey, gatewayId, cacheKey, requestFile, headersFile }) =>
  [
    `url = "${curlEscape(url)}"`,
    'request = "POST"',
    "fail-with-body",
    "connect-timeout = 10",
    "max-time = 45",
    `header = "Authorization: Bearer ${curlEscape(apiKey)}"`,
    `header = "cf-aig-gateway-id: ${curlEscape(gatewayId)}"`,
    'header = "Content-Type: application/json"',
    `header = "cf-aig-cache-key: ${curlEscape(cacheKey)}"`,
    `header = "cf-aig-cache-ttl: ${CACHE_TTL_SECONDS}"`,
    `header = "cf-aig-skip-cache: ${CACHE_SKIP}"`,
    `data-binary = "@${curlEscape(requestFile)}"`,
    `dump-header = "${curlEscape(headersFile)}"`,
    String.raw`write-out = "\n%{http_code}"`,
  ].join("\n");

const EXIT_SIGNAL = 1;
const EXIT_UNAVAILABLE = 127;
const EXIT_SUCCESS = 0;
const NO_HTTP_RESPONSE = 0;
const STDOUT_START = 0;

/** @typedef {{ code: number, stdout: string }} CurlOutput */

/** @type {(config: string) => Promise<CurlOutput>} */
const invokeCurl = async (config) => {
  /** @type {PromiseWithResolvers<CurlOutput>} */
  const { promise, resolve } = Promise.withResolvers();
  const child = spawn("curl", ["--disable", "--config", "-"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  /** @type {Buffer[]} */
  const output = [];
  /** @type {(chunk: Buffer) => void} */
  const appendOutput = (chunk) => {
    output.push(chunk);
  };
  child.stdout.on("data", appendOutput);
  child.on("error", () => {
    resolve({ code: EXIT_UNAVAILABLE, stdout: "" });
  });
  child.on("close", (code) => {
    resolve({ code: code ?? EXIT_SIGNAL, stdout: Buffer.concat(output).toString("utf8") });
  });
  child.stdin.end(config);
  return promise;
};

/** @type {(stdout: string) => { body: string, status: number }} */
const parseCurlOutput = (stdout) => {
  const match = /\n(?<status>\d{3})\s*$/u.exec(stdout);
  return {
    body: matchesNull(match) ? stdout : stdout.slice(STDOUT_START, match.index),
    status: Number(match?.groups?.status ?? NO_HTTP_RESPONSE),
  };
};

/** @typedef {{ activeRequests: number, observedPeakActiveRequests: number, requestCount: number }} RequestMetrics */
/** @typedef {{ cacheStatus: string | null, ray: string | null }} ResponseHeaders */
/** @typedef {ResponseHeaders & { response: unknown }} ActionResponse */

/** @type {(config: string, metrics: RequestMetrics) => Promise<CurlOutput>} */
const trackCurl = async (config, metrics) => {
  metrics.requestCount += 1;
  metrics.activeRequests += 1;
  metrics.observedPeakActiveRequests = Math.max(
    metrics.observedPeakActiveRequests,
    metrics.activeRequests,
  );
  try {
    return await invokeCurl(config);
  } finally {
    metrics.activeRequests -= 1;
  }
};

/** @type {(status: number, code: number) => EvaluationError | undefined} */
const responseFailure = (status, code) => {
  if (status === NO_HTTP_RESPONSE) {
    return new EvaluationError(`Cloudflare transport failed (exit ${code})`);
  }
  if (FATAL_STATUS.has(status)) {
    return new TransportFailure(`Cloudflare rejected the request with HTTP ${status}`);
  }
  if (status !== HTTP_OK) {
    return new EvaluationError(`Cloudflare returned HTTP ${status}`);
  }
  return code === EXIT_SUCCESS
    ? undefined
    : new EvaluationError(`Cloudflare transport failed (exit ${code})`);
};

/** @type {(result: CurlOutput, headers: ResponseHeaders) => ActionResponse} */
const decodeResponse = (result, { cacheStatus, ray }) => {
  const { body, status } = parseCurlOutput(result.stdout);
  const headers = { cacheStatus, ray };
  const error = responseFailure(status, result.code);
  if (error) {
    throw Object.assign(error, headers);
  }
  try {
    /** @type {unknown} */
    const response = JSON.parse(body);
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing programmatic response shape and field order.
    return { response, cacheStatus, ray };
  } catch {
    throw Object.assign(new EvaluationError("Cloudflare returned malformed JSON"), headers);
  }
};

// One logical request is attempted exactly once by this client. Transient statuses
// (429, 5xx), timeouts, and other curl failures are reported as errors without an
// Automatic retry so that callers control retry policy and duplicate logical
// Requests are never re-submitted. No request-level retry override is sent, so
// The Gateway's own configured retry behavior is left unchanged.
/** @typedef {{ cacheKey: string, credentials: ReturnType<typeof readCredentials>, metrics: RequestMetrics, model: string, questions: Record<string, import("./evaluation-work.mjs").DecisionQuestion>, state: unknown }} ActionInput */

/**
 * @param {ActionInput} input - A single routed evaluation and its run counters.
 * @returns {Promise<ActionResponse>} The JSON response and Gateway metadata.
 */
export const actionRequest = async function ({
  model,
  state,
  questions,
  credentials,
  cacheKey,
  metrics,
}) {
  const temporary = await mkdtemp(path.resolve(tmpdir(), "audit-english-docs-"));
  try {
    const requestFile = path.resolve(temporary, "request.json");
    const headersFile = path.resolve(temporary, "headers.txt");
    const url = endpointFor(model, credentials.accountId);
    await writeFile(requestFile, JSON.stringify(payloadFor(model, state, questions)));
    const result = await trackCurl(
      curlConfig({
        apiKey: credentials.apiKey,
        cacheKey,
        gatewayId: credentials.gatewayId,
        headersFile,
        requestFile,
        url,
      }),
      metrics,
    );
    const headers = await readFile(headersFile, "utf8").catch(() => "");
    return decodeResponse(result, {
      cacheStatus: parseCacheStatus(headers),
      ray: parseTraceId(headers),
    });
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
};
