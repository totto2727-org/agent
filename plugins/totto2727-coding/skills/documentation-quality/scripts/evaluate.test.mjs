import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import {
  MODELS,
  cacheFingerprint,
  canonicalJson,
  endpointFor,
  evaluate,
  parseCacheStatus,
  payloadFor,
  readCredentials,
  segmentMarkdown,
  validateManifest,
  validateResponse,
} from "./evaluate.mjs";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("./evaluate.mjs", import.meta.url));

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const API_KEY = "test-gateway-key";
const GATEWAY_ID = "test-gateway";
const CREDENTIALS = {
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
  CLOUDFLARE_AI_GATEWAY_API_KEY: API_KEY,
  CLOUDFLARE_AI_GATEWAY_ID: GATEWAY_ID,
};

const temporaryDirectories = [];

async function fixture({ model = "clef-flash" } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "documentation-quality-test-"));
  temporaryDirectories.push(directory);
  await writeFile(
    resolve(directory, "guide.md"),
    "# Start\n\nUse the tool.\n\n## Details\n\n```md\n# Not a heading\n```\n\nMore detail.\n",
  );
  const manifest = {
    model,
    threshold: 0.8,
    rules: [
      {
        id: "direct",
        scope: "section",
        instructions: "Evaluate directness.",
        pass: "Direct.",
        fail: "Indirect.",
        expected: "pass",
      },
      {
        id: "flow",
        scope: "page",
        instructions: "Evaluate flow.",
        pass: "Coherent.",
        fail: "Fragmented.",
      },
    ],
    documents: [
      {
        id: "guide",
        path: "guide.md",
        purpose: "Teach setup.",
        audience: "A new user.",
        context: "Evidence only.",
        ruleIds: ["direct", "flow"],
        expected: { direct: "pass" },
      },
    ],
  };
  const manifestPath = resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { directory, manifestPath, outputPath: resolve(directory, "report.json") };
}

async function duplicateFixture({ model = "clef-flash", secondContext, secondRuleIds } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "documentation-quality-test-"));
  temporaryDirectories.push(directory);
  await writeFile(
    resolve(directory, "guide.md"),
    "# Start\n\nUse the tool.\n\n## Details\n\nMore detail.\n",
  );
  const document = (id, overrides = {}) => ({
    id,
    path: "guide.md",
    purpose: "Teach setup.",
    audience: "A new user.",
    context: "Evidence only.",
    ruleIds: ["direct", "flow"],
    ...overrides,
  });
  const manifest = {
    model,
    threshold: 0.8,
    rules: [
      {
        id: "direct",
        scope: "section",
        instructions: "Evaluate directness.",
        pass: "Direct.",
        fail: "Indirect.",
      },
      {
        id: "strict",
        scope: "section",
        instructions: "Evaluate strictness.",
        pass: "Strict.",
        fail: "Loose.",
      },
      {
        id: "flow",
        scope: "page",
        instructions: "Evaluate flow.",
        pass: "Coherent.",
        fail: "Fragmented.",
      },
    ],
    documents: [
      document("guide-a"),
      document("guide-b", {
        ...(secondContext === undefined ? {} : { context: secondContext }),
        ...(secondRuleIds === undefined ? {} : { ruleIds: secondRuleIds }),
      }),
    ],
  };
  const manifestPath = resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { directory, manifestPath, outputPath: resolve(directory, "report.json") };
}

function evaluationOf(report, documentId, scope, sectionId = null) {
  return report.evaluations.find(
    (entry) =>
      entry.documentId === documentId &&
      entry.scope === scope &&
      (sectionId === null || entry.section?.id === sectionId),
  );
}

function assertAnswerIdentities(report) {
  for (const entry of report.evaluations) {
    const ids = new Set(entry.questions.map((question) => question.id));
    expect(entry.answers.length).toBe(entry.questions.length);
    for (const answer of entry.answers) expect(ids.has(answer.questionId)).toBe(true);
  }
}

