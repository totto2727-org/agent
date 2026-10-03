import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import {
  MODELS,
  endpointFor,
  evaluate,
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
    fs.writeFileSync(headersPath, "HTTP/1.1 200 OK\\r\\ncontent-type: application/json\\r\\n\\r\\n");
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
  };
  process.env.PATH = `${paths.directory}:${saved.PATH}`;
  process.env.CURL_LOG = log;
  process.env.CURL_MOCK_COUNTER = counter;
  delete process.env.CURL_MOCK_EXIT;
  delete process.env.CURL_MOCK_MODE;
  delete process.env.CURL_MOCK_STATUS_SEQUENCE;
  if (options.exitCode) process.env.CURL_MOCK_EXIT = String(options.exitCode);
  if (options.mode) process.env.CURL_MOCK_MODE = options.mode;
  if (options.statusSequence) process.env.CURL_MOCK_STATUS_SEQUENCE = options.statusSequence;
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
        'write-out = "\\n%{http_code}"',
      ]),
    );
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
    }
  });

  it("retries bounded transient failures before completing", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "503,200" }, () =>
      evaluate({
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
        concurrency: 1,
        environment: CREDENTIALS,
      }),
    );
    expect(report.reviewRequired).toBe(false);
    expect(report.requestCount).toBe(4);
    expect(report.evaluations.every((entry) => entry.status === "complete")).toBe(true);
    expect(calls).toHaveLength(4);
    expect(new Set(calls.map((call) => call.url)).size).toBe(1);
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
});
