// oxlint-disable-next-line rules/no-node-imports -- The standalone CLI invokes curl as its transport process.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Hash the logical request using the local Node host without external dependencies.
import { createHash } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Each request owns temporary body and header files.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Request files belong in the host temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Construct temporary request paths using the host path conventions.
import { resolve } from "node:path";

import { hasObjectType, matchesNull } from "./native-predicates.mjs";
import { EvaluationError, text } from "./evaluation-validation.mjs";

export class TransportFailure extends EvaluationError {}

const FATAL_STATUS = new Set([401, 402, 403]);
// Cloudflare AI Gateway cache headers. A custom cache key opts an individual
// Request into caching even when caching is disabled gateway-wide, and the TTL
// Only controls the lifetime of already cacheable requests (60s minimum).
export const CACHE_KEY_PREFIX = "decision-v1";
// Request up to 30 days of reuse for unchanged document evaluations.
// Gateway cache storage remains volatile even within this TTL.
export const CACHE_TTL_SECONDS = 2592000;
export const CACHE_SKIP = "false";
const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com";
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const GATEWAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HEADER_SAFE_PATTERN = /^[\x21-\x7e]+$/;

/** @type {(model: string) => boolean} */
export const isNativeModel = (model) => model.startsWith("clef");

/** @type {(model: string, accountId: string) => string} */
export const endpointFor = (model, accountId) => {
  const base = `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${accountId}/ai/run`;
  return isNativeModel(model) ? `${base}/@cf/cloudflare/${model}` : base;
};

/** @type {(model: string, state: unknown, questions: unknown) => Record<string, unknown>} */
export const payloadFor = (model, state, questions) =>
  isNativeModel(model) ? { model, state, questions } : { model, input: { state, questions } };

const sortsBefore = -1;
/** @type {(left: string, right: string) => number} */
const compareKeys = (left, right) => (left < right ? sortsBefore : Number(left > right));

// Deterministic JSON used only for cache-key derivation. Object keys are
// Serialized directly in sorted order rather than through JSON.stringify of a
// Re-keyed object, because JSON.stringify reorders integer-like keys and would
// Ignore the requested canonical ordering.
/** @type {(value: unknown) => string} */
export const canonicalJson = (value) => {
  if (matchesNull(value) || !hasObjectType(value)) {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).toSorted(compareKeys);
  const record = /** @type {Record<string, unknown>} */ (value);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
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

export function parseCacheStatus(headers) {
  const value = /^cf-aig-cache-status:\s*(\S+)\s*$/im.exec(headers)?.[1];
  return value ? value.toUpperCase() : null;
}

export function parseTraceId(headers) {
  return /^cf-ray:\s*(\S+)\s*$/im.exec(headers)?.[1] ?? null;
}

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

const curlConfig = function (url, apiKey, gatewayId, cacheKey, requestFile, headersFile) {
  const escaped = (value) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [
    `url = "${escaped(url)}"`,
    'request = "POST"',
    "fail-with-body",
    "connect-timeout = 10",
    "max-time = 45",
    `header = "Authorization: Bearer ${escaped(apiKey)}"`,
    `header = "cf-aig-gateway-id: ${escaped(gatewayId)}"`,
    'header = "Content-Type: application/json"',
    `header = "cf-aig-cache-key: ${escaped(cacheKey)}"`,
    `header = "cf-aig-cache-ttl: ${CACHE_TTL_SECONDS}"`,
    `header = "cf-aig-skip-cache: ${CACHE_SKIP}"`,
    `data-binary = "@${escaped(requestFile)}"`,
    `dump-header = "${escaped(headersFile)}"`,
    'write-out = "\\n%{http_code}"',
  ].join("\n");
};

const invokeCurl = async function (config) {
  return new Promise((resolvePromise) => {
    const child = spawn("curl", ["--disable", "--config", "-"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.on("error", () => resolvePromise({ code: 127, stdout: "" }));
    child.on("close", (code) =>
      resolvePromise({ code: code ?? 1, stdout: Buffer.concat(output).toString("utf8") }),
    );
    child.stdin.end(config);
  });
};

const parseCurlOutput = function (stdout) {
  const match = /\n(\d{3})\s*$/.exec(stdout);
  if (!match) {
    return { status: null, body: stdout };
  }
  return { status: Number(match[1]), body: stdout.slice(0, match.index) };
};

// One logical request is attempted exactly once by this client. Transient statuses
// (429, 5xx), timeouts, and other curl failures are reported as errors without an
// Automatic retry so that callers control retry policy and duplicate logical
// Requests are never re-submitted. No request-level retry override is sent, so
// The Gateway's own configured retry behavior is left unchanged.
export const actionRequest = async function ({
  model,
  state,
  questions,
  credentials,
  cacheKey,
  metrics,
}) {
  const temporary = await mkdtemp(resolve(tmpdir(), "audit-english-docs-"));
  try {
    const requestFile = resolve(temporary, "request.json");
    const headersFile = resolve(temporary, "headers.txt");
    const url = endpointFor(model, credentials.accountId);
    await writeFile(requestFile, JSON.stringify(payloadFor(model, state, questions)));
    const config = curlConfig(
      url,
      credentials.apiKey,
      credentials.gatewayId,
      cacheKey,
      requestFile,
      headersFile,
    );
    metrics.requestCount += 1;
    metrics.activeRequests += 1;
    metrics.observedPeakActiveRequests = Math.max(
      metrics.observedPeakActiveRequests,
      metrics.activeRequests,
    );
    let result;
    try {
      result = await invokeCurl(config);
    } finally {
      metrics.activeRequests -= 1;
    }
    const parsed = parseCurlOutput(result.stdout);
    const headers = await readFile(headersFile, "utf8").catch(() => "");
    const cacheStatus = parseCacheStatus(headers);
    const ray = parseTraceId(headers);
    const failure = (message, ErrorType = EvaluationError) => {
      const error = new ErrorType(message);
      error.cacheStatus = cacheStatus;
      error.ray = ray;
      return error;
    };
    if (!parsed.status) {
      throw failure(`Cloudflare transport failed (exit ${result.code})`);
    }
    if (FATAL_STATUS.has(parsed.status)) {
      throw failure(`Cloudflare rejected the request with HTTP ${parsed.status}`, TransportFailure);
    }
    if (parsed.status !== 200) {
      throw failure(`Cloudflare returned HTTP ${parsed.status}`);
    }
    if (result.code !== 0) {
      throw failure(`Cloudflare transport failed (exit ${result.code})`);
    }
    try {
      return { response: JSON.parse(parsed.body), cacheStatus, ray };
    } catch {
      throw failure("Cloudflare returned malformed JSON");
    }
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
};