const MOCK_SOURCE = `#!/usr/bin/env node
const fs = require("node:fs");
const config = fs.readFileSync(0, "utf8");
const value = (name) => new RegExp("^" + name + " = \\"([^\\"]+)\\"", "m").exec(config)?.[1];
const headers = [...config.matchAll(/^header = "(.*)"$/gm)].map((match) => match[1]);
const url = value("url");
const requestPath = value("data-binary").slice(1);
const headersPath = value("dump-header");
const payload = JSON.parse(fs.readFileSync(requestPath, "utf8"));
fs.appendFileSync(process.env.CURL_LOG, JSON.stringify({ config, headers, url, payload, argv: process.argv.slice(2), at: Date.now() }) + "\\n");
const counterPath = process.env.CURL_MOCK_COUNTER;
let attempt = 0;
if (counterPath) {
  try { attempt = Number(fs.readFileSync(counterPath, "utf8")) || 0; } catch {}
  fs.writeFileSync(counterPath, String(attempt + 1));
}
const sequence = (process.env.CURL_MOCK_STATUS_SEQUENCE || "").split(",").filter(Boolean).map(Number);
const status = sequence.length ? sequence[Math.min(attempt, sequence.length - 1)] : 200;
const mode = process.env.CURL_MOCK_MODE || "valid";
const cacheStatus = process.env.CURL_MOCK_CACHE_STATUS || "MISS";
const ray = process.env.CURL_MOCK_RAY || "mock-ray-0001";
const answer = () => ({ type: "choice", choice: "pass", confidence: 0.94, probabilities: { pass: 0.96, fail: 0.03, not_applicable: 0, insufficient_context: 0.01 } });
const native = url.includes("/@cf/cloudflare/");
const questions = native ? payload.questions : payload.input.questions;
const answers = mode === "malformed" ? { wrong: answer() } : Object.fromEntries(Object.keys(questions).map((id) => [id, answer()]));
const inner = { model: native ? payload.model : "jev-1.13.0", answers, usage: { inputTokens: 1 } };
const response = native
  ? (mode === "native-failed" ? { success: false } : { success: true, result: inner })
  : { success: true, result: { state: mode === "wrapper-failed" ? "Failed" : "Completed", result: inner } };
setTimeout(() => {
  if (status === 200) {
    fs.writeFileSync(headersPath, "HTTP/1.1 200 OK\\r\\ncontent-type: application/json\\r\\ncf-aig-cache-status: " + cacheStatus + "\\r\\ncf-ray: " + ray + "\\r\\n\\r\\n");
    process.stdout.write(JSON.stringify(response) + "\\n" + status);
  } else {
    fs.writeFileSync(headersPath, "HTTP/1.1 " + status + " Error\\r\\n\\r\\n");
    process.stdout.write(JSON.stringify({ success: false, errors: [{ code: status }] }) + "\\n" + status);
    process.exitCode = status >= 400 ? 22 : 0;
  }
  if (process.env.CURL_MOCK_EXIT) process.exitCode = Number(process.env.CURL_MOCK_EXIT);
}, 20);
`;

async function installCurlMock(directory) {
  const script = resolve(directory, "curl");
  await writeFile(script, MOCK_SOURCE);
  await chmod(script, 0o755);
  return script;
}

