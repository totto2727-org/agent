/* oxlint-disable eslint/max-lines -- Keep both existing history test groups discoverable from one Vitest entry file. */
// oxlint-disable-next-line rules/no-node-imports -- Inspect the history CLI's filesystem artifacts.
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Inspect the history CLI artifacts at their native locations.
import path from "node:path";
import { afterEach, assert, describe, expect, test } from "vitest";
import { evaluate } from "./evaluate.mjs";
import { object } from "./evaluation-validation.mjs";
import {
  cleanupFixtures,
  evaluation,
  repositoryFixture,
  runHistoryCli,
  sample,
  score,
  temporaryDirectory,
} from "./history-corpus-fixture.mjs";
import { parseArguments, prepareCorpus, scoreCorpus, scoreReport } from "./history-corpus.mjs";
import { matchesUndefined } from "./native-predicates.mjs";

// oxlint-disable-next-line unicorn/no-null -- A page-scoped report has JSON null in its section field.
const PAGE_SECTION = null;

/** @type {(fixture: Awaited<ReturnType<typeof repositoryFixture>>) => object} */
const expectedManifest = (fixture) => ({
  documents: [
    {
      audience: fixture.samples[0].audience,
      id: "sample-0001",
      path: "sample-0001.md",
      purpose: fixture.samples[0].purpose,
      ruleIds: ["direct"],
      sections: [{ endLine: 4, headingPath: [], id: "target", startLine: 3 }],
    },
  ],
  model: "typesafe/jev",
  rulesFile: fixture.rulesPath,
  threshold: 0.8,
});

/** @type {(report: Awaited<ReturnType<typeof evaluate>>, revision: string) => object} */
const dryRunState = (report, revision) => {
  const [entry] = report.evaluations;
  assert(!matchesUndefined(entry), "Dry-run report needs its evaluation.");
  assert("state" in entry, "Dry-run evaluation needs its state.");
  const serialized = JSON.stringify(entry.state);
  return {
    evaluationCount: report.evaluations.length,
    leakedLabels: ["historical-negative", revision].filter((label) => serialized.includes(label)),
    markdown: entry.state.evidence.page.markdown,
    section: entry.section,
  };
};

