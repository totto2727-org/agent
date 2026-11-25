/* oxlint-disable eslint/max-lines -- Keep the existing evaluator groups discoverable in their single Vitest entry file. */
// oxlint-disable-next-line rules/no-node-imports -- Inspect and update the evaluator's CLI fixture artifacts.
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve each CLI fixture's input and output files.
import path from "node:path";
import { afterEach, assert, describe, expect, test } from "vitest";

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
import {
  hasRetryOverride,
  hostEnvironment,
  localEvidence,
  prepareMock,
  requestArray,
  withMock,
} from "./evaluation-test-curl.mjs";
import {
  cleanupFixtures,
  dictionaryFixture,
  duplicateFixture,
  fixture,
  readFixtureManifest,
  runEvaluationCli,
} from "./evaluation-test-fixtures.mjs";
import { readEvaluationReport } from "./evaluation-test-support.mjs";
import { object, text } from "./evaluation-validation.mjs";
import {
  paragraphUnits,
  runMechanical,
  sourceRange,
  validateMechanicalCheck,
} from "./mechanical.mjs";
import { matchesNull, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {Awaited<ReturnType<typeof evaluate>>} EvaluationReport */
/** @typedef {EvaluationReport["evaluations"][number]} Evaluation */
/** @typedef {Pick<Evaluation, "answers" | "questions"> & { cache: NonNullable<Evaluation["cache"]> }} CachedEvaluation */
const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const API_KEY = "test-gateway-key";
const GATEWAY_ID = "test-gateway";
const CREDENTIALS = {
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
  CLOUDFLARE_AI_GATEWAY_API_KEY: API_KEY,
  CLOUDFLARE_AI_GATEWAY_ID: GATEWAY_ID,
};

// oxlint-disable-next-line unicorn/no-null -- Provider usage and serialized report fields use JSON null.
const JSON_NULL = null;
const EMPTY_LENGTH = 0;

/** @type {(values: ReadonlyArray<unknown>) => boolean} */
const isEmptyArray = (values) => values.length === EMPTY_LENGTH;

const withoutCredentials = () =>
  Object.fromEntries(
    Object.entries(hostEnvironment()).filter(([name]) => !Object.hasOwn(CREDENTIALS, name)),
  );

/** @type {(fragment: string) => unknown} */
const containingText = (fragment) => expect.stringContaining(fragment);

/** @type {(pattern: RegExp) => unknown} */
const matchingText = (pattern) => expect.stringMatching(pattern);

/** @type {(values: unknown[]) => unknown} */
const containingValues = (values) => expect.arrayContaining(values);

/** @type {(entry: Evaluation) => NonNullable<Evaluation["cache"]>} */
const cacheOf = (entry) => {
  const { cache } = entry;
  assert(!matchesNull(cache), "Evaluation needs its recorded cache evidence.");
  return cache;
};

/** @type {(report: EvaluationReport, options: { documentId: string, scope: Evaluation["scope"], sectionId?: string | null }) => CachedEvaluation} */
const cachedEvaluationOf = function (report, { documentId, scope, sectionId = JSON_NULL }) {
  const entry = report.evaluations.find(
    (candidate) =>
      candidate.documentId === documentId &&
      candidate.scope === scope &&
      (matchesNull(sectionId) || candidate.section?.id === sectionId),
  );
  assert(!matchesUndefined(entry), `Missing evaluation for ${documentId} (${scope}).`);
  const { answers, questions } = entry;
  return { answers, cache: cacheOf(entry), questions };
};

/** @type {(answer: Evaluation["answers"][number] | import("./mechanical.mjs").MechanicalResult) => import("./mechanical.mjs").Coverage} */
const mechanicalCoverage = (answer) => {
  assert("coverage" in answer, "Mechanical answer needs its coverage.");
  return answer.coverage;
};

/** @type {(entry: Evaluation) => string} */
const evaluationFailure = (entry) => {
  assert("error" in entry, "Failed evaluation needs its diagnostic.");
  return text(entry.error, "evaluation failure");
};

/** @type {(report: EvaluationReport) => void} */
const assertAnswerIdentities = function (report) {
  Iterator.from(report.evaluations).forEach((entry) => {
    const ids = new Set(entry.questions.map((question) => question.id));
    expect(entry.answers).toHaveLength(entry.questions.length);
    entry.answers.forEach((answer) => {
      expect(ids.has(answer.questionId)).toBe(true);
    });
  });
};

/** @type {(probabilities: Record<string, number>) => unknown} */
const roundedResponse = (probabilities) => ({
  result: {
    answers: {
      "q-000001": { choice: "pass", confidence: 0.99, probabilities, type: "choice" },
    },
    model: "clef-flash",
    usage: JSON_NULL,
  },
  success: true,
});

/** @type {(answer: unknown) => unknown} */
const responseEnvelope = (answer) => ({
  result: { answers: { q: answer }, model: "clef-flash", usage: JSON_NULL },
  success: true,
});

/** @type {(entry: Evaluation) => boolean} */
const hasJevModel = (entry) => "model" in entry && entry.model === "jev-1.13.0";

/** @typedef {import("./evaluation-test-curl.mjs").MockCall} MockCall */
/** @typedef {Awaited<ReturnType<typeof fixture>>} FixturePaths */
/** @typedef {import("./evaluation-test-fixtures.mjs").FixtureManifest} FixtureManifest */

/** @type {(markdown: string, range: { endByte: number, startByte: number }) => string} */
const rangeText = (markdown, { endByte, startByte }) =>
  Buffer.from(markdown).subarray(startByte, endByte).toString();

/** @type {(input: { markdown: string }) => boolean} */
const isSetup = ({ markdown }) => markdown.includes("# Setup");

/** @type {(args: string[]) => Promise<{ code: unknown, stderr: string }>} */
const captureCliFailure = async (args) => {
  const result = await runEvaluationCli(args).catch(
    /** @type {(error: unknown) => unknown} */
    (error) => error,
  );
  const { code, stderr } = object(result, "CLI completion");
  return { code, stderr: text(stderr, "CLI diagnostic") };
};

const nounGroupFixture = async () => {
  const paths = await dictionaryFixture({ vocabulary: false });
  await writeFile(
    path.resolve(paths.directory, "guide.md"),
    "Check the upper status panel and panel (upper) assembly.\n",
  );
  const manifest = await readFixtureManifest(paths.manifestPath);
  const rule = manifest.rules?.[0];
  assert(!matchesUndefined(rule), "Dictionary fixture needs its first rule.");
  delete rule.requiresDictionaryEntries;
  rule.requiresNounGroupCounts = true;
  manifest.documents[0].ste = {
    nounGroups: [
      { kind: "multi-word", source: "Original local role claim.", text: "upper status panel" },
      {
        kind: "new-technical",
        source: "Original ambiguous role claim.",
        text: "panel (upper) assembly",
      },
    ],
  };
  await writeFile(paths.manifestPath, JSON.stringify(manifest));
  return paths;
};

/** @type {(call: MockCall) => { candidates: unknown[], payload: MockCall["payload"], question: Record<string, unknown>, selected: Record<string, unknown> }} */
const dictionaryRequest = (call) => {
  const { payload } = call;
  const selected = object(localEvidence(call).dictionaryCandidates, "dictionary evidence");
  const candidates = requestArray(selected.candidates, "dictionary candidates");
  const [rawQuestion] = Object.values(object(payload.questions, "native request questions"));
  const question = object(rawQuestion, "first native request question");
  return { candidates, payload, question, selected };
};

// oxlint-disable-next-line eslint/max-lines-per-function -- Group the current private-dictionary cases under their existing Vitest name and fixture cleanup.
describe("private dictionary evidence boundaries", () => {
  afterEach(async () => {
    await cleanupFixtures();
  });

  test("guards a provider pass when matched noun evidence contains an unsupported local group", async () => {
    const paths = await nounGroupFixture();
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(calls).toHaveLength(1);
    const counts = requestArray(localEvidence(calls[0]).nounGroupCounts, "noun group counts");
    const projected = counts.map((entry) => {
      const { status, wordCount } = object(entry, "noun group count");
      return [status, wordCount];
    });
    expect(projected).toStrictEqual([
      ["counted", 3],
      ["insufficient_context", JSON_NULL],
    ]);
    expect(report.evaluations[0].nounGroupCounts).toStrictEqual(counts);
    expect(report.evaluations[0].answers[0]).toMatchObject({
      choice: "insufficient_context",
      confidence: 0,
      origin: "evidence-guard",
      providerAnswer: { choice: "pass", confidence: 0.94, probabilities: { pass: 0.96 } },
      reason: containingText("machine counts"),
      reviewRequired: true,
    });
  });

  test("allows source-declared technical terms to supply local contextual evidence without ordinary dictionary membership", async () => {
    const paths = await dictionaryFixture({ complete: true });
    await writeFile(path.resolve(paths.directory, "guide.md"), "Check the status panel.\n");
    paths.data.technicalTerms = [
      {
        category: 19,
        kind: "noun",
        source: "Original company glossary fixture.",
        text: "status panel",
      },
    ];
    await writeFile(
      path.resolve(paths.directory, "private-vocabulary.json"),
      JSON.stringify(paths.data),
    );
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(calls).toHaveLength(1);
    const { candidates } = object(
      localEvidence(calls[0]).dictionaryCandidates,
      "dictionary evidence",
    );
    const candidate = requestArray(candidates, "dictionary candidates").find(
      (entry) => object(entry, "dictionary candidate").term === "status panel",
    );
    expect(candidate).toMatchObject({
      membership: "unlisted",
      records: [],
      technicalRecords: paths.data.technicalTerms,
    });
    expect(report.evaluations[0].answers[0]).toMatchObject({
      choice: "pass",
      confidence: 0.94,
      reviewRequired: false,
    });
  });

  test("defers oversized selected dictionary evidence before credentials or billing", async () => {
    const paths = await dictionaryFixture({ complete: true });
    paths.data.entries[0].meaning = "x".repeat(50_000);
    await writeFile(
      path.resolve(paths.directory, "private-vocabulary.json"),
      JSON.stringify(paths.data),
    );
    const report = await evaluate({ ...paths, environment: {} });
    expect(report).toMatchObject({ incomplete: true, requestCount: 0, reviewRequired: true });
    expect(report.evaluations[0]).toMatchObject({
      answers: [{ choice: "insufficient_context" }],
      status: "deferred",
    });
  });

  test("defers dictionary-dependent judgments without matched entries and without credentials or requests", async () => {
    const paths = await dictionaryFixture({ vocabulary: false });
    const report = await evaluate({ ...paths, environment: {} });
    expect(report).toMatchObject({ incomplete: true, requestCount: 0, reviewRequired: true });
    expect(report.evaluations[0]).toMatchObject({
      answers: [{ choice: "insufficient_context", reviewRequired: true }],
      status: "deferred",
    });
    expect(report.evaluations[0]).toMatchObject({
      reason: containingText("Required dictionary entries"),
    });
  });

  test("sends only target-matched records, no private path or unrelated records, and rejects an unsupported model pass", async () => {
    const paths = await dictionaryFixture();
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(calls).toHaveLength(1);
    const { candidates, payload, question, selected } = dictionaryRequest(calls[0]);
    expect({
      candidate: candidates[0],
      issue: selected.issue,
      source: selected.source,
    }).toMatchObject({
      candidate: {
        membership: "approved-form",
        records: [
          {
            approved: true,
            listedForms: ["check"],
            meaning: "Selected local meaning.",
            partOfSpeech: "synthetic",
            word: "check",
          },
        ],
        sourceRange: { endByte: 5, endLine: 1, startByte: 0, startLine: 1 },
        term: "Check",
      },
      issue: 9,
      source: paths.data.source,
    });
    expect({
      leakedPath: JSON.stringify(payload).includes("private-vocabulary.json"),
      leakedRecord: JSON.stringify(selected).includes("UNMATCHED-PRIVATE-MEANING"),
    }).toStrictEqual({
      leakedPath: false,
      leakedRecord: false,
    });
    expect(question.instructions).toContain("never model memory");
    expect(report.evaluations[0].answers[0]).toMatchObject({
      choice: "insufficient_context",
      confidence: 0,
      origin: "evidence-guard",
      providerAnswer: {
        choice: "pass",
        confidence: 0.94,
        probabilities: { fail: 0.03, insufficient_context: 0.01, not_applicable: 0, pass: 0.96 },
      },
      reason: containingText("model pass"),
      reviewRequired: true,
    });
  });

  test("retains a calibrated contextual model result when every local token has declared evidence", async () => {
    const paths = await dictionaryFixture({ complete: true });
    const { result: report } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(report.evaluations[0].answers[0]).toMatchObject({
      choice: "pass",
      confidence: 0.94,
      reviewRequired: false,
    });
  });

  test("includes selected meanings in the cache key but excludes unmatched private entry changes", async () => {
    const paths = await dictionaryFixture({ complete: true });
    const { result: keys, calls } = await withMock(paths, {}, async () => {
      const first = await evaluate({ ...paths, environment: CREDENTIALS });
      paths.data.entries[1].meaning = "DIFFERENT-UNMATCHED-PRIVATE-MEANING";
      await writeFile(
        path.resolve(paths.directory, "private-vocabulary.json"),
        JSON.stringify(paths.data),
      );
      const second = await evaluate({ ...paths, environment: CREDENTIALS });
      paths.data.entries[0].meaning = "Different selected local meaning.";
      await writeFile(
        path.resolve(paths.directory, "private-vocabulary.json"),
        JSON.stringify(paths.data),
      );
      const third = await evaluate({ ...paths, environment: CREDENTIALS });
      return [first, second, third].map((report) => cacheOf(report.evaluations[0]).key);
    });
    expect(calls).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});

/** @type {(calls: MockCall[]) => void} */
const assertClefRequests = (calls) => {
  const expectedRequest = {
    hasQuestions: true,
    headers: [
      `Authorization: Bearer ${API_KEY}`,
      `cf-aig-gateway-id: ${GATEWAY_ID}`,
      "Content-Type: application/json",
      matchingText(/^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/u),
      "cf-aig-cache-ttl: 2592000",
      "cf-aig-skip-cache: false",
    ],
    input: undefined,
    leakedApiKey: false,
    leakedExpectedLabel: false,
    leakedRuleId: false,
    model: "clef-flash",
    payloadKeys: ["model", "state", "questions"],
    retryOverride: false,
    url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/cloudflare/clef-flash`,
  };
  const requests = calls.map((call) => {
    const serialized = JSON.stringify(call.payload);
    return {
      hasQuestions: !isEmptyArray(
        Object.keys(object(call.payload.questions, "native request questions")),
      ),
      headers: call.headers,
      input: call.payload.input,
      leakedApiKey: [call.argv.join(" "), serialized].some((item) => item.includes(API_KEY)),
      leakedExpectedLabel: serialized.includes("expected"),
      leakedRuleId: JSON.stringify(call.payload.questions).includes("ruleId"),
      model: call.payload.model,
      payloadKeys: Object.keys(call.payload),
      retryOverride: hasRetryOverride(call),
      url: call.url,
    };
  });
  expect(requests).toStrictEqual([expectedRequest, expectedRequest, expectedRequest]);
};

/** @type {(config: string) => void} */
const assertClefCurlConfig = (config) => {
  const configLines = config.split("\n");
  expect({
    cacheKeys: configLines.filter((line) => line.startsWith('header = "cf-aig-cache-key: ')).length,
    lines: configLines,
    readsBodyFile: configLines.some((line) => line.startsWith('data-binary = "@')),
    retryOverride: configLines.some((line) => line.startsWith('header = "cf-aig-max-attempts:')),
  }).toStrictEqual({
    cacheKeys: 1,
    lines: containingValues([
      'request = "POST"',
      "fail-with-body",
      "connect-timeout = 10",
      "max-time = 45",
      `header = "Authorization: Bearer ${API_KEY}"`,
      `header = "cf-aig-gateway-id: ${GATEWAY_ID}"`,
      'header = "Content-Type: application/json"',
      'header = "cf-aig-cache-ttl: 2592000"',
      'header = "cf-aig-skip-cache: false"',
      String.raw`write-out = "\n%{http_code}"`,
    ]),
    readsBodyFile: true,
    retryOverride: false,
  });
};

const fingerprintFixture = () => {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/cloudflare/clef-flash`;
  const body = {
    model: "clef-flash",
    // oxlint-disable-next-line eslint/sort-keys -- Exercise canonical cache equality with a different question insertion order.
    questions: {
      "q-000002": { criteria: { fail: "f", pass: "p" } },
      "q-000001": { criteria: { fail: "f", pass: "p" } },
    },
    // oxlint-disable-next-line eslint/sort-keys -- Exercise canonical cache equality with a different state insertion order.
    state: { b: 1, a: 2 },
  };
  return { apiKey: API_KEY, body, gatewayId: GATEWAY_ID, url };
};

/** @type {(base: ReturnType<typeof fingerprintFixture>) => Parameters<typeof cacheFingerprint>[0]} */
const equivalentFingerprintInput = (base) => ({
  ...base,
  body: {
    model: "clef-flash",
    questions: {
      // oxlint-disable-next-line eslint/sort-keys -- Exercise canonical cache equality with a different order inside equivalent criteria.
      "q-000001": { criteria: { pass: "p", fail: "f" } },
      // oxlint-disable-next-line eslint/sort-keys -- Exercise canonical cache equality with a different order inside equivalent criteria.
      "q-000002": { criteria: { pass: "p", fail: "f" } },
    },
    state: { a: 2, b: 1 },
  },
});

/** @type {(base: ReturnType<typeof fingerprintFixture>) => Record<string, Parameters<typeof cacheFingerprint>[0]>} */
const changedFingerprintInputs = (base) => {
  const { body } = base;
  return {
    accountUrl: { ...base, url: "https://example.test/run" },
    apiKey: { ...base, apiKey: "other-key" },
    criteria: {
      ...base,
      body: {
        ...body,
        questions: {
          ...body.questions,
          "q-000001": { criteria: { fail: "f", pass: "different" } },
        },
      },
    },
    gateway: { ...base, gatewayId: "other-gateway" },
    model: { ...base, body: { ...body, model: "clef" } },
    state: { ...base, body: { ...body, state: { a: 2, b: 3 } } },
  };
};

/** @type {(paths: FixturePaths) => Promise<{ intro: FixtureManifest["documents"][number], manifest: FixtureManifest }>} */
const cacheShiftFixture = async (paths) => {
  const manifest = await readFixtureManifest(paths.manifestPath);
  await writeFile(
    path.resolve(paths.directory, "intro.md"),
    "# Intro\n\nIntro text.\n\n## Sub\n\nMore.\n",
  );
  const intro = {
    audience: "A new user.",
    id: "intro",
    path: "intro.md",
    purpose: "Introduce.",
    ruleIds: ["direct", "flow"],
  };
  return { intro, manifest };
};

/** @type {(paths: FixturePaths, manifest: FixtureManifest, documents: FixtureManifest["documents"]) => Promise<{ calls: MockCall[], result: EvaluationReport }>} */
const evaluateFiles = async (paths, manifest, documents) => {
  await writeFile(paths.manifestPath, JSON.stringify({ ...manifest, documents }));
  return withMock(paths, {}, async () =>
    evaluate({ ...paths, concurrency: 1, environment: CREDENTIALS }),
  );
};

// oxlint-disable-next-line eslint/max-lines-per-function, eslint/max-statements -- Keep the existing public pipeline group and fixture cleanup for its transport and cache cases.
describe("documentation quality evaluator public pipeline", () => {
  afterEach(async () => {
    await cleanupFixtures();
  });

  test("segments heading units without splitting fenced code and retains hierarchy", () => {
    const sections = segmentMarkdown(
      "# Parent\n\n## Child\n\n````md\n~~~\n# Example only\n```\n~~~\n````\n\nText.\n",
    );
    expect(sections).toHaveLength(2);
    expect(sections[1]).toMatchObject({ headingPath: ["Parent", "Child"] });
    expect(sections[1].text).toContain("# Example only");
    expect(sections[0].sourceRange.endLine).toBe(2);
  });

  test("routes every allowed model to its documented endpoint and body shape", () => {
    expect(MODELS).toStrictEqual(["clef-flash", "clef", "typesafe/jev"]);
    const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run`;
    expect(MODELS.map((model) => endpointFor(model, ACCOUNT_ID))).toStrictEqual([
      `${base}/@cf/cloudflare/clef-flash`,
      `${base}/@cf/cloudflare/clef`,
      base,
    ]);
    const state = { evidence: {} };
    const questions = { q: { type: "choice" } };
    expect(payloadFor("clef", state, questions)).toStrictEqual({ model: "clef", questions, state });
    expect(payloadFor("typesafe/jev", state, questions)).toStrictEqual({
      input: { questions, state },
      model: "typesafe/jev",
    });
  });

  test("accepts the documented credential shape and rejects unsafe values", () => {
    expect(readCredentials(CREDENTIALS)).toStrictEqual({
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

  test("unwraps the native and universal response shapes and rejects failed jobs", () => {
    const questions = { "q-000001": { type: "choice" } };
    const answer = {
      choice: "pass",
      confidence: 0.94,
      probabilities: { fail: 0.03, insufficient_context: 0.01, not_applicable: 0, pass: 0.96 },
      type: "choice",
    };
    const native = (overrides = {}) => ({
      result: {
        answers: { "q-000001": answer },
        model: "clef-flash",
        usage: { inputTokens: 5 },
        ...overrides,
      },
      success: true,
    });
    const universal = (overrides = {}) => ({
      result: {
        result: { answers: { "q-000001": answer }, model: "jev-1.13.0", usage: { inputTokens: 5 } },
        state: "Completed",
        ...overrides,
      },
      success: true,
    });
    expect([
      validateResponse(native(), questions, "clef-flash"),
      validateResponse(universal(), questions, "typesafe/jev"),
    ]).toMatchObject([{ model: "clef-flash", usage: { inputTokens: 5 } }, { model: "jev-1.13.0" }]);
    expect(() =>
      validateResponse(universal({ state: "Failed" }), questions, "typesafe/jev"),
    ).toThrow("did not complete");
    expect(() =>
      validateResponse({ errors: [{ code: 402 }], success: false }, questions, "clef-flash"),
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

  test("accepts two-decimal probability rounding without accepting invalid distributions", () => {
    const questions = { "q-000001": { type: "choice" } };
    expect(() =>
      validateResponse(
        roundedResponse({ fail: 0.01, insufficient_context: 0, not_applicable: 0, pass: 0.99 }),
        questions,
        "clef-flash",
      ),
    ).not.toThrow();
    expect(() =>
      validateResponse(
        roundedResponse({ fail: 0.02, insufficient_context: 0, not_applicable: 0, pass: 0.99 }),
        questions,
        "clef-flash",
      ),
    ).not.toThrow();
    expect(() =>
      validateResponse(
        roundedResponse({ fail: 0, insufficient_context: 0, not_applicable: 0, pass: 0.8 }),
        questions,
        "clef-flash",
      ),
    ).toThrow("probabilities must sum to 1");
  });

  test("rejects non-finite confidence, probabilities, and thresholds", () => {
    expect.hasAssertions();
    const questions = { q: { type: "choice" } };
    const valid = {
      choice: "pass",
      confidence: 0.9,
      probabilities: { fail: 0.05, insufficient_context: 0.02, not_applicable: 0.03, pass: 0.9 },
      type: "choice",
    };
    Iterator.from([Number.NaN, Number.POSITIVE_INFINITY]).forEach((confidence) => {
      expect(() =>
        validateResponse(responseEnvelope({ ...valid, confidence }), questions, "clef-flash"),
      ).toThrow("invalid answer");
    });
    expect(() =>
      validateResponse(
        responseEnvelope({ ...valid, probabilities: { ...valid.probabilities, fail: Number.NaN } }),
        questions,
        "clef-flash",
      ),
    ).toThrow("invalid probability distribution");
    const rules = [{ fail: "f", id: "r", instructions: "i", pass: "p" }];
    const documents = [{ audience: "a", id: "d", path: "a.md", purpose: "p" }];
    expect(() =>
      validateManifest({ documents, model: "clef-flash", rules, threshold: Number.NaN }),
    ).toThrow("threshold");
    expect(() =>
      validateManifest({
        documents,
        model: "clef-flash",
        rules,
        threshold: Number.POSITIVE_INFINITY,
      }),
    ).toThrow("threshold");
    expect(() => validateManifest({ documents, model: "clef-flash", rules })).not.toThrow();
  });

  test("posts the native shape to the clef endpoint without leaking labels", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({
        concurrency: 2,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report).toMatchObject({ requestCount: 3, reviewRequired: false });
    expect(report.evaluations.at(-1)).toMatchObject({ model: "clef-flash", scope: "page" });

    assertClefRequests(calls);

    const cache = {
      key: matchingText(/^decision-v1-[0-9a-f]{64}$/u),
      ray: "mock-ray-0001",
      reused: false,
      status: "MISS",
    };
    expect({
      caches: report.evaluations.map((entry) => entry.cache),
      leakedApiKey: JSON.stringify(report).includes(API_KEY),
    }).toMatchObject({ caches: [cache, cache, cache], leakedApiKey: false });

    assertClefCurlConfig(calls[0].config);
  });

  test("posts the universal Jev shape to the shared run endpoint", async () => {
    const paths = await fixture({ model: "typesafe/jev" });
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report.reviewRequired).toBe(false);
    expect(report.evaluations.every((entry) => hasJevModel(entry))).toBe(true);
    const expectedRequest = {
      headers: containingValues([
        `Authorization: Bearer ${API_KEY}`,
        `cf-aig-gateway-id: ${GATEWAY_ID}`,
        "cf-aig-cache-ttl: 2592000",
        "cf-aig-skip-cache: false",
        matchingText(/^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/u),
      ]),
      inputKeys: ["state", "questions"],
      model: "typesafe/jev",
      payloadKeys: ["model", "input"],
      retryOverride: false,
      url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run`,
    };
    const requests = calls.map((call) => ({
      headers: call.headers,
      inputKeys: Object.keys(object(call.payload.input, "Jev request input")),
      model: call.payload.model,
      payloadKeys: Object.keys(call.payload),
      retryOverride: hasRetryOverride(call),
      url: call.url,
    }));
    expect(requests).toStrictEqual([expectedRequest, expectedRequest, expectedRequest]);
  });

  test.each(MODELS)("adds cache headers to every model request (%s)", async (model) => {
    expect.hasAssertions();
    const paths = await fixture({ model });
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(calls.length).toBeGreaterThan(0);
    Iterator.from(calls).forEach((call) => {
      expect(call.headers).toContain("cf-aig-cache-ttl: 2592000");
      expect(call.headers).toContain("cf-aig-skip-cache: false");
      expect(hasRetryOverride(call)).toBe(false);
      expect(
        call.headers.some((header) => /^cf-aig-cache-key: decision-v1-[0-9a-f]{64}$/u.test(header)),
      ).toBe(true);
    });
    expect(report.requestCount).toBe(calls.length);
  });

  test("does not retry transient failures and makes one client attempt per logical request", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(
      paths,
      { statusSequence: "503,200" },
      async () =>
        evaluate({
          concurrency: 1,
          environment: CREDENTIALS,
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
        }),
    );
    expect(report).toMatchObject({ attentionRequired: true, requestCount: 3 });
    // The evaluator makes no client-side retry and sends no retry override, so
    // The Gateway's configured retry policy is untouched rather than proven.
    expect({
      attempts: calls.length,
      distinctUrls: new Set(calls.map((call) => call.url)).size,
      retryOverrides: calls.filter((call) => hasRetryOverride(call)).length,
    }).toStrictEqual({ attempts: 3, distinctUrls: 1, retryOverrides: 0 });
    // The first logical request observes the mocked 503 once and is reported as
    // An error; the later distinct requests observe the mocked 200.
    expect(report.evaluations[0]).toMatchObject({
      answers: [],
      error: containingText("HTTP 503"),
      status: "error",
    });
    expect(report.evaluations.slice(1).every((entry) => entry.status === "complete")).toBe(true);
  });

  test.each([429, 500, 502, 503, 504])(
    "reports HTTP %i once without an automatic retry",
    async (status) => {
      const paths = await fixture();
      const { result: report, calls } = await withMock(
        paths,
        { statusSequence: String(status) },
        async () =>
          evaluate({
            concurrency: 1,
            environment: CREDENTIALS,
            manifestPath: paths.manifestPath,
            outputPath: paths.outputPath,
          }),
      );
      expect(report.requestCount).toBe(3);
      expect(calls).toHaveLength(3);
      expect(calls.filter((call) => hasRetryOverride(call))).toHaveLength(0);
      expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
      expect(evaluationFailure(report.evaluations[0])).toContain(`HTTP ${status}`);
    },
  );

  test("does not retry a curl transport timeout", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(
      paths,
      { exitCode: 28, statusSequence: "200" },
      async () =>
        evaluate({
          concurrency: 1,
          environment: CREDENTIALS,
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
        }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(calls.filter((call) => hasRetryOverride(call))).toHaveLength(0);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    const failure = text(evaluationFailure(report.evaluations[0]), "transport failure");
    expect(
      ["transport failed", "28"].filter((fragment) => !failure.includes(fragment)),
    ).toStrictEqual([]);
  });

  test.each([401, 402, 403])(
    "stops queued work without retrying or switching models on HTTP %i",
    async (status) => {
      const paths = await fixture();
      const { result: report, calls } = await withMock(
        paths,
        { statusSequence: String(status) },
        async () =>
          evaluate({
            concurrency: 1,
            environment: CREDENTIALS,
            manifestPath: paths.manifestPath,
            outputPath: paths.outputPath,
          }),
      );
      expect(report).toMatchObject({
        attentionRequired: true,
        requestCount: 1,
        reviewRequired: true,
      });
      expect(
        calls.map((call) => ({ retryOverride: hasRetryOverride(call), url: call.url })),
      ).toStrictEqual([{ retryOverride: false, url: containingText("@cf/cloudflare/clef-flash") }]);
      const error = containingText(`HTTP ${status}`);
      expect(report.evaluations).toMatchObject([
        { answers: [], error, status: "error" },
        { error, status: "skipped" },
        { error, status: "skipped" },
      ]);
      const written = await readEvaluationReport(paths.outputPath);
      expect({
        evaluationCount: written.evaluations.length,
        reviewRequired: written.reviewRequired,
      }).toStrictEqual({ evaluationCount: 3, reviewRequired: true });
    },
  );

  test("rejects a nonzero curl exit even when stdout carries a valid 200 response", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { exitCode: 28 }, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report).toMatchObject({ attentionRequired: true, requestCount: 3 });
    expect(calls).toHaveLength(3);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    const failure = text(evaluationFailure(report.evaluations[0]), "transport failure");
    expect(
      ["transport failed", "28"].filter((fragment) => !failure.includes(fragment)),
    ).toStrictEqual([]);
  });

  test("exits 1 through the public CLI for live evaluation failures", async () => {
    const paths = await fixture();
    const mock = await prepareMock(paths, { statusSequence: "402" });
    try {
      await expect(
        runEvaluationCli(
          ["--manifest", paths.manifestPath, "--output", paths.outputPath, "--concurrency", "1"],
          { env: { ...hostEnvironment(), ...CREDENTIALS } },
        ),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      mock.restore();
    }
    const report = await readEvaluationReport(paths.outputPath);
    expect(report).toMatchObject({
      attentionRequired: true,
      dryRun: false,
      requestCount: 1,
      reviewRequired: true,
    });
    expect(report.evaluations[0].status).toBe("error");
    expect(report.evaluations[1].status).toBe("skipped");
  });

  test("records a non-retryable bad status as an evaluation error", async () => {
    const paths = await fixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "400" }, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report.reviewRequired).toBe(true);
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(evaluationFailure(report.evaluations[0])).toContain("HTTP 400");
  });

  test("writes a review-required report when the response answers are malformed", async () => {
    const paths = await fixture();
    const { result: report } = await withMock(paths, { mode: "malformed" }, async () =>
      evaluate({
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report.reviewRequired).toBe(true);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    const written = await readEvaluationReport(paths.outputPath);
    expect(written.evaluations).toHaveLength(3);
  });

  test("rejects an unsuccessful request and an incomplete Jev job", async () => {
    const nativePaths = await fixture();
    const { result: nativeReport } = await withMock(
      nativePaths,
      { mode: "native-failed" },
      async () =>
        evaluate({
          environment: CREDENTIALS,
          manifestPath: nativePaths.manifestPath,
          outputPath: nativePaths.outputPath,
        }),
    );
    expect(nativeReport.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(evaluationFailure(nativeReport.evaluations[0])).toContain("unsuccessful");

    const jevPaths = await fixture({ model: "typesafe/jev" });
    const { result: jevReport } = await withMock(jevPaths, { mode: "wrapper-failed" }, async () =>
      evaluate({
        environment: CREDENTIALS,
        manifestPath: jevPaths.manifestPath,
        outputPath: jevPaths.outputPath,
      }),
    );
    expect(jevReport.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(evaluationFailure(jevReport.evaluations[0])).toContain("did not complete");
  });

  test("rejects unknown manifest models", async () => {
    const paths = await fixture({ model: "gpt-oss" });
    await expect(
      evaluate({
        dryRun: true,
        environment: {},
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    ).rejects.toThrow("manifest.model must be one of");
  });

  test("rejects unsafe credentials before any network call", async () => {
    expect.hasAssertions();
    const paths = await fixture();
    /** @type {[NodeJS.ProcessEnv, string][]} */
    const cases = [
      [{ ...CREDENTIALS, CLOUDFLARE_ACCOUNT_ID: "not-hex" }, "32 hexadecimal"],
      [{ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_API_KEY: "line\nbreak" }, "header-safe"],
      [{ ...CREDENTIALS, CLOUDFLARE_AI_GATEWAY_ID: "unsafe/id" }, "safe gateway slug"],
      [{}, "must be a non-empty string"],
    ];
    await Array.fromAsync(cases, async ([environment, message]) => {
      await expect(
        evaluate({ environment, manifestPath: paths.manifestPath, outputPath: paths.outputPath }),
      ).rejects.toThrow(message);
    });
  });

  test("performs zero network calls in dry-run mode", async () => {
    const paths = await fixture();
    const report = await evaluate({
      dryRun: true,
      environment: {},
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
    });
    expect(report).toMatchObject({ dryRun: true, requestCount: 0, reviewRequired: false });
    expect(report.evaluations.every((entry) => entry.status === "dry_run")).toBe(true);
  });

  test("resolves an exclusive rulesFile relative to the manifest", async () => {
    const paths = await fixture();
    const manifest = await readFixtureManifest(paths.manifestPath);
    await writeFile(path.resolve(paths.directory, "rules.json"), JSON.stringify(manifest.rules));
    delete manifest.rules;
    manifest.rulesFile = "rules.json";
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    const report = await evaluate({
      dryRun: true,
      environment: {},
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
    });
    expect(report.evaluations).toHaveLength(3);
  });

  test("derives explicit sections from source ranges and rejects an empty list", async () => {
    const paths = await fixture();
    const manifest = await readFixtureManifest(paths.manifestPath);
    manifest.documents[0].sections = [
      { endLine: 10, headingPath: ["Start", "Details"], id: "detail", startLine: 5 },
    ];
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    const report = await evaluate({
      dryRun: true,
      environment: {},
      manifestPath: paths.manifestPath,
      outputPath: paths.outputPath,
    });
    expect(report.evaluations[0].section).toMatchObject({
      id: "detail",
      sourceRange: { endLine: 10, startLine: 5 },
    });
    manifest.documents[0].sections = [];
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    await expect(
      evaluate({
        dryRun: true,
        environment: {},
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    ).rejects.toThrow("sections must not be empty");
  });

  test("derives a deterministic decision cache key that is sensitive to its inputs", () => {
    expect([
      canonicalJson({ 10: "a", 2: "b" }),
      // oxlint-disable-next-line eslint/sort-keys -- The canonical JSON contract must reorder these input fields recursively.
      canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] }),
      canonicalJson({ list: [2, 1] }),
    ]).toStrictEqual(['{"10":"a","2":"b"}', '{"a":[{"c":2,"d":1}],"b":1}', '{"list":[2,1]}']);

    const base = fingerprintFixture();
    const key = cacheFingerprint(base);
    expect({ key, leakedApiKey: key.includes(API_KEY) }).toStrictEqual({
      key: matchingText(/^decision-v1-[0-9a-f]{64}$/u),
      leakedApiKey: false,
    });
    // Canonical key ordering makes equivalent bodies fingerprint identically.
    expect(cacheFingerprint(equivalentFingerprintInput(base))).toBe(key);
    // Account route, gateway, token, model, state, criteria, and array order all matter.
    const changedInputs = changedFingerprintInputs(base);
    const unchangedInputs = Object.entries(changedInputs)
      .filter(([, input]) => cacheFingerprint(input) === key)
      .map(([name]) => name);
    expect(unchangedInputs).toStrictEqual([]);
    expect(
      cacheFingerprint({ ...base, body: { ...base.body, state: { a: 2, b: 1, list: [1, 2] } } }),
    ).not.toBe(
      cacheFingerprint({ ...base, body: { ...base.body, state: { a: 2, b: 1, list: [2, 1] } } }),
    );
  });

  test("parses the cf-aig-cache-status header without inventing a value", () => {
    expect(parseCacheStatus("HTTP/1.1 200 OK\r\ncf-aig-cache-status: HIT\r\n\r\n")).toBe("HIT");
    expect(parseCacheStatus("HTTP/1.1 200 OK\r\ncf-aig-cache-status: miss\r\n\r\n")).toBe("MISS");
    expect(
      parseCacheStatus("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n"),
    ).toBeNull();
  });

  test("shares one request across concurrent equivalent evaluations and maps distinct report IDs", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({
        concurrency: 4,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    // Two identical documents each contribute two section units and one page unit.
    // Mocked headers are recorded verbatim; this does not prove a real Gateway hit.
    expect({
      allComplete: report.evaluations.every((entry) => entry.status === "complete"),
      allMisses: report.evaluations.every((entry) => cacheOf(entry).status === "MISS"),
      attempts: calls.length,
      evaluationCount: report.evaluations.length,
      requestCount: report.requestCount,
      reused: report.evaluations.filter((entry) => cacheOf(entry).reused).length,
    }).toStrictEqual({
      allComplete: true,
      allMisses: true,
      attempts: 3,
      evaluationCount: 6,
      requestCount: 3,
      reused: 3,
    });
    assertAnswerIdentities(report);

    const sectionA = cachedEvaluationOf(report, {
      documentId: "guide-a",
      scope: "section",
      sectionId: "section-1",
    });
    const sectionB = cachedEvaluationOf(report, {
      documentId: "guide-b",
      scope: "section",
      sectionId: "section-1",
    });
    expect(sectionA.cache.key).toBe(sectionB.cache.key);
    expect([sectionA.cache.reused, sectionB.cache.reused]).toStrictEqual([false, true]);
    expect([sectionA.answers[0].questionId, sectionB.answers[0].questionId]).toStrictEqual([
      sectionA.questions[0].id,
      sectionB.questions[0].id,
    ]);
    expect(sectionA.questions[0].id).not.toBe(sectionB.questions[0].id);
  });

  test("reuses resolved promises for sequential duplicates without another request", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect(report.requestCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(
      report.evaluations.slice(0, 3).every((entry) => Object.is(cacheOf(entry).reused, false)),
    ).toBe(true);
    expect(
      report.evaluations.slice(3).every((entry) => Object.is(cacheOf(entry).reused, true)),
    ).toBe(true);
    assertAnswerIdentities(report);
    expect(new Set(report.evaluations.map((entry) => cacheOf(entry).key)).size).toBe(3);
  });

  test("shares failed outcomes for duplicates without a second attempt", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(paths, { statusSequence: "503" }, async () =>
      evaluate({
        concurrency: 4,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    expect([report.requestCount, calls.length, report.evaluations.length]).toStrictEqual([3, 3, 6]);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(report.evaluations.every((entry) => evaluationFailure(entry).includes("HTTP 503"))).toBe(
      true,
    );
    expect(report.evaluations.every((entry) => isEmptyArray(entry.answers))).toBe(true);
  });

  test("shares a cached malformed response once and preserves its cache evidence", async () => {
    const paths = await duplicateFixture();
    const { result: report, calls } = await withMock(
      paths,
      { cacheStatus: "MISS", mode: "malformed", ray: "mock-ray-4242" },
      async () =>
        evaluate({
          concurrency: 2,
          environment: CREDENTIALS,
          manifestPath: paths.manifestPath,
          outputPath: paths.outputPath,
        }),
    );
    expect([report.requestCount, calls.length, report.evaluations.length]).toStrictEqual([3, 3, 6]);
    expect(report.evaluations.every((entry) => entry.status === "error")).toBe(true);
    expect(new Set(report.evaluations.map((entry) => evaluationFailure(entry))).size).toBe(1);
    expect(report.evaluations.filter((entry) => cacheOf(entry).reused)).toHaveLength(3);
    // Validation failures keep the cache evidence from the actual response headers.
    expect(
      report.evaluations.map((entry) => {
        const { ray, status } = cacheOf(entry);
        return { ray, status };
      }),
    ).toStrictEqual(Array.from({ length: 6 }, () => ({ ray: "mock-ray-4242", status: "MISS" })));
  });

  test("keeps decision cache keys stable across runs independent of run-wide report IDs", async () => {
    const paths = await fixture();
    const { intro, manifest } = await cacheShiftFixture(paths);
    const { result: runA, calls: callsA } = await evaluateFiles(paths, manifest, [
      manifest.documents[0],
    ]);
    const { result: runB, calls: callsB } = await evaluateFiles(paths, manifest, [
      intro,
      manifest.documents[0],
    ]);

    const runBCalls = callsB.slice(callsA.length);
    expect([callsA.length, runBCalls.length]).toStrictEqual([3, 6]);
    const [guideA, guideB] = [runA, runB].map((report) =>
      cachedEvaluationOf(report, { documentId: "guide", scope: "section", sectionId: "section-1" }),
    );
    expect(guideA.cache.key).toBe(guideB.cache.key);
    // Report identities differ because the leading document shifts the run-wide counter.
    expect([guideA.questions[0].id, guideB.questions[0].id]).toStrictEqual([
      "q-000001",
      "q-000004",
    ]);
    // Request-local numbering keeps the transmitted payload identical.
    expect([
      Object.keys(object(callsA[0].payload.questions, "native request questions")),
      Object.keys(object(runBCalls[3].payload.questions, "native request questions")),
    ]).toStrictEqual([["q-000001"], ["q-000001"]]);
  });

  test("does not share cache entries for meaningful evidence changes", async () => {
    const evidencePaths = await duplicateFixture({ secondAudience: "An experienced operator." });
    const { result: evidenceReport, calls: evidenceCalls } = await withMock(
      evidencePaths,
      {},
      async () =>
        evaluate({
          concurrency: 4,
          environment: CREDENTIALS,
          manifestPath: evidencePaths.manifestPath,
          outputPath: evidencePaths.outputPath,
        }),
    );
    expect(evidenceCalls).toHaveLength(6);
    expect(evidenceReport.requestCount).toBe(6);
    expect(evidenceReport.evaluations.some((entry) => cacheOf(entry).reused)).toBe(false);
    expect(
      cachedEvaluationOf(evidenceReport, {
        documentId: "guide-a",
        scope: "section",
        sectionId: "section-1",
      }).cache.key,
    ).not.toBe(
      cachedEvaluationOf(evidenceReport, {
        documentId: "guide-b",
        scope: "section",
        sectionId: "section-1",
      }).cache.key,
    );
  });

  test("does not share cache entries for distinct section criteria", async () => {
    const criteriaPaths = await duplicateFixture({ secondRuleIds: ["strict", "flow"] });
    const { result: criteriaReport, calls: criteriaCalls } = await withMock(
      criteriaPaths,
      {},
      async () =>
        evaluate({
          concurrency: 4,
          environment: CREDENTIALS,
          manifestPath: criteriaPaths.manifestPath,
          outputPath: criteriaPaths.outputPath,
        }),
    );
    // Each document has two distinct section units plus one page unit. The
    // Section criteria differ between documents, so only the page request is
    // Shared: four section requests plus one page request.
    expect([criteriaCalls.length, criteriaReport.requestCount]).toStrictEqual([5, 5]);
    const sectionA = cachedEvaluationOf(criteriaReport, {
      documentId: "guide-a",
      scope: "section",
      sectionId: "section-1",
    });
    const sectionB = cachedEvaluationOf(criteriaReport, {
      documentId: "guide-b",
      scope: "section",
      sectionId: "section-1",
    });
    const pageA = cachedEvaluationOf(criteriaReport, { documentId: "guide-a", scope: "page" });
    const pageB = cachedEvaluationOf(criteriaReport, { documentId: "guide-b", scope: "page" });
    expect(sectionA.cache.key).not.toBe(sectionB.cache.key);
    expect(pageA.cache.key).toBe(pageB.cache.key);
    expect([pageA.cache.reused, pageB.cache.reused]).toStrictEqual([false, true]);
  });

  test("records the mocked cache status header without claiming a real hit", async () => {
    const paths = await fixture();
    const { result: report } = await withMock(paths, { cacheStatus: "HIT" }, async () =>
      evaluate({
        concurrency: 1,
        environment: CREDENTIALS,
        manifestPath: paths.manifestPath,
        outputPath: paths.outputPath,
      }),
    );
    // The evaluator records the response header value verbatim. The mock header
    // Is not evidence of a real AI Gateway cache hit.
    expect(report.evaluations.every((entry) => cacheOf(entry).status === "HIT")).toBe(true);
    expect(report.evaluations.every((entry) => Object.is(cacheOf(entry).reused, false))).toBe(true);
  });
});

/** @satisfies {Record<string, unknown> & { check: import("./mechanical.mjs").MechanicalCheck }} */
// oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
const fenceRule = {
  id: "fence-language",
  scope: "page",
  engine: "mechanical",
  check: { kind: "fenced-code-language" },
  source: { title: "Project supplement", url: "https://example.com/project-style" },
};
/** @satisfies {Record<string, unknown> & { check: import("./mechanical.mjs").MechanicalCheck }} */
// oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
const lexicalRule = {
  id: "project-terms",
  scope: "paragraph",
  engine: "mechanical",
  // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
  check: { kind: "prohibited-terms", terms: ["bad", "widget"], protectedTerms: ["widget"] },
};

/** @type {(options?: Record<string, unknown> & { markdown?: string, rules?: Record<string, unknown>[] }) => Promise<Awaited<ReturnType<typeof fixture>> & { manifest: import("./evaluation-test-fixtures.mjs").FixtureManifest, markdown: string }>} */
const localFixture = async function ({
  markdown = "# Setup\n\nUse the tool.\n\n```js\nrun();\n```\n",
  rules = [fenceRule],
  ...overrides
} = {}) {
  const paths = await fixture();
  const previous = await readFixtureManifest(paths.manifestPath);
  await writeFile(path.resolve(paths.directory, "guide.md"), markdown);
  const manifest = {
    documents: previous.documents.map(({ ruleIds: _ruleIds, ...document }) => document),
    rules,
    ...overrides,
  };
  await writeFile(paths.manifestPath, JSON.stringify(manifest));
  return { ...paths, manifest, markdown };
};

/**
 * Read the fields used by the universal Jev transport assertions.
 * @param {MockCall} call - A recorded universal Jev request.
 * @returns {{ document: Record<string, unknown>, evidence: Record<string, unknown>, markdown: string, questions: Record<string, unknown>, state: Record<string, unknown> }} The request evidence.
 */
const decodeJevInput = (call) => {
  const input = object(call.payload.input, "Jev request input");
  const state = object(input.state, "Jev request state");
  const evidence = object(state.evidence, "Jev request evidence");
  const page = object(evidence.page, "Jev page evidence");
  const questions = object(input.questions, "Jev request questions");
  return {
    document: object(evidence.document, "Jev document evidence"),
    evidence,
    markdown: text(page.markdown, "Jev page input"),
    questions,
    state,
  };
};

/** @type {(inputs: ReturnType<typeof decodeJevInput>[]) => void} */
const assertJevParagraphRequests = (inputs) => {
  const expectedRequest = {
    documentHasContext: false,
    evidenceKeys: ["document", "page", "local"],
    leakedMechanicalRules: [],
    missingInstructions: [],
  };
  expect(
    inputs.map(({ document, evidence, questions }) => {
      const serializedQuestions = JSON.stringify(questions);
      return {
        documentHasContext: "context" in document,
        evidenceKeys: Object.keys(evidence),
        leakedMechanicalRules: ["fenced-code-language", "prohibited-terms"].filter((rule) =>
          serializedQuestions.includes(rule),
        ),
        missingInstructions: Object.values(questions).flatMap((entry) => {
          const instructions = text(object(entry, "Jev question").instructions, "Jev instructions");
          return [
            "for this paragraph question",
            "unseen link destinations",
            "Do not require rewriting",
          ].filter((phrase) => !instructions.includes(phrase));
        }),
      };
    }),
  ).toStrictEqual([expectedRequest, expectedRequest, expectedRequest]);
};

/** @type {(inputs: ReturnType<typeof decodeJevInput>[]) => void} */
const assertJevPageIsolation = (inputs) => {
  const setupStates = inputs.filter((entry) => isSetup(entry));
  const setupEvidence = {
    leakedOtherPage: false,
    templateConstraints: ["Keep the headings in template order.", "Keep the summary table."],
  };
  expect(
    setupStates.map(({ document, state }) => ({
      leakedOtherPage: JSON.stringify(state).includes("Other-page-secret"),
      templateConstraints: document.templateConstraints,
    })),
  ).toStrictEqual(setupStates.map(() => setupEvidence));
  expect(
    inputs.filter((state) => !isSetup(state)).map(({ markdown }) => markdown.includes("run();")),
  ).not.toContain(true);
};

// oxlint-disable-next-line eslint/max-lines-per-function, eslint/max-statements -- Keep the existing local-only cases in their Vitest group with their shared cleanup hook.
describe("local mechanical and semantic engine boundaries", () => {
  afterEach(async () => {
    await cleanupFixtures();
  });

  test.each([
    {
      markdown:
        "- Example:\n\n    ```\n    const value=1;\n    ```\n\n```js\nconst valid=2;\n```\n",
      rule: fenceRule,
    },
    {
      markdown: "Good text.\n\n- A list item:\n\n    forbidden\n",
      // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
      rule: {
        ...lexicalRule,
        scope: "page",
        check: { kind: "prohibited-terms", terms: ["forbidden"] },
      },
    },
    {
      markdown: "1. Example:\n\n  ```\n  nested();\n  ```\n\n```js\nvalid();\n```\n",
      rule: fenceRule,
    },
  ])(
    "reports ambiguous indented list continuation through the public CLI instead of a false pass: %j",
    async ({ markdown, rule }) => {
      expect.hasAssertions();
      const paths = await localFixture({ markdown, rules: [rule] });
      const { result: report, calls } = await withMock(paths, {}, async () => {
        const environment = withoutCredentials();
        await expect(
          runEvaluationCli(
            ["--manifest", paths.manifestPath, "--output", paths.outputPath, "--mechanical-only"],
            { env: environment },
          ),
        ).rejects.toMatchObject({ code: 1 });
        return readEvaluationReport(paths.outputPath);
      });
      expect(calls).toStrictEqual([]);
      expect(report).toMatchObject({
        attentionRequired: true,
        failed: false,
        incomplete: true,
        requestCount: 0,
        reviewRequired: true,
      });
      expect(report.evaluations[0].answers[0]).toMatchObject({
        choice: "insufficient_context",
        findings: [],
        reviewRequired: true,
      });
      expect(
        mechanicalCoverage(report.evaluations[0].answers[0]).parserWarnings.some((warning) =>
          warning.reason.includes("Indented list continuation"),
        ),
      ).toBe(true);
    },
  );

  test("keeps list uncertainty local and evaluates independent later top-level sections normally", async () => {
    expect.hasAssertions();
    const markdown =
      "# Ambiguous\n\n- Example:\n\n    ```\n    forbidden();\n    ```\n\n# Independent\n\nClean prose.\n\n```js\nvalid();\n```\n";
    const paths = await localFixture({
      markdown,
      rules: [
        { ...fenceRule, scope: "section" },
        {
          ...lexicalRule,
          check: { kind: "prohibited-terms", terms: ["forbidden"] },
          scope: "section",
        },
      ],
    });
    const report = await evaluate({ ...paths, environment: {} });
    expect(
      report.evaluations.map((entry) => entry.answers.map((answer) => answer.choice)),
    ).toStrictEqual([
      ["insufficient_context", "insufficient_context"],
      ["pass", "pass"],
    ]);
    report.evaluations[1].answers.forEach((answer) => {
      expect(mechanicalCoverage(answer).parserWarnings).toStrictEqual([]);
    });
    expect(
      mechanicalCoverage(report.evaluations[0].answers[0]).parserWarnings[0].sourceRange,
    ).toMatchObject({
      endLine: 5,
      startLine: 5,
    });
  });

  test.each([
    // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
    { startLine: 5, endLine: 5 },
    // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
    { startLine: 6, endLine: 6 },
  ])(
    "rejects a partial paragraph range even when another complete target exists through the public CLI: %j",
    async (partial) => {
      const paths = await localFixture({
        documents: [
          {
            audience: "Reviewer.",
            id: "guide",
            path: "guide.md",
            purpose: "Read.",
            sections: [
              { endLine: 3, id: "complete", startLine: 3 },
              { id: "partial", ...partial },
            ],
          },
        ],
        markdown: "# Guide\n\nComplete paragraph.\n\nFirst part.\nSecond part.\n",
        rules: [
          {
            fail: "Bad.",
            id: "paragraph-check",
            instructions: "Judge the paragraph.",
            pass: "Good.",
            scope: "paragraph",
          },
        ],
      });
      const { result: error, calls } = await withMock(paths, {}, async () =>
        captureCliFailure([
          "--manifest",
          paths.manifestPath,
          "--output",
          paths.outputPath,
          "--mechanical-only",
        ]),
      );
      expect(error).toMatchObject({ code: 2 });
      expect(error.stderr).toContain("Section partial selects only part of a paragraph");
      expect(error.stderr).toContain("paragraph lines 5-6");
      expect(calls).toStrictEqual([]);
      await expect(readFile(paths.outputPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  test("preserves explicit partial prose ranges when only section checks are selected", async () => {
    const paths = await localFixture({
      documents: [
        {
          audience: "Reviewer.",
          id: "guide",
          path: "guide.md",
          purpose: "Read.",
          sections: [
            { endLine: 3, id: "complete", startLine: 3 },
            { endLine: 5, id: "partial", startLine: 5 },
          ],
        },
      ],
      markdown: "# Guide\n\nComplete paragraph.\n\nforbidden\nSecond part.\n",
      rules: [
        {
          ...lexicalRule,
          check: { kind: "prohibited-terms", terms: ["forbidden"] },
          scope: "section",
        },
      ],
    });
    const report = await evaluate({ ...paths, environment: {} });
    expect(report.evaluations.map((entry) => entry.answers[0].choice)).toStrictEqual([
      "pass",
      "fail",
    ]);
    expect(report.requestCount).toBe(0);
  });

  test("rejects legacy context through the public CLI before any request with a migration error", async () => {
    const paths = await localFixture({
      documents: [
        {
          audience: "New user.",
          context: "Evidence copied from another page.",
          id: "guide",
          path: "guide.md",
          purpose: "Teach setup.",
        },
      ],
    });
    const { result: error, calls } = await withMock(paths, {}, async () =>
      captureCliFailure([
        "--manifest",
        paths.manifestPath,
        "--output",
        paths.outputPath,
        "--mechanical-only",
      ]),
    );
    expect(error).toMatchObject({ code: 2 });
    expect(error.stderr).toContain("context is no longer supported");
    expect(error.stderr).toContain("purpose, audience, and templateConstraints");
    expect(calls).toStrictEqual([]);
  });

  test.each(["```js\ncode();\n", "~~~txt\ntext\n", "````js\ncode();\n```\n"])(
    "fails the public CLI for an unclosed labeled fence with zero API calls: %j",
    async (markdown) => {
      expect.hasAssertions();
      const paths = await localFixture({ markdown });
      const { result: report, calls } = await withMock(paths, {}, async () => {
        const environment = withoutCredentials();
        await expect(
          runEvaluationCli(
            ["--manifest", paths.manifestPath, "--output", paths.outputPath, "--mechanical-only"],
            { env: environment },
          ),
        ).rejects.toMatchObject({ code: 1 });
        return readEvaluationReport(paths.outputPath);
      });
      expect(calls).toStrictEqual([]);
      expect(report).toMatchObject({
        attentionRequired: true,
        failed: true,
        incomplete: false,
        requestCount: 0,
      });
      expect(report.evaluations[0].answers[0]).toMatchObject({
        choice: "fail",
        findings: [
          {
            defect: "unclosed-fence",
            sourceRange: { endByte: Buffer.byteLength(markdown), startByte: 0, startLine: 1 },
          },
        ],
      });
    },
  );

  test.each([
    [false, []],
    [true, ["--mechanical-only"]],
  ])(
    "runs the public CLI without credentials or curl for mechanical work (mechanical-only=%s)",
    async (_mechanicalOnly, cliFlags) => {
      const paths = await localFixture();
      const { result: report, calls } = await withMock(paths, {}, async () => {
        const environment = withoutCredentials();
        await runEvaluationCli(
          ["--manifest", paths.manifestPath, "--output", paths.outputPath, ...cliFlags],
          { env: environment },
        );
        return readEvaluationReport(paths.outputPath);
      });
      expect(calls).toStrictEqual([]);
      expect(report).toMatchObject({
        attentionRequired: false,
        failed: false,
        model: JSON_NULL,
        requestCount: 0,
        threshold: JSON_NULL,
      });
      expect(report.evaluations[0]).toMatchObject({
        answers: [{ choice: "pass", findings: [] }],
        engine: "mechanical",
        status: "complete",
      });
      expect(report.evaluations[0].questions[0].rule.source).toStrictEqual(fenceRule.source);
    },
  );

  test("keeps selected semantic work deferred and review-required through the mechanical-only CLI", async () => {
    expect.hasAssertions();
    const paths = await localFixture({
      rules: [
        fenceRule,
        {
          fail: "Indirect.",
          id: "semantic",
          instructions: "Evaluate directness.",
          pass: "Direct.",
          scope: "page",
        },
      ],
    });
    const { result: report, calls } = await withMock(paths, {}, async () => {
      const environment = withoutCredentials();
      await expect(
        runEvaluationCli(
          ["--manifest", paths.manifestPath, "--output", paths.outputPath, "--mechanical-only"],
          { env: environment },
        ),
      ).rejects.toMatchObject({ code: 1 });
      return readEvaluationReport(paths.outputPath);
    });
    expect(calls).toStrictEqual([]);
    expect(report).toMatchObject({
      attentionRequired: true,
      failed: false,
      incomplete: true,
      questionCount: 2,
      requestCount: 0,
      reviewRequired: true,
    });
    expect(report.evaluations.find((entry) => entry.engine === "decision")).toMatchObject({
      answers: [{ choice: "insufficient_context", deferred: true, reviewRequired: true }],
      status: "deferred",
    });
  });

  test("distinguishes mechanical failures from no applicable content, and preserves exact source ranges", async () => {
    const paths = await localFixture({
      markdown: "# Setup\n\n```\nbad();\n```\n",
      rules: [
        fenceRule,
        { ...lexicalRule, check: { kind: "prohibited-terms", terms: ["bad"] }, scope: "page" },
      ],
    });
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: {}, mechanicalOnly: true }),
    );
    expect(calls).toStrictEqual([]);
    expect(report.failed).toBe(true);
    const [fence, lexical] = report.evaluations[0].answers;
    expect(fence).toMatchObject({
      choice: "fail",
      findings: [{ sourceRange: { endByte: 12, endLine: 3, startByte: 9, startLine: 3 } }],
    });
    expect(lexical.choice).toBe("pass");
    const excludedOnly = "```js\nbad();\n```\n<div>bad</div>\n";
    const answer = runMechanical(
      lexicalRule.check,
      excludedOnly,
      sourceRange(excludedOnly, 0, excludedOnly.length),
    );
    expect({
      choice: answer.choice,
      claim: answer.coverage.claim,
      excludesContent: !isEmptyArray(answer.coverage.excluded),
    }).toStrictEqual({
      choice: "not_applicable",
      claim: containingText("not STE dictionary or full STE compliance"),
      excludesContent: true,
    });
  });

  test("sends only semantic criteria, retains template constraints, and isolates pages", async () => {
    expect.hasAssertions();
    const semantic = {
      fail: "Indirect.",
      id: "semantic",
      instructions: "Evaluate directness.",
      pass: "Direct.",
      scope: "paragraph",
    };
    const paths = await localFixture({
      documents: [
        {
          audience: "New user.",
          id: "a",
          path: "guide.md",
          purpose: "Teach setup.",
          templateConstraints: ["Keep the summary table."],
        },
        { audience: "New user.", id: "b", path: "other.md", purpose: "Teach setup." },
      ],
      model: "typesafe/jev",
      rules: [fenceRule, lexicalRule, semantic],
      templateConstraints: ["Keep the headings in template order."],
      threshold: 0.8,
    });
    await writeFile(path.resolve(paths.directory, "other.md"), "# Other\n\nOther-page-secret.\n");
    const { result: report, calls } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(report.evaluations.some((entry) => entry.engine === "mechanical")).toBe(true);
    const inputs = calls.map((call) => decodeJevInput(call));
    assertJevParagraphRequests(inputs);
    assertJevPageIsolation(inputs);
    assertAnswerIdentities(report);
  });

  test("marks semantic passes without a supplied threshold as uncalibrated review, not an approval", async () => {
    const paths = await localFixture({
      model: "clef",
      rules: [
        {
          fail: "Indirect.",
          id: "semantic",
          instructions: "Evaluate directness.",
          pass: "Direct.",
          scope: "page",
        },
      ],
    });
    const { result: report } = await withMock(paths, {}, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(report).toMatchObject({
      failed: false,
      reviewRequired: true,
      threshold: JSON_NULL,
      thresholdStatus: "uncalibrated",
    });
    expect(report.evaluations[0].answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: true,
    });
  });

  test("keeps semantic abstention distinct from transport errors and deterministic violations", async () => {
    const paths = await localFixture({
      markdown: "# Setup\n\n```\ncode();\n```\n",
      model: "clef",
      rules: [
        fenceRule,
        {
          fail: "Indirect.",
          id: "semantic",
          instructions: "Evaluate directness.",
          pass: "Direct.",
          scope: "page",
        },
      ],
      threshold: 0.8,
    });
    const { result: report } = await withMock(paths, { mode: "abstain" }, async () =>
      evaluate({ ...paths, environment: CREDENTIALS }),
    );
    expect(report).toMatchObject({ failed: true, incomplete: true, reviewRequired: true });
    expect(report.evaluations.find((entry) => entry.engine === "decision")).toMatchObject({
      answers: [{ choice: "insufficient_context", reviewRequired: true }],
      status: "complete",
    });
    expect(report.evaluations.find((entry) => entry.engine === "mechanical")).toMatchObject({
      answers: [{ choice: "fail" }],
      status: "complete",
    });
  });

  test("never substitutes another section's violations for its local target", async () => {
    const paths = await localFixture({
      markdown: "# First\n\nClean.\n\n# Second\n\nBad.\n",
      rules: [{ ...lexicalRule, scope: "section" }],
    });
    const report = await evaluate({ ...paths, environment: {} });
    expect(report.requestCount).toBe(0);
    expect(report.evaluations.map((entry) => entry.answers[0].choice)).toStrictEqual([
      "pass",
      "fail",
    ]);
    const [answer] = report.evaluations[1].answers;
    assert("findings" in answer, "The mechanical answer needs its findings.");
    expect(answer.findings[0].sourceRange.startLine).toBe(7);
  });

  test.each(["~~~\ncode\n~~~\n", "````\n```\ncode\n````\n", "```   \ncode\n"])(
    "recognizes unlabeled fences without splitting nested or unclosed delimiters: %j",
    (markdown) => {
      const answer = runMechanical(
        fenceRule.check,
        markdown,
        sourceRange(markdown, 0, markdown.length),
      );
      expect(answer.choice).toBe("fail");
      expect(answer.findings).toHaveLength(1);
    },
  );

  test("excludes explicitly marked translations without reading them or needing a model", async () => {
    const paths = await localFixture({
      documents: [
        {
          audience: "New user.",
          id: "en",
          path: "guide.md",
          purpose: "Teach setup.",
          ruleIds: [fenceRule.id],
          sourceLanguage: "en-US",
        },
        {
          audience: "Japanese reader.",
          id: "ja",
          path: "missing-translation.md",
          purpose: "Translation.",
          ruleIds: ["semantic"],
          sourceLanguage: "ja",
        },
      ],
      englishOnly: true,
      rules: [
        fenceRule,
        {
          fail: "Indirect.",
          id: "semantic",
          instructions: "Evaluate directness.",
          pass: "Direct.",
          scope: "page",
        },
      ],
    });
    const report = await evaluate({ ...paths, environment: {} });
    expect(report.requestCount).toBe(0);
    expect(report.evaluations.map((entry) => entry.documentId)).toStrictEqual(["en"]);
    expect(report.excludedDocuments).toMatchObject([{ documentId: "ja", sourceLanguage: "ja" }]);
    expect(() =>
      validateManifest({
        ...paths.manifest,
        documents: [{ ...paths.manifest.documents[0], sourceLanguage: undefined }],
      }),
    ).toThrow("sourceLanguage is required");
  });

  test.each(["document-set", "cross-page", "site"])("rejects nonlocal rule scope %s", (scope) => {
    expect(() =>
      validateManifest({
        documents: [{ audience: "a", id: "d", path: "d.md", purpose: "p" }],
        rules: [{ ...fenceRule, scope }],
      }),
    ).toThrow("scope must be section, page, or paragraph");
  });

  test.each([
    // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
    [{ kind: "shell", command: "echo bad" }, "unsupported mechanical kind"],
    [{ kind: "constructor" }, "unsupported mechanical kind"],
    [{ kind: "sentence-limit", limit: 20 }, "unsupported mechanical kind"],
    [{ kind: "fenced-code-language", terms: ["bad"] }, "unexpected parameter"],
    // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
    [{ kind: "prohibited-terms", terms: ["(a+)+"], regex: true }, "unexpected parameter"],
    [{ kind: "prohibited-terms", terms: [] }, "terms must contain"],
    [
      // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
      { kind: "prohibited-terms", terms: ["bad"], caseSensitive: "false" },
      "caseSensitive must be boolean",
    ],
    [
      // oxlint-disable-next-line eslint/sort-keys -- Vitest interpolates this fixture into the established case name using its key order.
      { kind: "prohibited-terms", terms: ["bad"], protectedTerms: ["two words"] },
      "protectedTerms must be",
    ],
  ])("rejects undeclared kinds and invalid exact check parameters: %j", (check, message) => {
    expect(() => validateMechanicalCheck(check, "check")).toThrow(message);
    expect(() =>
      validateManifest({
        documents: [{ audience: "a", id: "d", path: "d.md", purpose: "p" }],
        rules: [{ ...fenceRule, check }],
      }),
    ).toThrow(message);
  });

  test("bounds provenance and prevents mechanical criteria from entering the decision engine", () => {
    const base = {
      documents: [{ audience: "a", id: "d", path: "d.md", purpose: "p" }],
      rules: [fenceRule],
    };
    expect(() =>
      validateManifest({
        ...base,
        rules: [{ ...fenceRule, source: { data: "x".repeat(50_000) } }],
      }),
    ).toThrow("exceeds");
    expect(() =>
      validateManifest({ ...base, rules: [{ ...fenceRule, source: { value: () => "code" } }] }),
    ).toThrow("plain JSON");
    expect(() =>
      validateManifest({ ...base, rules: [{ ...fenceRule, engine: "decision" }] }),
    ).toThrow("requires the mechanical engine");
    expect(() =>
      validateManifest({ ...base, rules: [{ ...fenceRule, engine: "unknown" }] }),
    ).toThrow("engine must");
    expect(() => validateManifest({ ...base, templateConstraints: "rewrite all" })).toThrow(
      "templateConstraints",
    );
  });

  test("retains paragraph-local UTF-8 ranges, heading paths and intact code blocks", () => {
    expect.hasAssertions();
    const markdown =
      "---\n# Metadata only\n---\n# Setup {#setup}\n\nCafé bad.\nSecond line.\n\n````js\n# Not a heading\n```\n\ncode();\n````\n\n## Next {#next}\n\nFinal.\n";
    const sections = segmentMarkdown(markdown);
    expect(sections.map((section) => section.headingPath)).toStrictEqual([
      [],
      ["Setup"],
      ["Setup", "Next"],
    ]);
    const units = paragraphUnits(markdown, sections);
    expect(units.map((unit) => unit.text)).toStrictEqual([
      "Café bad.\nSecond line.\n",
      "````js\n# Not a heading\n```\n\ncode();\n````\n",
      "Final.\n",
    ]);
    Iterator.from(units).forEach((unit) => {
      expect(rangeText(markdown, unit.sourceRange)).toBe(unit.text);
      expect(unit.sourceRange.endLine).toBeGreaterThanOrEqual(unit.sourceRange.startLine);
    });
    const answer = runMechanical(lexicalRule.check, markdown, units[0].sourceRange);
    expect(answer.findings).toMatchObject([
      { sourceRange: { endLine: 6, startLine: 6 }, term: "bad" },
    ]);
    expect(rangeText(markdown, answer.findings[0].sourceRange)).toBe("bad");
  });

  test("uses only explicit whole-token project restrictions, honoring protected terms and excluded syntax", () => {
    expect.hasAssertions();
    const markdown =
      "---\nbad: bad\n---\n# Safe {#bad}\n\nBad badly widget `bad` ``bad ` bad`` [safe](https://example.com/bad) https://bad.example/path\n\n```txt\nbad\n```\n\n<span>bad</span>\n\n<!-- bad -->\n\n<script>\nbad\n</script>\n\n<div>\nbad\n\n    bad\n";
    const answer = runMechanical(
      lexicalRule.check,
      markdown,
      sourceRange(markdown, 0, markdown.length),
    );
    expect(answer.findings.map((finding) => finding.term)).toStrictEqual(["Bad"]);
    expect(answer.findings[0].basis).toBe("exact-project-restriction");
    const kinds = new Set(answer.coverage.excluded.map((entry) => entry.kind));
    Iterator.from([
      "frontmatter",
      "fenced-code",
      "inline-code",
      "html",
      "html-block",
      "url-or-markup",
      "indented-code",
    ]).forEach((kind) => {
      expect(kinds.has(kind)).toBe(true);
    });
    expect(
      runMechanical(
        { ...lexicalRule.check, caseSensitive: true },
        "Bad widget badly",
        sourceRange("Bad widget badly", 0, 16),
      ).findings,
    ).toStrictEqual([]);
  });

  test("reports semantic checks without paragraph targets as deferred rather than losing them", async () => {
    const paths = await localFixture({
      markdown: "# Empty\n",
      rules: [
        {
          fail: "Indirect.",
          id: "semantic",
          instructions: "Evaluate directness.",
          pass: "Direct.",
          scope: "paragraph",
        },
      ],
    });
    const report = await evaluate({ ...paths, environment: {}, mechanicalOnly: true });
    expect(report.questionCount).toBe(1);
    expect(report.evaluations[0]).toMatchObject({
      reason: "No paragraph target is available.",
      status: "deferred",
    });
  });

  test.each(["> ```\n> bad\n> ```\n", "- ```\n  bad\n  ```\n"])(
    "abstains conservatively on container fence syntax without lexical or language compliance claims: %j",
    (container) => {
      expect.assertions(4);
      const markdown = `Safe prose.\n\n\`\`\`js\ncode();\n\`\`\`\n\n${container}`;
      Iterator.from([lexicalRule.check, fenceRule.check]).forEach((check) => {
        const answer = runMechanical(check, markdown, sourceRange(markdown, 0, markdown.length));
        expect(answer).toMatchObject({
          choice: "insufficient_context",
          findings: [],
          reviewRequired: true,
        });
        expect(mechanicalCoverage(answer).parserWarnings).toHaveLength(1);
      });
    },
  );

  test("does not turn a missing paragraph into a pass over its heading", async () => {
    const paths = await localFixture({ markdown: "# Empty\n", rules: [lexicalRule] });
    const report = await evaluate({ ...paths, environment: {} });
    expect(report).toMatchObject({
      attentionRequired: true,
      failed: false,
      incomplete: true,
      requestCount: 0,
    });
    expect(report.evaluations[0].answers[0].choice).toBe("not_applicable");
  });
});