async function readCalls(log) {
  try {
    return (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function restoreEnvironment(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function prepareMock(paths, options = {}) {
  await installCurlMock(paths.directory);
  const log = resolve(paths.directory, "calls.log");
  const counter = resolve(paths.directory, "counter.txt");
  const saved = {
    PATH: process.env.PATH,
    CURL_LOG: process.env.CURL_LOG,
    CURL_MOCK_COUNTER: process.env.CURL_MOCK_COUNTER,
    CURL_MOCK_EXIT: process.env.CURL_MOCK_EXIT,
    CURL_MOCK_MODE: process.env.CURL_MOCK_MODE,
    CURL_MOCK_STATUS_SEQUENCE: process.env.CURL_MOCK_STATUS_SEQUENCE,
    CURL_MOCK_CACHE_STATUS: process.env.CURL_MOCK_CACHE_STATUS,
    CURL_MOCK_RAY: process.env.CURL_MOCK_RAY,
  };
  process.env.PATH = `${paths.directory}:${saved.PATH}`;
  process.env.CURL_LOG = log;
  process.env.CURL_MOCK_COUNTER = counter;
  delete process.env.CURL_MOCK_EXIT;
  delete process.env.CURL_MOCK_MODE;
  delete process.env.CURL_MOCK_STATUS_SEQUENCE;
  delete process.env.CURL_MOCK_CACHE_STATUS;
  delete process.env.CURL_MOCK_RAY;
  if (options.exitCode) process.env.CURL_MOCK_EXIT = String(options.exitCode);
  if (options.mode) process.env.CURL_MOCK_MODE = options.mode;
  if (options.statusSequence) process.env.CURL_MOCK_STATUS_SEQUENCE = options.statusSequence;
  if (options.cacheStatus) process.env.CURL_MOCK_CACHE_STATUS = options.cacheStatus;
  if (options.ray) process.env.CURL_MOCK_RAY = options.ray;
  return { log, restore: () => restoreEnvironment(saved) };
}

async function withMock(paths, options, callback) {
  const mock = await prepareMock(paths, options);
  try {
    const result = await callback();
    return { result, calls: await readCalls(mock.log) };
  } finally {
    mock.restore();
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("documentation quality evaluator public pipeline", () => {
  it("segments heading units without splitting fenced code and retains hierarchy", () => {
    const sections = segmentMarkdown(
      "# Parent\n\n## Child\n\n````md\n~~~\n# Example only\n```\n~~~\n````\n\nText.\n",
    );
    expect(sections).toHaveLength(2);
    expect(sections[1]).toMatchObject({ headingPath: ["Parent", "Child"] });
    expect(sections[1].text).toContain("# Example only");
    expect(sections[0].sourceRange.endLine).toBe(2);
  });

  it("routes every allowed model to its documented endpoint and body shape", () => {
    expect(MODELS).toEqual(["clef-flash", "clef", "typesafe/jev"]);
    const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run`;
    expect(endpointFor("clef-flash", ACCOUNT_ID)).toBe(`${base}/@cf/cloudflare/clef-flash`);
    expect(endpointFor("clef", ACCOUNT_ID)).toBe(`${base}/@cf/cloudflare/clef`);
    expect(endpointFor("typesafe/jev", ACCOUNT_ID)).toBe(base);
    const state = { evidence: {} };
    const questions = { q: { type: "choice" } };
    expect(payloadFor("clef", state, questions)).toEqual({ model: "clef", state, questions });
    expect(payloadFor("typesafe/jev", state, questions)).toEqual({
      model: "typesafe/jev",
      input: { state, questions },
    });
  });

  it("accepts the documented credential shape and rejects unsafe values", () => {
    expect(readCredentials(CREDENTIALS)).toEqual({
      accountId: ACCOUNT_ID,
      apiKey: API_KEY,
      gatewayId: GATEWAY_ID,
    });
    expect(() => readCredentials({ ...CREDENTIALS, CLOUDFLARE_ACCOUNT_ID: "abc" })).toThrow(
      "32 hexadecimal",
    );
    expect(() =>
      readCredentials({ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_API_KEY: "a\nb" }),
    ).toThrow("header-safe");
    expect(() => readCredentials({ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_ID: "bad id" })).toThrow(
      "safe gateway slug",
    );
  });

  it("unwraps the native and universal response shapes and rejects failed jobs", () => {
    const questions = { "q-000001": { type: "choice" } };
    const answer = {
      type: "choice",
      choice: "pass",
      confidence: 0.94,
      probabilities: { pass: 0.96, fail: 0.03, not_applicable: 0, insufficient_context: 0.01 },
    };
    const native = (overrides = {}) => ({
      success: true,
      result: {
        model: "clef-flash",
        answers: { "q-000001": answer },
        usage: { inputTokens: 5 },
        ...overrides,
      },
    });
    const universal = (overrides = {}) => ({
      success: true,
      result: {
        state: "Completed",
        result: { model: "jev-1.13.0", answers: { "q-000001": answer }, usage: { inputTokens: 5 } },
        ...overrides,
      },
    });
    expect(validateResponse(native(), questions, "clef-flash")).toMatchObject({
      model: "clef-flash",
      usage: { inputTokens: 5 },
    });
    expect(validateResponse(universal(), questions, "typesafe/jev")).toMatchObject({
      model: "jev-1.13.0",
    });
    expect(() =>
      validateResponse(universal({ state: "Failed" }), questions, "typesafe/jev"),
    ).toThrow("did not complete");
    expect(() =>
      validateResponse({ success: false, errors: [{ code: 402 }] }, questions, "clef-flash"),
    ).toThrow("unsuccessful");
    expect(() =>
      validateResponse(
        native({ answers: { "q-000001": answer, wrong: answer } }),
        questions,
        "clef-flash",
      ),
    ).toThrow("every submitted question");
    expect(() => validateResponse(native({ answers: {} }), questions, "clef-flash")).toThrow(
      "every submitted question",
    );
  });

  it("accepts two-decimal probability rounding without accepting invalid distributions", () => {
    const questions = { "q-000001": { type: "choice" } };
    const response = (probabilities) => ({
      success: true,
      result: {
        model: "clef-flash",
        usage: null,
        answers: {
          "q-000001": { type: "choice", choice: "pass", confidence: 0.99, probabilities },
        },
      },
    });
    expect(() =>
      validateResponse(
        response({ pass: 0.99, fail: 0.01, not_applicable: 0, insufficient_context: 0 }),
        questions,
        "clef-flash",
      ),
    ).not.toThrow();
    expect(() =>
      validateResponse(
        response({ pass: 0.99, fail: 0.02, not_applicable: 0, insufficient_context: 0 }),
        questions,
        "clef-flash",
      ),
    ).not.toThrow();
    expect(() =>
      validateResponse(
        response({ pass: 0.8, fail: 0, not_applicable: 0, insufficient_context: 0 }),
        questions,
        "clef-flash",
      ),
    ).toThrow("probabilities must sum to 1");
  });

  it("rejects non-finite confidence, probabilities, and thresholds", () => {
    const questions = { q: { type: "choice" } };
    const valid = {
      type: "choice",
      choice: "pass",
      confidence: 0.9,
      probabilities: { pass: 0.9, fail: 0.05, not_applicable: 0.03, insufficient_context: 0.02 },
    };
    const envelope = (answer) => ({
      success: true,
      result: { model: "clef-flash", usage: null, answers: { q: answer } },
    });
    expect(() =>
      validateResponse(envelope({ ...valid, confidence: Number.NaN }), questions, "clef-flash"),
    ).toThrow("invalid answer");
    expect(() =>
      validateResponse(
        envelope({ ...valid, confidence: Number.POSITIVE_INFINITY }),
        questions,
        "clef-flash",
      ),
    ).toThrow("invalid answer");
    expect(() =>
      validateResponse(
        envelope({ ...valid, probabilities: { ...valid.probabilities, fail: Number.NaN } }),
        questions,
        "clef-flash",
      ),
    ).toThrow("invalid probability distribution");
    const rules = [{ id: "r", instructions: "i", pass: "p", fail: "f" }];
    const documents = [{ id: "d", path: "a.md", purpose: "p", audience: "a" }];
    expect(() =>
      validateManifest({ model: "clef-flash", threshold: Number.NaN, rules, documents }),
    ).toThrow("threshold");
    expect(() =>
      validateManifest({
        model: "clef-flash",
        threshold: Number.POSITIVE_INFINITY,
        rules,
        documents,
      }),
    ).toThrow("threshold");
    expect(() => validateManifest({ model: "clef-flash", rules, documents })).not.toThrow();
  });

  it("posts the native shape to the clef endpoint without leaking labels", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 2,
        environment: CREDENTIALS,
      }),
    );
    expect(report.reviewRequired).toBe(false);
    expect(report.requestCount).toBe(3);
    expect(report.evaluations).toHaveLength(3);
    expect(report.evaluations.at(-1)).toMatchObject({ scope: "page", model: "clef-flash" });
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url).toBe(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/cloudflare/clef-flash`,
      );
      expect(call.headers).toEqual([
        `Authorization: Bearer ${API_KEY}`,
        `cf-aig-gateway-id: ${GATEWAY_ID}`,
        "Content-Type: application/json",
        expect.stringMatching(/^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/),
        "cf-aig-cache-ttl: 3600",
        "cf-aig-skip-cache: false",
        "cf-aig-max-attempts: 1",
      ]);
      expect(Object.keys(call.payload)).toEqual(["model", "state", "questions"]);
      expect(call.payload.model).toBe("clef-flash");
      expect(call.payload.input).toBeUndefined();
      expect(Object.keys(call.payload.questions).length).toBeGreaterThan(0);
      expect(JSON.stringify(call.payload)).not.toContain("expected");
      expect(JSON.stringify(call.payload.questions)).not.toContain("ruleId");
      expect(call.argv.join(" ")).not.toContain(API_KEY);
      expect(JSON.stringify(call.payload)).not.toContain(API_KEY);
    }
    expect(JSON.stringify(report)).not.toContain(API_KEY);
    for (const entry of report.evaluations) {
      expect(entry.cache).toMatchObject({
        key: expect.stringMatching(/^decision-v1-[0-9a-f]{64}$/),
      });
      expect(entry.cache.status).toBe("MISS");
      expect(entry.cache.ray).toBe("mock-ray-0001");
      expect(entry.cache.reused).toBe(false);
    }
    const configLines = calls[0].config.split("\n");
    expect(configLines).toEqual(
      expect.arrayContaining([
        'request = "POST"',
        "fail-with-body",
        "connect-timeout = 10",
        "max-time = 45",
        `header = "Authorization: Bearer ${API_KEY}"`,
        `header = "cf-aig-gateway-id: ${GATEWAY_ID}"`,
        'header = "Content-Type: application/json"',
        'header = "cf-aig-cache-ttl: 3600"',
        'header = "cf-aig-skip-cache: false"',
        'header = "cf-aig-max-attempts: 1"',
        'write-out = "\\n%{http_code}"',
      ]),
    );
    expect(
      configLines.filter((line) => line.startsWith('header = "cf-aig-cache-key: ')).length,
    ).toBe(1);
    expect(configLines.some((line) => line.startsWith('data-binary = "@'))).toBe(true);
  });

  it("posts the universal Jev shape to the shared run endpoint", async () => {
    const paths = await fixture({ model: "typesafe/jev" });
    const { result: report, calls } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.reviewRequired).toBe(false);
    expect(report.evaluations.every((entry) => entry.model === "jev-1.13.0")).toBe(true);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run`);
      expect(Object.keys(call.payload)).toEqual(["model", "input"]);
      expect(call.payload.model).toBe("typesafe/jev");
      expect(Object.keys(call.payload.input)).toEqual(["state", "questions"]);
      expect(call.headers).toContain(`Authorization: Bearer ${API_KEY}`);
      expect(call.headers).toContain(`cf-aig-gateway-id: ${GATEWAY_ID}`);
      expect(call.headers).toContain("cf-aig-cache-ttl: 3600");
      expect(call.headers).toContain("cf-aig-skip-cache: false");
      expect(call.headers).toContain("cf-aig-max-attempts: 1");
      expect(
        call.headers.some((header) => /^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/.test(header)),
      ).toBe(true);
    }
  });

  it.each(MODELS)("adds cache headers to every model request (%s)", async (model) => {
    const paths = await fixture({ model });
    const { result: report, calls } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.headers).toContain("cf-aig-cache-ttl: 3600");
      expect(call.headers).toContain("cf-aig-skip-cache: false");
      expect(call.headers).toContain("cf-aig-max-attempts: 1");
      expect(
        call.headers.some((header) => /^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/.test(header)),
      ).toBe(true);
    }
    expect(report.requestCount).toBe(calls.length);
  });

  it("does not retry transient failures and reports one attempt per logical request", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "503,200" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.url)).size).toBe(1);
    // The Gateway is told not to retry either, closing upstream retries.
    expect(calls.every((call) => call.headers.includes("cf-aig-max-attempts: 1"))).toBe(true);
    // The first logical request observes the mocked 503 once and is reported as
    // an error; the later distinct requests observe the mocked 200.
    expect(report.evaluations[0]).toMatchObject({ status: "error", answers: [] });
    expect(report.evaluations[0].error).toContain("HTTP 503");
    expect(report.evaluations.slice(1).every((entry) => entry.status === "complete")).toBe(true);
    expect(report.attentionRequired).toBe(true);
  });

  it.each([429, 500, 502, 503, 504])(
    "reports HTTP %i once without an automatic retry",
    async (status) => {
      const paths = await fixture();
      const { result: report, calls } = await withMock(
        paths,
        { statusSequence: String(status) },
        () =>
          evaluate({
            manifestPath: paths.manifestPath,
            outputPath: paths.outputPath,
            concurrency: 1,
            environment: CREDENTIALS,
          }),
      );
      expect(report.requestCount).toBe(3);
      expect(calls).toHaveLength(3);
      expect(calls.every((call) => call.headers.includes("cf-aig-max-attempts: 1"))).toBe(true);
      expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
      expect(report.evaluations[0].error).toContain(`HTTP ${status}`);
    },
  );

  it("does not retry a curl transport timeout", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(
      paths,
      { statusSequence: "200", exitCode: 28 },
      () =>
        evaluate({
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
          concurrency: 1,
          environment: CREDENTIALS,
        }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.headers.includes("cf-aig-max-attempts: 1"))).toBe(true);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(report.evaluations[0].error).toContain("transport failed");
    expect(report.evaluations[0].error).toContain("28");
  });

  it.each([401, 402, 403])(
    "stops queued work without retrying or switching models on HTTP %i",
    async (status) => {
      const paths = await fixture();
      const { result: report, calls } = await withMock(
        paths,
        { statusSequence: String(status) },
        () =>
          evaluate({
            manifestPath: paths.manifestPath,
            outputPath: paths.outputPath,
            concurrency: 1,
            environment: CREDENTIALS,
          }),
      );
      expect(report.requestCount).toBe(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("@cf/cloudflare/clef-flash");
      expect(calls[0].headers).toContain("cf-aig-max-attempts: 1");
      expect(report.reviewRequired).toBe(true);
      expect(report.attentionRequired).toBe(true);
      expect(report.evaluations[0]).toMatchObject({ status: "error", answers: [] });
      expect(report.evaluations[0].error).toContain(`HTTP ${status}`);
      expect(report.evaluations.slice(1)).toHaveLength(2);
      expect(report.evaluations.slice(1).every((entry) => entry.status === "skipped")).toBe(true);
      expect(
        report.evaluations.slice(1).every((entry) => entry.error.includes(`HTTP ${status}`)),
      ).toBe(true);
      const written = JSON.parse(await readFile(paths.outputPath, "utf8"));
      expect(written.evaluations).toHaveLength(3);
      expect(written.reviewRequired).toBe(true);
    },
  );

  it("rejects a nonzero curl exit even when stdout carries a valid 200 response", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { exitCode: 28 }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(report.evaluations[0].error).toContain("transport failed");
    expect(report.evaluations[0].error).toContain("28");
    expect(report.attentionRequired).toBe(true);
  });

  it("exits 1 through the public CLI for live evaluation failures", async () => {
    const paths = await fixture();
    const mock = await prepareMock(paths, { statusSequence: "402" });
    try {
      await expect(
        execute(
          process.execPath,
          [
            script,
            "--manifest",
            paths.manifestPath,
            "--output",
            paths.outputPath,
            "--concurrency",
            "1",
          ],
          { env: { ...process.env, ...CREDENTIALS } },
        ),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      mock.restore();
    }
    const report = JSON.parse(await readFile(paths.outputPath, "utf8"));
    expect(report).toMatchObject({
      requestCount: 1,
      reviewRequired: true,
      attentionRequired: true,
      dryRun: false,
    });
    expect(report.evaluations[0].status).toBe("error");
    expect(report.evaluations[1].status).toBe("skipped");
  });

  it("records a non-retryable bad status as an evaluation error", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "400" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.reviewRequired).toBe(true);
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(report.evaluations[0].error).toContain("HTTP 400");
  });

  it("writes a review-required report when the response answers are malformed", async () => {
    const paths = await fixture();
    const { result: report } = await withMock(paths, { mode: "malformed" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        environment: CREDENTIALS,
      }),
    );
    expect(report.reviewRequired).toBe(true);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(JSON.parse(await readFile(paths.outputPath, "utf8")).evaluations).toHaveLength(3);
  });

  it("rejects an unsuccessful request and an incomplete Jev job", async () => {
    const nativePaths = await fixture();
    const { result: nativeReport } = await withMock(nativePaths, { mode: "native-failed" }, () =>
      evaluate({
        manifestPath: nativePaths.manifestPath,
        outputPath: nativePaths.outputPath,
        environment: CREDENTIALS,
      }),
    );
    expect(nativeReport.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(nativeReport.evaluations[0].error).toContain("unsuccessful");

    const jevPaths = await fixture({ model: "typesafe/jev" });
    const { result: jevReport } = await withMock(jevPaths, { mode: "wrapper-failed" }, () =>
      evaluate({
        manifestPath: jevPaths.manifestPath,
        outputPath: jevPaths.outputPath,
        environment: CREDENTIALS,
      }),
    );
    expect(jevReport.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(jevReport.evaluations[0].error).toContain("did not complete");
  });

  it("rejects unknown manifest models", async () => {
    const paths = await fixture({ model: "gpt-oss" });
    await expect(
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        dryRun: true,
        environment: {},
      }),
    ).rejects.toThrow("manifest.model must be one of");
  });

  it("rejects unsafe credentials before any network call", async () => {
    const paths = await fixture();
    const cases = [
      [{ ...CREDENTIALS, CLOUDFLARE_ACCOUNT_ID: "not-hex" }, "32 hexadecimal"],
      [{ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_API_KEY: "line\nbreak" }, "header-safe"],
      [{ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_ID: "unsafe/id" }, "safe gateway slug"],
      [{}, "must be a non-empty string"],
    ];
    for (const [environment, message] of cases) {
      await expect(
        evaluate({
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
          environment,
        }),
      ).rejects.toThrow(message);
    }
  });

  it("performs zero network calls in dry-run mode", async () => {
    const paths = await fixture();
    const report = await evaluate({
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
      dryRun: true,
      environment: {},
    });
    expect(report).toMatchObject({ dryRun: true, reviewRequired: false, requestCount: 0 });
    expect(report.evaluations.every((entry) => entry.status === "dry_run")).toBe(true);
  });

  it("resolves an exclusive rulesFile relative to the manifest", async () => {
    const paths = await fixture();
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8"));
    await writeFile(resolve(paths.directory, "rules.json"), JSON.stringify(manifest.rules));
    delete manifest.rules;
    manifest.rulesFile = "rules.json";
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    const report = await evaluate({
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
      dryRun: true,
      environment: {},
    });
    expect(report.evaluations).toHaveLength(3);
  });

  it("derives explicit sections from source ranges and rejects an empty list", async () => {
    const paths = await fixture();
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8"));
    manifest.documents[0].sections = [
      { id: "detail", startLine: 5, endLine: 10, headingPath: ["Start", "Details"] },
    ];
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    const report = await evaluate({
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
      dryRun: true,
      environment: {},
    });
    expect(report.evaluations[0].section).toMatchObject({
      id: "detail",
      sourceRange: { startLine: 5, endLine: 10 },
    });
    manifest.documents[0].sections = [];
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    await expect(
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        dryRun: true,
        environment: {},
      }),
    ).rejects.toThrow("sections must not be empty");
  });

  it("derives a deterministic decision cache key that is sensitive to its inputs", () => {
    expect(canonicalJson({ 10: "a", 2: "b" })).toBe('{"10":"a","2":"b"}');
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}');
    expect(canonicalJson({ list: [2, 1] })).toBe('{"list":[2,1]}');

    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/cloudflare/clef-flash`;
    const body = {
      model: "clef-flash",
      state: { b: 1, a: 2 },
      questions: {
        "q-000002": { criteria: { fail: "f", pass: "p" } },
        "q-000001": { criteria: { fail: "f", pass: "p" } },
      },
    };
    const base = { url, gatewayId: GATEWAY_ID, apiKey: API_KEY, body };
    const key = cacheFingerprint(base);
    expect(key).toMatch(/^decision-v1-[0-9a-f]{64}$/);
    expect(key).not.toContain(API_KEY);
    // Canonical key ordering makes equivalent bodies fingerprint identically.
    expect(
      cacheFingerprint({
        ...base,
        body: {
          model: "clef-flash",
          state: { a: 2, b: 1 },
          questions: {
            "q-000001": { criteria: { pass: "p", fail: "f" } },
            "q-000002": { criteria: { pass: "p", fail: "f" } },
          },
        },
      }),
    ).toBe(key);
    // Account route, gateway, token, model, state, criteria, and array order all matter.
    expect(cacheFingerprint({ ...base, url: "https://example.test/run" })).not.toBe(key);
    expect(cacheFingerprint({ ...base, gatewayId: "other-gateway" })).not.toBe(key);
    expect(cacheFingerprint({ ...base, apiKey: "other-key" })).not.toBe(key);
    expect(cacheFingerprint({ ...base, body: { ...body, model: "clef" } })).not.toBe(key);
    expect(cacheFingerprint({ ...base, body: { ...body, state: { a: 2, b: 3 } } })).not.toBe(key);
    expect(
      cacheFingerprint({
        ...base,
        body: {
          ...body,
          questions: {
            ...body.questions,
            "q-000001": { criteria: { pass: "different", fail: "f" } },
          },
        },
      }),
    ).not.toBe(key);
    expect(
      cacheFingerprint({ ...base, body: { ...body, state: { a: 2, b: 1, list: [1, 2] } } }),
    ).not.toBe(
      cacheFingerprint({ ...base, body: { ...body, state: { a: 2, b: 1, list: [2, 1] } } }),
    );
  });

  it("parses the cf-aig-cache-status header without inventing a value", () => {
    expect(parseCacheStatus("HTTP/1.1 200 OK\r\ncf-aig-cache-status: HIT\r\n\r\n")).toBe("HIT");
    expect(parseCacheStatus("HTTP/1.1 200 OK\r\ncf-aig-cache-status: miss\r\n\r\n")).toBe("MISS");
    expect(
      parseCacheStatus("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n"),
    ).toBeNull();
  });

  it("shares one request across concurrent equivalent evaluations and maps distinct report IDs", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 4,
        environment: CREDENTIALS,
      }),
    );
    // Two identical documents each contribute two section units and one page unit.
    expect(report.evaluations).toHaveLength(6);
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations.every((entry) => entry.status === "complete")).toBe(true);
    expect(report.evaluations.filter((entry) => entry.cache.reused)).toHaveLength(3);
    // Mocked headers are recorded verbatim; this does not prove a real Gateway hit.
    expect(report.evaluations.every((entry) => entry.cache.status === "MISS")).toBe(true);
    assertAnswerIdentities(report);

    const sectionA = evaluationOf(report, "guide-a", "section", "section-1");
    const sectionB = evaluationOf(report, "guide-b", "section", "section-1");
    expect(sectionA.cache.key).toBe(sectionB.cache.key);
    expect(sectionA.cache.reused).toBe(false);
    expect(sectionB.cache.reused).toBe(true);
    expect(sectionA.answers[0].questionId).toBe(sectionA.questions[0].id);
    expect(sectionB.answers[0].questionId).toBe(sectionB.questions[0].id);
    expect(sectionA.questions[0].id).not.toBe(sectionB.questions[0].id);
  });

  it("reuses resolved promises for sequential duplicates without another request", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations.slice(0, 3).every((entry) => entry.cache.reused === false)).toBe(
      true,
    );
    expect(report.evaluations.slice(3).every((entry) => entry.cache.reused === true)).toBe(true);
    assertAnswerIdentities(report);
    expect(new Set(report.evaluations.map((entry) => entry.cache.key)).size).toBe(3);
  });

  it("shares failed outcomes for duplicates without a second attempt", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "503" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 4,
        environment: CREDENTIALS,
      }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations).toHaveLength(6);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(report.evaluations.every((entry) => entry.error.includes("HTTP 503"))).toBe(true);
    expect(report.evaluations.every((entry) => entry.answers.length === 0)).toBe(true);
  });

  it("shares a cached malformed response once and preserves its cache evidence", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(
      paths,
      { mode: "malformed", cacheStatus: "MISS", ray: "mock-ray-4242" },
      () =>
        evaluate({
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
          concurrency: 2,
          environment: CREDENTIALS,
        }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations).toHaveLength(6);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(new Set(report.evaluations.map((entry) => entry.error)).size).toBe(1);
    expect(report.evaluations.filter((entry) => entry.cache.reused)).toHaveLength(3);
    // Validation failures keep the cache evidence from the actual response headers.
    expect(report.evaluations.every((entry) => entry.cache.status === "MISS")).toBe(true);
    expect(report.evaluations.every((entry) => entry.cache.ray === "mock-ray-4242")).toBe(true);
  });

  it("keeps decision cache keys stable across runs independent of run-wide report IDs", async () => {
    const paths = await fixture();
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8"));
    await writeFile(
      resolve(paths.directory, "intro.md"),
      "# Intro\n\nIntro text.\n\n## Sub\n\nMore.\n",
    );
    const intro = {
      id: "intro",
      path: "intro.md",
      purpose: "Introduce.",
      audience: "A new user.",
      context: "Evidence only.",
      ruleIds: ["direct", "flow"],
    };

    await writeFile(
      paths.manifestPath,
      JSON.stringify({ ...manifest, documents: [manifest.documents[0]] }),
    );
    const { result: runA, calls: callsA } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );

    await writeFile(
      paths.manifestPath,
      JSON.stringify({ ...manifest, documents: [intro, manifest.documents[0]] }),
    );
    const { result: runB, calls: callsB } = await withMock(paths, {}, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );

    expect(callsA).toHaveLength(3);
    const runBCalls = callsB.slice(callsA.length);
    expect(runBCalls).toHaveLength(6);
    const guideA = evaluationOf(runA, "guide", "section", "section-1");
    const guideB = evaluationOf(runB, "guide", "section", "section-1");
    expect(guideA.cache.key).toBe(guideB.cache.key);
    // Report identities differ because the leading document shifts the run-wide counter.
    expect(guideA.questions[0].id).toBe("q-000001");
    expect(guideB.questions[0].id).toBe("q-000004");
    expect(guideA.questions[0].id).not.toBe(guideB.questions[0].id);
    // Request-local numbering keeps the transmitted payload identical.
    expect(Object.keys(callsA[0].payload.questions)).toEqual(["q-000001"]);
    expect(Object.keys(runBCalls[3].payload.questions)).toEqual(["q-000001"]);
  });

  it("does not share cache entries for meaningful evidence or criteria changes", async () => {
    const evidencePaths = await duplicateFixture({ secondContext: "Different context." });
    const { result: evidenceReport, calls: evidenceCalls } = await withMock(evidencePaths, {}, () =>
      evaluate({
        manifestPath: evidencePaths.manifestPath,
        outputPath: evidencePaths.outputPath,
        concurrency: 4,
        environment: CREDENTIALS,
      }),
    );
    expect(evidenceCalls).toHaveLength(6);
    expect(evidenceReport.requestCount).toBe(6);
    expect(evidenceReport.evaluations.some((entry) => entry.cache.reused)).toBe(false);
    expect(evaluationOf(evidenceReport, "guide-a", "section", "section-1").cache.key).not.toBe(
      evaluationOf(evidenceReport, "guide-b", "section", "section-1").cache.key,
    );

    const criteriaPaths = await duplicateFixture({ secondRuleIds: ["strict", "flow"] });
    const { result: criteriaReport, calls: criteriaCalls } = await withMock(criteriaPaths, {}, () =>
      evaluate({
        manifestPath: criteriaPaths.manifestPath,
        outputPath: criteriaPaths.outputPath,
        concurrency: 4,
        environment: CREDENTIALS,
      }),
    );
    // Each document has two distinct section units plus one page unit. The
    // section criteria differ between documents, so only the page request is
    // shared: four section requests plus one page request.
    expect(criteriaCalls).toHaveLength(5);
    expect(criteriaReport.requestCount).toBe(5);
    const sectionA = evaluationOf(criteriaReport, "guide-a", "section", "section-1");
    const sectionB = evaluationOf(criteriaReport, "guide-b", "section", "section-1");
    const pageA = evaluationOf(criteriaReport, "guide-a", "page");
    const pageB = evaluationOf(criteriaReport, "guide-b", "page");
    expect(sectionA.cache.key).not.toBe(sectionB.cache.key);
    expect(pageA.cache.key).toBe(pageB.cache.key);
    expect(pageA.cache.reused).toBe(false);
    expect(pageB.cache.reused).toBe(true);
  });

  it("records the mocked cache status header without claiming a real hit", async () => {
    const paths = await fixture();
    const { result: report } = await withMock(paths, { cacheStatus: "HIT" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    // The evaluator records the response header value verbatim. The mock header
    // is not evidence of a real AI Gateway cache hit.
    expect(report.evaluations.every((entry) => entry.cache.status === "HIT")).toBe(true);
    expect(report.evaluations.every((entry) => entry.cache.reused === false)).toBe(true);
  });
});
