// oxlint-disable-next-line rules/no-node-imports -- Run the distributed evaluator as a native Node subprocess.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Give each subprocess an independent directory and report.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Place the native CLI fixture in the system temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the subprocess fixture paths before execution.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the distributed entry point from this test fixture.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Use Node's native Promise overload for the child process.
import { promisify } from "node:util";
import { assert } from "vitest";
import { readEvaluationReport } from "./evaluation-test-support.mjs";
import { object } from "./evaluation-validation.mjs";
import {
  isEmptyString,
  matchesNumber,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

/** @typedef {{ check?: Record<string, unknown>, dryRun?: boolean, mechanicalOnly?: boolean, model?: string, rules?: unknown[], scope?: string, sections?: unknown[], ste?: Record<string, unknown>, vocabulary?: object }} CliOptions */
/** @typedef {import("./evaluation-test-support.mjs").EvaluationReport} EvaluationReport */
/** @typedef {EvaluationReport["evaluations"][number]["answers"][number]} EvaluationAnswer */
/** @typedef {{ answers?: EvaluationAnswer[], exitCode: number, report?: EvaluationReport, stderr?: string }} CliResult */
/** @typedef {{ exitCode: number, stderr: string }} Exit */
/** @typedef {{ manifest: string, report: string }} CliFiles */

// oxlint-disable-next-line typescript/strict-void-return -- Node deliberately supports promisify(execFile) with a native custom Promise overload.
const execute = promisify(execFile);
const script = fileURLToPath(new URL("evaluate.mjs", import.meta.url));
/** @type {string[]} */
const directories = [];
const CLI_OK = 0;
const CLI_INVALID = 2;
const FIRST = 0;
const DEFAULT_OPTIONS = {};

/** @type {(mode?: string) => { kind: string, writingMode: string }} */
export const checkFor = (mode = "procedural") => ({
  kind: "ste-sentence-length",
  writingMode: mode,
});

/** @type {(options: CliOptions) => object} */
const fixtureManifest = ({
  check = checkFor(),
  model,
  rules,
  scope = "page",
  sections,
  ste = { writingMode: "procedural" },
}) => ({
  documents: [
    {
      audience: "Technician.",
      id: "guide",
      path: "guide.md",
      purpose: "Original test example.",
      sourceLanguage: "en",
      ste,
      ...(sections ? { sections } : {}),
    },
  ],
  ...(matchesUndefined(model) || isEmptyString(model) ? {} : { model }),
  rules: rules ?? [{ check, engine: "mechanical", id: "ste", scope }],
});

/** @type {(markdown: string, options: CliOptions) => Promise<CliFiles>} */
const writeFixture = async (markdown, options) => {
  const directory = await mkdtemp(path.resolve(tmpdir(), "ste-public-cli-"));
  directories.push(directory);
  await writeFile(path.resolve(directory, "guide.md"), markdown);
  if (options.vocabulary) {
    await writeFile(path.resolve(directory, "vocabulary.json"), JSON.stringify(options.vocabulary));
  }
  const manifest = path.resolve(directory, "manifest.json");
  const report = path.resolve(directory, "report.json");
  await writeFile(manifest, JSON.stringify(fixtureManifest(options)));
  return { manifest, report };
};

/** @type {(files: CliFiles, options: CliOptions) => Promise<Exit>} */
const invokeCli = async ({ manifest, report }, { dryRun = false, mechanicalOnly = true }) => {
  try {
    await execute(
      process.execPath,
      [
        script,
        "--manifest",
        manifest,
        "--output",
        report,
        ...(mechanicalOnly ? ["--mechanical-only"] : []),
        ...(dryRun ? ["--dry-run"] : []),
      ],
      // oxlint-disable-next-line node/no-process-env -- Pass only the parent's PATH to the credential-free CLI.
      { env: { PATH: process.env.PATH } },
    );
    return { exitCode: CLI_OK, stderr: "" };
  } catch (error) {
    const { code, stderr } = object(error, "native CLI failure");
    assert(matchesNumber(code), "CLI must report a numeric exit code.");
    assert(matchesString(stderr), "CLI must return stderr as text.");
    return { exitCode: code, stderr };
  }
};

/** @type {(markdown: string, options?: CliOptions) => Promise<CliResult>} */
export const runSteCli = async (markdown, options = DEFAULT_OPTIONS) => {
  const files = await writeFixture(markdown, options);
  const { exitCode, stderr } = await invokeCli(files, options);
  if (exitCode === CLI_INVALID) {
    return { exitCode, stderr };
  }
  const report = await readEvaluationReport(files.report);
  const answers = report.evaluations.flatMap(
    /**
     * @param {EvaluationReport["evaluations"][number]} entry - A CLI evaluation.
     * @returns {EvaluationAnswer[]} The answers in report order.
     */
    (entry) => entry.answers,
  );
  return { answers, exitCode, report };
};

export const cleanupFixtures = async () => {
  await Promise.all(
    directories
      .splice(FIRST)
      .map(async (directory) => rm(directory, { force: true, recursive: true })),
  );
};
