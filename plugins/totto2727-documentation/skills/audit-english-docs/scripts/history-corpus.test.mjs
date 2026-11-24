// oxlint-disable-next-line rules/no-node-imports -- Test the distributed script as a native Node.js subprocess.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Create and inspect filesystem fixtures for the subprocess.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Place subprocess fixtures in the system temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve test fixture paths for the subprocess.
import { resolve } from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Find the distributed entry point relative to this test module.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await the native subprocess and preserve its exit status in these tests.
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

import { evaluate } from "./evaluate.mjs";
import { parseArguments, prepareCorpus, scoreCorpus, scoreReport } from "./history-corpus.mjs";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("history-corpus.mjs", import.meta.url));
const directories = [];
const revision = "a".repeat(40);

const temporaryDirectory = async function () {
  const directory = await mkdtemp(
    resolve(process.env.JCODE_SCRATCH_DIR ?? tmpdir(), "history-corpus-test-"),
  );
  directories.push(directory);
  return directory;
};

const sample = function (overrides = {}) {
  return {
    id: "historical-negative",
    documentId: "sample-0001",
    family: "guide-family",
    split: "calibration",
    revision,
    path: "guide.md",
    startLine: 3,
    endLine: 4,
    purpose: "Help the reader configure the tool.",
    audience: "A new user.",
    ruleIds: ["direct"],
    expected: { direct: "fail" },
    ruleScopes: { direct: "section" },
    ...overrides,
  };
};

const evaluation = function (overrides = {}) {
  return {
    documentId: "sample-0001",
    scope: "section",
    section: { id: "target", sourceRange: { startLine: 3, endLine: 4 } },
    questions: [{ id: "q-1", rule: { id: "direct", scope: "section" } }],
    answers: [{ questionId: "q-1", choice: "fail", confidence: 0.95, reviewRequired: true }],
    status: "complete",
    ...overrides,
  };
};

const score = function (entries, samples = [sample()]) {
  return scoreReport({ threshold: 0.8, evaluations: entries }, { version: 1, samples });
};

const repositoryFixture = async function () {
  const repository = await temporaryDirectory();
  const git = (...args) => execute("git", ["-C", repository, ...args]);
  await git("init", "--quiet");
  const page =
    "# Guide\n\n## Configure\nSet the configuration.\n\n## Reference\nFull-page context.\n";
  await writeFile(resolve(repository, "guide.md"), page);
  await git("add", "guide.md");
  await git(
    "-c",
    "user.name=totto2727-ai",
    "-c",
    "user.email=2000.0727.hayato+ai@gmail.com",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "-m",
    "Create test history",
  );
  const { stdout } = await git("rev-parse", "HEAD");
  const samples = [
    sample({ revision: stdout.trim() }),
    sample({
      id: "independent-positive",
      family: "independent-family",
      split: "holdout",
      revision: stdout.trim(),
      expected: { direct: "pass" },
    }),
  ];
  Iterator.from(samples).forEach((item) => {
    delete item.documentId;
  });
  const specPath = resolve(repository, "corpus.json");
  const rulesPath = resolve(repository, "rules.json");
  await writeFile(specPath, JSON.stringify(samples));
  await writeFile(
    rulesPath,
    JSON.stringify([
      {
        id: "direct",
        scope: "section",
        instructions: "Evaluate directness.",
        pass: "Direct.",
        fail: "Indirect.",
      },
    ]),
  );
  await writeFile(resolve(repository, "guide.md"), "Worktree content must not be used.\n");
  return {
    repository,
    page,
    samples,
    specPath,
    rulesPath,
    outputDir: resolve(repository, "prepared"),
  };
};

const cleanupFixtures = async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
};

