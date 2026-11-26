// oxlint-disable-next-line rules/no-node-imports -- Test the distributed history CLI and real Git objects with native subprocesses.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Own the isolated history, manifest and labels fixtures.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Use the host test directory when no explicit scratch directory is set.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the isolated fixture's local paths.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Locate the distributed history entry point relative to this module.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Preserve the native Promise-valued subprocess API.
import { promisify } from "node:util";
import { scoreReport } from "./history-corpus.mjs";

// oxlint-disable-next-line typescript/strict-void-return -- Node provides a native Promise overload for execFile.
const execute = promisify(execFile);
const script = fileURLToPath(new URL("history-corpus.mjs", import.meta.url));
/** @type {string[]} */
const directories = [];
const GIT_SHA1_LENGTH = 40;
const revision = "a".repeat(GIT_SHA1_LENGTH);
const FIRST = 0;

export const temporaryDirectory = async function () {
  // oxlint-disable-next-line node/no-process-env -- The CLI fixture uses the scratch directory selected by the test host.
  const scratch = process.env.JCODE_SCRATCH_DIR ?? tmpdir();
  const directory = await mkdtemp(path.resolve(scratch, "history-corpus-test-"));
  directories.push(directory);
  return directory;
};

/** @typedef {{ audience: string, documentId?: string, endLine: number, expected: Record<string, string>, family: string, id: string, path: string, purpose: string, revision: string, ruleIds: string[], ruleScopes: Record<string, string>, split: string, startLine: number }} SampleFixture */
/** @typedef {{ choice: string, confidence: number, questionId: string, reviewRequired?: boolean }} AnswerFixture */
/** @typedef {{ id: string, rule: { id: string, scope?: string } }} QuestionFixture */
/** @typedef {{ answers: AnswerFixture[], documentId: string, questions: QuestionFixture[], scope: string, section: { id: string, sourceRange: { endLine: number, startLine: number } } | null, status: string }} EvaluationFixture */

/** @type {(overrides?: Partial<SampleFixture>) => SampleFixture} */
export const sample = function (overrides = {}) {
  return {
    audience: "A new user.",
    documentId: "sample-0001",
    endLine: 4,
    expected: { direct: "fail" },
    family: "guide-family",
    id: "historical-negative",
    path: "guide.md",
    purpose: "Help the reader configure the tool.",
    revision,
    ruleIds: ["direct"],
    ruleScopes: { direct: "section" },
    split: "calibration",
    startLine: 3,
    ...overrides,
  };
};

/** @type {(overrides?: Partial<EvaluationFixture>) => EvaluationFixture} */
export const evaluation = function (overrides = {}) {
  return {
    answers: [{ choice: "fail", confidence: 0.95, questionId: "q-1", reviewRequired: true }],
    documentId: "sample-0001",
    questions: [{ id: "q-1", rule: { id: "direct", scope: "section" } }],
    scope: "section",
    section: { id: "target", sourceRange: { endLine: 4, startLine: 3 } },
    status: "complete",
    ...overrides,
  };
};

/** @type {(entries: EvaluationFixture[], samples?: SampleFixture[]) => ReturnType<typeof scoreReport>} */
export const score = function (entries, samples = [sample()]) {
  return scoreReport({ evaluations: entries, threshold: 0.8 }, { samples, version: 1 });
};

const page =
  "# Guide\n\n## Configure\nSet the configuration.\n\n## Reference\nFull-page context.\n";

/** @type {(repository: string) => Promise<string>} */
const pinPage = async (repository) => {
  /** @type {(...args: string[]) => Promise<{ stderr: string, stdout: string }>} */
  const git = async (...args) => execute("git", ["-C", repository, ...args]);
  await git("init", "--quiet");
  await writeFile(path.resolve(repository, "guide.md"), page);
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
  return stdout.trim();
};

/** @type {(revisionId: string) => SampleFixture[]} */
const selectedSamples = (revisionId) => {
  const samples = [
    sample({ revision: revisionId }),
    sample({
      expected: { direct: "pass" },
      family: "independent-family",
      id: "independent-positive",
      revision: revisionId,
      split: "holdout",
    }),
  ];
  Iterator.from(samples).forEach((item) => {
    delete item.documentId;
  });
  return samples;
};

/** @type {(repository: string, samples: SampleFixture[]) => Promise<{ rulesPath: string, specPath: string }>} */
const writeSpec = async (repository, samples) => {
  const specPath = path.resolve(repository, "corpus.json");
  const rulesPath = path.resolve(repository, "rules.json");
  await writeFile(specPath, JSON.stringify(samples));
  await writeFile(
    rulesPath,
    JSON.stringify([
      {
        fail: "Indirect.",
        id: "direct",
        instructions: "Evaluate directness.",
        pass: "Direct.",
        scope: "section",
      },
    ]),
  );
  return { rulesPath, specPath };
};

export const repositoryFixture = async function () {
  const repository = await temporaryDirectory();
  const samples = selectedSamples(await pinPage(repository));
  const { rulesPath, specPath } = await writeSpec(repository, samples);
  await writeFile(path.resolve(repository, "guide.md"), "Worktree content must not be used.\n");
  return {
    outputDir: path.resolve(repository, "prepared"),
    page,
    repository,
    rulesPath,
    samples,
    specPath,
  };
};

export const cleanupFixtures = async () => {
  await Promise.all(
    directories
      .splice(FIRST)
      .map(async (directory) => rm(directory, { force: true, recursive: true })),
  );
};

/** @type {(args: string[]) => Promise<Awaited<ReturnType<typeof execute>>>} */
export const runHistoryCli = async (args) => execute(process.execPath, [script, ...args]);