// oxlint-disable-next-line eslint/max-lines-per-function -- The real Git preparation cases share this Vitest group name and cleanup hook.
describe("historical document preparation", () => {
  afterEach(async () => {
    await cleanupFixtures();
  });

  test("extracts pinned full pages, hides labels, preserves ranges, and feeds the evaluator", async () => {
    const fixture = await repositoryFixture();
    const { manifest, labels } = await prepareCorpus({ ...fixture, split: "calibration" });
    const { documents, model, rulesFile, threshold } = manifest;
    expect({ documents, model, rulesFile, threshold }).toStrictEqual(expectedManifest(fixture));
    await expect(readFile(path.resolve(fixture.outputDir, "sample-0001.md"), "utf8")).resolves.toBe(
      fixture.page,
    );
    expect(labels.samples[0]).toMatchObject({
      documentId: "sample-0001",
      expected: { direct: "fail" },
      id: "historical-negative",
      revision: fixture.samples[0].revision,
    });
    const report = await evaluate({
      dryRun: true,
      environment: {},
      manifestPath: path.resolve(fixture.outputDir, "manifest.json"),
      outputPath: path.resolve(fixture.outputDir, "dry-run.json"),
    });
    expect(dryRunState(report, fixture.samples[0].revision)).toMatchObject({
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
    ["unknown rule", { expected: {}, ruleIds: ["missing"] }, "Unknown rule"],
    ["unselected label", { expected: { other: "pass" } }, "selected rules"],
  ])("rejects %s before creating artifacts", async (_name, change, message) => {
    const fixture = await repositoryFixture();
    await writeFile(fixture.specPath, JSON.stringify([{ ...fixture.samples[0], ...change }]));
    await expect(prepareCorpus(fixture)).rejects.toThrow(message);
    await expect(readFile(path.resolve(fixture.outputDir, "manifest.json"))).rejects.toMatchObject({
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
    await runHistoryCli([
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
    const manifestText = await readFile(path.resolve(fixture.outputDir, "manifest.json"), "utf8");
    const manifest = object(JSON.parse(manifestText), "prepared manifest");
    expect(manifest.documents).toHaveLength(2);
  });
});

/** @type {[string, string, keyof ReturnType<typeof score>["totals"]][]} */
const confusionCases = [
  ["fail", "fail", "truePositive"],
  ["pass", "pass", "trueNegative"],
  ["fail", "pass", "falseAcceptance"],
  ["pass", "fail", "falseRejection"],
];

// oxlint-disable-next-line eslint/max-lines-per-function -- Keep the current scoring cases under their Vitest group name and cleanup hook.
describe("historical judgment scoring", () => {
  afterEach(async () => {
    await cleanupFixtures();
  });

  test.each(confusionCases)(
    "counts expected %s / predicted %s as %s without mistaking fail review for abstention",
    (expected, predicted, counter) => {
      const result = score(
        [
          evaluation({
            answers: [
              {
                choice: predicted,
                confidence: 0.8,
                questionId: "q-1",
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
      evaluation({ answers: [{ choice, confidence, questionId: "q-1", reviewRequired: true }] }),
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
    ["error", evaluation({ answers: [], status: "error" }), "evaluation_error"],
    ["dry run", evaluation({ answers: [], status: "dry_run" }), "not_evaluated"],
    ["missing answer", evaluation({ answers: [] }), "missing"],
    [
      "invalid confidence",
      evaluation({ answers: [{ choice: "pass", confidence: 2, questionId: "q-1" }] }),
      "malformed_answer",
    ],
    [
      "unknown choice",
      evaluation({ answers: [{ choice: "maybe", confidence: 0.9, questionId: "q-1" }] }),
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
    expect(score([evaluation({ scope: "page", section: PAGE_SECTION })]).coverage.exact).toBe(
      false,
    );
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
      section: { id: "target", sourceRange: { endLine: 4, startLine: 1 } },
    });
    expect(score([wrongRange]).coverage).toMatchObject({ exact: false, missing: 1 });
    const extraAnswer = evaluation();
    extraAnswer.answers.push({ choice: "pass", confidence: 1, questionId: "unknown" });
    expect(score([extraAnswer]).issues).toContainEqual({
      documentId: "sample-0001",
      kind: "unexpected_answer",
      questionId: "unknown",
    });
  });

  test("does not include exploratory judgments in the gold confusion matrix", () => {
    const item = sample({
      ruleIds: ["direct", "flow"],
      ruleScopes: { direct: "section", flow: "page" },
    });
    const entry = evaluation({
      answers: [{ choice: "pass", confidence: 0.9, questionId: "q-2", reviewRequired: false }],
      questions: [{ id: "q-2", rule: { id: "flow" } }],
      scope: "page",
      section: PAGE_SECTION,
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
    const reportPath = path.resolve(directory, "report.json");
    const labelsPath = path.resolve(directory, "labels.json");
    const outputPath = path.resolve(directory, "score.json");
    await writeFile(reportPath, JSON.stringify({ evaluations: [] }));
    await writeFile(labelsPath, JSON.stringify({ samples: [sample()] }));
    await expect(
      runHistoryCli([
        "score",
        "--report",
        reportPath,
        "--labels",
        labelsPath,
        "--output",
        outputPath,
      ]),
    ).rejects.toMatchObject({ code: 1 });
    const scored = object(JSON.parse(await readFile(outputPath, "utf8")), "CLI score");
    expect(scored.coverage).toMatchObject({
      exact: false,
      missing: 1,
    });
    await expect(scoreCorpus({ labelsPath, outputPath, reportPath })).rejects.toMatchObject({
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