describe("historical document preparation", () => {
  afterEach(cleanupFixtures);

  test("extracts pinned full pages, hides labels, preserves ranges, and feeds the evaluator", async () => {
    const fixture = await repositoryFixture();
    const { manifest, labels } = await prepareCorpus({ ...fixture, split: "calibration" });
    const { documents, model, rulesFile, threshold } = manifest;
    expect({ documents, model, rulesFile, threshold }).toStrictEqual({
      documents: [
        {
          id: "sample-0001",
          path: "sample-0001.md",
          purpose: fixture.samples[0].purpose,
          audience: fixture.samples[0].audience,
          ruleIds: ["direct"],
          sections: [{ id: "target", startLine: 3, endLine: 4, headingPath: [] }],
        },
      ],
      model: "typesafe/jev",
      rulesFile: fixture.rulesPath,
      threshold: 0.8,
    });
    await expect(readFile(resolve(fixture.outputDir, "sample-0001.md"), "utf8")).resolves.toBe(
      fixture.page,
    );
    expect(labels.samples[0]).toMatchObject({
      id: "historical-negative",
      documentId: "sample-0001",
      expected: { direct: "fail" },
      revision: fixture.samples[0].revision,
    });
    const report = await evaluate({
      manifestPath: resolve(fixture.outputDir, "manifest.json"),
      outputPath: resolve(fixture.outputDir, "dry-run.json"),
      dryRun: true,
      environment: {},
    });
    const [evaluation] = report.evaluations;
    const serialized = JSON.stringify(evaluation.state);
    expect({
      evaluationCount: report.evaluations.length,
      leakedLabels: ["historical-negative", fixture.samples[0].revision].filter((label) =>
        serialized.includes(label),
      ),
      markdown: evaluation.state.evidence.page.markdown,
      section: evaluation.section,
    }).toMatchObject({
      evaluationCount: 1,
      leakedLabels: [],
      markdown: fixture.page,
      section: { id: "target", sourceRange: { endLine: 4, startLine: 3 } },
    });
    const dryScore = scoreReport(report, labels);
    expect({
      coverage: dryScore.coverage,
      infrastructureErrors: dryScore.totals.infrastructureError,
      reason: dryScore.rows[0].reason,
    }).toMatchObject({
      coverage: { exact: true, expected: 1, matched: 1 },
      infrastructureErrors: 1,
      reason: "not_evaluated",
    });
  });

  test("keeps neutral IDs stable across split selection and refuses to overwrite outputs", async () => {
    const fixture = await repositoryFixture();
    const result = await prepareCorpus({ ...fixture, split: "holdout" });
    expect(result.manifest.documents.map((document) => document.id)).toStrictEqual(["sample-0002"]);
    await expect(prepareCorpus({ ...fixture, split: "holdout" })).rejects.toMatchObject({
      code: "EEXIST",
    });
  });

  test.each([
    ["unpinned revision", { revision: "HEAD" }, "full Git object ID"],
    ["out-of-range excerpt", { endLine: 500 }, "Source range exceeds page"],
    ["unknown rule", { ruleIds: ["missing"], expected: {} }, "Unknown rule"],
    ["unselected label", { expected: { other: "pass" } }, "selected rules"],
  ])("rejects %s before creating artifacts", async (_name, change, message) => {
    const fixture = await repositoryFixture();
    await writeFile(fixture.specPath, JSON.stringify([{ ...fixture.samples[0], ...change }]));
    await expect(prepareCorpus(fixture)).rejects.toThrow(message);
    await expect(readFile(resolve(fixture.outputDir, "manifest.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("rejects family leakage even when preparing only calibration", async () => {
    const fixture = await repositoryFixture();
    fixture.samples[1].family = fixture.samples[0].family;
    await writeFile(fixture.specPath, JSON.stringify(fixture.samples));
    await expect(prepareCorpus({ ...fixture, split: "calibration" })).rejects.toThrow(
      "Family crosses",
    );
  });

  test("runs the prepare CLI with explicit spec and rule paths", async () => {
    const fixture = await repositoryFixture();
    await execute(process.execPath, [
      script,
      "prepare",
      "--repository",
      fixture.repository,
      "--output-dir",
      fixture.outputDir,
      "--split",
      "all",
      "--spec",
      fixture.specPath,
      "--rules",
      fixture.rulesPath,
    ]);
    const manifest = JSON.parse(
      await readFile(resolve(fixture.outputDir, "manifest.json"), "utf8"),
    );
    expect(manifest.documents).toHaveLength(2);
  });
});

describe("historical judgment scoring", () => {
  afterEach(cleanupFixtures);

  test.each([
    ["fail", "fail", "truePositive"],
    ["pass", "pass", "trueNegative"],
    ["fail", "pass", "falseAcceptance"],
    ["pass", "fail", "falseRejection"],
  ])(
    "counts expected %s / predicted %s as %s without mistaking fail review for abstention",
    (expected, predicted, counter) => {
      const result = score(
        [
          evaluation({
            answers: [
              {
                questionId: "q-1",
                choice: predicted,
                confidence: 0.8,
                reviewRequired: predicted === "fail",
              },
            ],
          }),
        ],
        [sample({ expected: { direct: expected } })],
      );
      expect(result.coverage).toMatchObject({
        exact: true,
        expected: 1,
        exploratory: 0,
        labeled: 1,
      });
      expect(result.totals[counter]).toBe(1);
      expect(result.totals.abstention).toBe(0);
      expect(result.perRule.direct[counter]).toBe(1);
      expect(result.perFamily["guide-family"][counter]).toBe(1);
    },
  );

  test.each([
    ["not_applicable", 0.99],
    ["insufficient_context", 0.99],
    ["pass", 0.79],
    ["fail", 0.79],
  ])("keeps %s at confidence %s out of pass/fail statistics", (choice, confidence) => {
    const result = score([
      evaluation({ answers: [{ questionId: "q-1", choice, confidence, reviewRequired: true }] }),
    ]);
    expect(result.totals).toMatchObject({
      abstention: 1,
      falseAcceptance: 0,
      falseRejection: 0,
      total: 1,
      trueNegative: 0,
      truePositive: 0,
    });
  });

  test("reports every missing label rather than dropping absent evaluations", () => {
    const result = score([]);
    expect(result.coverage).toMatchObject({ exact: false, expected: 1, matched: 0, missing: 1 });
    expect(result.totals).toMatchObject({ infrastructureError: 1, missing: 1, total: 1 });
  });

  test.each([
    ["error", evaluation({ status: "error", answers: [] }), "evaluation_error"],
    ["dry run", evaluation({ status: "dry_run", answers: [] }), "not_evaluated"],
    ["missing answer", evaluation({ answers: [] }), "missing"],
    [
      "invalid confidence",
      evaluation({ answers: [{ questionId: "q-1", choice: "pass", confidence: 2 }] }),
      "malformed_answer",
    ],
    [
      "unknown choice",
      evaluation({ answers: [{ questionId: "q-1", choice: "maybe", confidence: 0.9 }] }),
      "malformed_answer",
    ],
  ])("records %s as infrastructure instead of model error", (_name, entry, reason) => {
    const result = score([entry]);
    expect(result.totals.infrastructureError).toBe(1);
    expect(result.rows[0].reason).toBe(reason);
    expect(result.totals.falseAcceptance).toBe(0);
  });

  test("detects duplicate evaluations, duplicate answers, and unexpected questions", () => {
    const duplicate = score([evaluation(), evaluation()]);
    expect(duplicate.coverage).toMatchObject({ duplicates: 1, exact: false });
    expect(duplicate.totals.infrastructureError).toBe(1);
    const entry = evaluation();
    entry.answers.push({ ...entry.answers[0] });
    expect(score([entry]).coverage).toMatchObject({ duplicates: 1, exact: false });
    expect(score([evaluation({ documentId: "unexpected" })]).coverage).toMatchObject({
      exact: false,
      missing: 1,
    });
    expect(score([evaluation({ scope: "page", section: null })]).coverage.exact).toBe(false);
  });

  test("rejects ambiguous question identities and mismatched source ranges", () => {
    const duplicateIds = evaluation({
      questions: [
        { id: "q-1", rule: { id: "direct" } },
        { id: "q-1", rule: { id: "flow" } },
      ],
    });
    const result = score([duplicateIds], [sample({ ruleIds: ["direct", "flow"] })]);
    expect(result.coverage).toMatchObject({ exact: false, expected: 2, missing: 2 });
    expect(result.totals.infrastructureError).toBe(2);
    const wrongRange = evaluation({
      section: { id: "target", sourceRange: { startLine: 1, endLine: 4 } },
    });
    expect(score([wrongRange]).coverage).toMatchObject({ exact: false, missing: 1 });
    const extraAnswer = evaluation();
    extraAnswer.answers.push({ questionId: "unknown", choice: "pass", confidence: 1 });
    expect(score([extraAnswer]).issues).toContainEqual({
      kind: "unexpected_answer",
      documentId: "sample-0001",
      questionId: "unknown",
    });
  });

  test("does not include exploratory judgments in the gold confusion matrix", () => {
    const item = sample({
      ruleIds: ["direct", "flow"],
      ruleScopes: { direct: "section", flow: "page" },
    });
    const entry = evaluation({
      scope: "page",
      section: null,
      questions: [{ id: "q-2", rule: { id: "flow" } }],
      answers: [{ questionId: "q-2", choice: "pass", confidence: 0.9, reviewRequired: false }],
    });
    const result = score([evaluation(), entry], [item]);
    expect(result.coverage).toMatchObject({ exact: true, expected: 2, exploratory: 1, labeled: 1 });
    expect(result.totals).toMatchObject({
      exploratory: 1,
      labeled: 1,
      total: 2,
      trueNegative: 0,
      truePositive: 1,
    });
    expect(result.rows[1].expected).toBeNull();
    expect(result.perRule.flow).toMatchObject({
      exploratory: 1,
      labeled: 0,
      predictedPass: 1,
      trueNegative: 0,
    });
  });

  test("writes incomplete coverage from the public CLI and exits nonzero", async () => {
    const directory = await temporaryDirectory();
    const reportPath = resolve(directory, "report.json");
    const labelsPath = resolve(directory, "labels.json");
    const outputPath = resolve(directory, "score.json");
    await writeFile(reportPath, JSON.stringify({ evaluations: [] }));
    await writeFile(labelsPath, JSON.stringify({ samples: [sample()] }));
    await expect(
      execute(process.execPath, [
        script,
        "score",
        "--report",
        reportPath,
        "--labels",
        labelsPath,
        "--output",
        outputPath,
      ]),
    ).rejects.toMatchObject({ code: 1 });
    expect(JSON.parse(await readFile(outputPath, "utf8")).coverage).toMatchObject({
      exact: false,
      missing: 1,
    });
    await expect(scoreCorpus({ reportPath, labelsPath, outputPath })).rejects.toMatchObject({
      code: "EEXIST",
    });
  });

  test("rejects unknown, duplicate, and incomplete command arguments", () => {
    expect(() => parseArguments([])).toThrow("prepare or score");
    expect(() => parseArguments(["score", "--output"])).toThrow("Missing value");
    expect(() => parseArguments(["prepare", "--random", "x"])).toThrow("Unknown argument");
    expect(() => parseArguments(["score", "--report", "x", "--report", "y"])).toThrow(
      "Duplicate argument",
    );
  });
});
