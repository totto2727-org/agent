// oxlint-disable-next-line rules/no-node-imports -- Install and read a real curl-shaped subprocess fixture.
import { chmod, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Keep the mock executable and its trace in the fixture directory.
import path from "node:path";
import { object, text } from "./evaluation-validation.mjs";
import { isEmptyString, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {{ directory: string }} MockDirectory */
/** @typedef {{ cacheStatus?: string, exitCode?: number, mode?: string, ray?: string, statusSequence?: string }} MockOptions */
/** @typedef {{ argv: string[], config: string, headers: string[], payload: Record<string, unknown>, url: string }} MockCall */

// The evaluator must not send a request-level retry override, so the Gateway's
// Own configured retry policy stays in effect.
/** @type {(call: MockCall) => boolean} */
export const hasRetryOverride = (call) =>
  call.headers.some((header) => header.startsWith("cf-aig-max-attempts:"));

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
const answer = () => mode === "abstain"
  ? ({ type: "choice", choice: "insufficient_context", confidence: 0.94, probabilities: { pass: 0.01, fail: 0.03, not_applicable: 0, insufficient_context: 0.96 } })
  : ({ type: "choice", choice: "pass", confidence: 0.94, probabilities: { pass: 0.96, fail: 0.03, not_applicable: 0, insufficient_context: 0.01 } });
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

const CURL_EXECUTABLE_MODE = 0o755;

/** @type {(directory: string) => Promise<string>} */
const installCurlMock = async function (directory) {
  const mockPath = path.resolve(directory, "curl");
  await writeFile(mockPath, MOCK_SOURCE);
  await chmod(mockPath, CURL_EXECUTABLE_MODE);
  return mockPath;
};

/** @type {(value: unknown, label: string) => string[]} */
const traceStrings = (value, label) => {
  if (!Array.isArray(value)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Use the native TypeError when the simulated request has an invalid trace.
    throw new TypeError(`${label} must be an array`);
  }
  return value.map((entry) => text(entry, label));
};

/** @type {(line: string) => MockCall} */
const decodeMockCall = (line) => {
  const call = object(JSON.parse(line), "curl transcript");
  return {
    argv: traceStrings(call.argv, "curl argument"),
    config: text(call.config, "curl configuration"),
    headers: traceStrings(call.headers, "curl header"),
    payload: object(call.payload, "curl payload"),
    url: text(call.url, "curl URL"),
  };
};

/**
 * @param {string} log - The request trace produced by the mock executable.
 * @returns {Promise<MockCall[]>} Every request made by the test subprocess.
 */
const readCalls = async function (log) {
  const content = await readFile(log, "utf8").catch(() => "");
  return content
    .trim()
    .split("\n")
    .filter((line) => !isEmptyString(line))
    .map((line) => decodeMockCall(line));
};

/** @type {(call: MockCall) => Record<string, unknown>} */
export const localEvidence = (call) => {
  const state = object(call.payload.state, "native request state");
  const evidence = object(state.evidence, "native request evidence");
  return object(evidence.local, "local request evidence");
};

/** @type {(value: unknown, label: string) => unknown[]} */
export const requestArray = (value, label) => {
  if (!Array.isArray(value)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Match the test fixture's native type error for a malformed subprocess request.
    throw new TypeError(`The request must contain ${label}`);
  }
  return value;
};

/** @type {() => NodeJS.ProcessEnv} */
// oxlint-disable-next-line node/no-process-env -- The native curl subprocess inherits the fixture PATH and options from this test host.
export const hostEnvironment = () => process.env;

/** @typedef {[name: string, value: string | undefined]} EnvironmentValue */

/** @type {(environment: NodeJS.ProcessEnv, changes: EnvironmentValue[]) => void} */
const setEnvironment = (environment, changes) => {
  changes.forEach(([key, value]) => {
    if (matchesUndefined(value)) {
      Reflect.deleteProperty(environment, key);
    } else {
      environment[key] = value;
    }
  });
};

/** @type {(value: string | undefined) => string | undefined} */
const suppliedMockString = (value) => {
  const supplied = Boolean(value);
  return supplied ? value : undefined;
};

/** @type {(directory: string, options: MockOptions) => EnvironmentValue[]} */
const mockVariables = (directory, { cacheStatus, exitCode, mode, ray, statusSequence }) => {
  const suppliedExit = Boolean(exitCode);
  return [
    ["PATH", `${directory}:${hostEnvironment().PATH}`],
    ["CURL_LOG", path.resolve(directory, "calls.log")],
    ["CURL_MOCK_COUNTER", path.resolve(directory, "counter.txt")],
    ["CURL_MOCK_EXIT", suppliedExit ? String(exitCode) : undefined],
    ["CURL_MOCK_MODE", suppliedMockString(mode)],
    ["CURL_MOCK_STATUS_SEQUENCE", suppliedMockString(statusSequence)],
    ["CURL_MOCK_CACHE_STATUS", suppliedMockString(cacheStatus)],
    ["CURL_MOCK_RAY", suppliedMockString(ray)],
  ];
};

/** @type {(paths: MockDirectory, options?: MockOptions) => Promise<{ log: string, restore: () => void }>} */
export const prepareMock = async function (paths, options = {}) {
  await installCurlMock(paths.directory);
  const environment = hostEnvironment();
  const changes = mockVariables(paths.directory, options);
  /** @type {EnvironmentValue[]} */
  const saved = changes.map(([name]) => [name, environment[name]]);
  setEnvironment(environment, changes);
  return {
    log: path.resolve(paths.directory, "calls.log"),
    restore: () => {
      setEnvironment(hostEnvironment(), saved);
    },
  };
};

/**
 * @template Result
 * @param {MockDirectory} paths - The fixture directory for the mock and its trace.
 * @param {MockOptions} options - The simulated response.
 * @param {() => Result | PromiseLike<Result>} runTest - The evaluator or CLI invocation.
 * @returns {Promise<{ calls: Awaited<ReturnType<typeof readCalls>>, result: Awaited<Result> }>} The invocation result and its recorded requests.
 */
export const withMock = async function (paths, options, runTest) {
  const mock = await prepareMock(paths, options);
  try {
    const result = await runTest();
    return { calls: await readCalls(mock.log), result };
  } finally {
    mock.restore();
  }
};
