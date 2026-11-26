#!/usr/bin/env node

// oxlint-disable-next-line rules/no-node-imports -- Run Git with the standalone corpus builder's native child process API.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Read and write corpus files from the standalone Node.js CLI.
import { mkdir, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve Git checkout paths without requiring packages in the target checkout.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Await the native Git child process without an additional runtime dependency.
import { promisify } from "node:util";
import {
  asArray,
  asRecord,
  corpusVersion,
  defaultThreshold,
  hasEntries,
  noEntries,
  nonempty,
  requireValue,
  validateSamples,
} from "./history-corpus-labels.mjs";
import { scoreReport } from "./history-corpus-score.mjs";
import { matchesString, matchesUndefined } from "./native-predicates.mjs";

export { scoreReport } from "./history-corpus-score.mjs";

/** @typedef {import("./history-corpus-labels.mjs").RuleScope} RuleScope */

// oxlint-disable-next-line typescript/strict-void-return -- Node's native execFile promisifier preserves the Git failure and its captured output.
const execute = promisify(execFile);
const defaultSpec = path.resolve(import.meta.dirname, "../references/history-corpus.json");
const defaultRules = path.resolve(import.meta.dirname, "../references/rules.json");
const firstSampleId = 1;
const sampleIdWidth = 4;
const gitOutputLimit = 16_777_216;
const jsonIndent = 2;
const optionPrefix = "--";
const optionFields = 2;
const optionValueOffset = 1;
const firstCliArgument = 2;
/** @typedef {{ outputDir: string, repository: string, rulesPath?: string, specPath?: string, split?: string }} PrepareOptions */
/** @typedef {{ labelsPath: string, outputPath: string, reportPath: string }} ScoreOptions */

/** @type {(rulesPath: string) => Promise<Map<string, RuleScope>>} */
const readRuleScopes = async (rulesPath) => {
  const rules = asArray(JSON.parse(await readFile(rulesPath, "utf8")));
  requireValue(!matchesUndefined(rules), "Rules must be an array");
  /** @type {Map<string, RuleScope>} */
  const scopes = new Map();
  rules.forEach((rawRule) => {
    const rule = asRecord(rawRule);
    const id = rule?.id;
    requireValue(nonempty(id) && !scopes.has(id), "Rules must have unique IDs");
    const scope = rule?.scope ?? "section";
    requireValue(scope === "section" || scope === "page", "Invalid rule scope");
    scopes.set(id, scope);
  });
  return scopes;
};

/** @typedef {import("./history-corpus-labels.mjs").CorpusSample} CorpusSample */
/** @typedef {{ endLine: number, headingPath: string[], id: string, startLine: number }} CorpusSection */
/** @typedef {{ audience: string, id: string, path: string, purpose: string, ruleIds: string[], sections: CorpusSection[] }} CorpusDocument */
/** @typedef {Record<string, unknown> & { documentId: string, ruleScopes: Record<string, RuleScope | undefined> }} CorpusLabel */
/** @typedef {{ documents: CorpusDocument[], model: string, rulesFile: string, threshold: number }} CorpusManifest */
/** @type {(samples: CorpusSample[], split: string) => { documentId: string, sample: CorpusSample }[]} */
const selectSamples = (samples, split) => {
  const selected = samples
    .map((sample, index) => ({
      documentId: `sample-${String(index + firstSampleId).padStart(sampleIdWidth, "0")}`,
      sample,
    }))
    .filter(({ sample }) => split === "all" || sample.split === split);
  requireValue(hasEntries(selected), "No samples selected");
  return selected;
};

/** @type {(sample: CorpusSample, repository: string, scopes: Map<string, RuleScope>) => Promise<string>} */
const loadPage = async (sample, repository, scopes) => {
  requireValue(
    sample.ruleIds.every((id) => scopes.has(id)),
    `Unknown rule in ${sample.id}`,
  );
  const { stdout: page } = await execute(
    "git",
    [
      "-C",
      path.resolve(repository),
      "show",
      "--no-ext-diff",
      "--no-textconv",
      `${sample.revision}:${sample.path}`,
    ],
    { encoding: "utf8", maxBuffer: gitOutputLimit },
  );
  requireValue(
    sample.endLine <= page.split(/(?<=\n)/u).length && nonempty(page),
    `Source range exceeds page: ${sample.id}`,
  );
  return page;
};

/**
 * @param {ReturnType<typeof selectSamples>} selected - Samples with stable document IDs.
 * @param {string} repository - The checkout containing the pinned file revisions.
 * @param {Map<string, RuleScope>} scopes - The rule scopes declared in the rule file.
 * @returns {Promise<{ documents: CorpusDocument[], labels: CorpusLabel[], pages: { page: string, path: string }[] }>} The documents, labels, and source pages in corpus order.
 */
const collectCorpusFiles = async (selected, repository, scopes) => {
  const documents = [];
  const labels = [];
  const pages = [];
  // oxlint-disable-next-line rules/no-for-loops -- Read one pinned Git sample at a time to preserve error order.
  for (const { sample, documentId } of selected) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Report the first source read error in corpus order.
    const page = await loadPage(sample, repository, scopes);
    const fileName = `${documentId}.md`;
    pages.push({ page, path: fileName });
    /* oxlint-disable eslint/sort-keys -- Preserve the document and section field order in the saved manifest. */
    documents.push({
      id: documentId,
      path: fileName,
      purpose: sample.purpose,
      audience: sample.audience,
      sections: [
        {
          id: "target",
          startLine: sample.startLine,
          endLine: sample.endLine,
          headingPath: sample.headingPath ?? [],
        },
      ],
      ruleIds: sample.ruleIds,
    });
    /* oxlint-enable eslint/sort-keys */
    labels.push({
      ...sample.original,
      documentId,
      ruleScopes: Object.fromEntries(sample.ruleIds.map((id) => [id, scopes.get(id)])),
    });
  }
  return { documents, labels, pages };
};

/** @type {(outputDir: string, files: { labelFile: object, manifest: object, pages: Awaited<ReturnType<typeof collectCorpusFiles>>["pages"] }) => Promise<void>} */
const writeCorpusFiles = async (outputDir, { labelFile, manifest, pages }) => {
  await mkdir(outputDir, { recursive: true });
  // oxlint-disable-next-line rules/no-for-loops -- Write pages in corpus order before the two index files.
  for (const { path: fileName, page } of pages) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve the first output error and the existing write order.
    await writeFile(path.resolve(outputDir, fileName), page, { flag: "wx" });
  }
  await writeFile(
    path.resolve(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, undefined, jsonIndent)}\n`,
    {
      flag: "wx",
    },
  );
  await writeFile(
    path.resolve(outputDir, "labels.json"),
    `${JSON.stringify(labelFile, undefined, jsonIndent)}\n`,
    {
      flag: "wx",
    },
  );
};

/**
 * @param {PrepareOptions} options - The pinned corpus inputs and output directory.
 * @returns {Promise<{ labels: { samples: CorpusLabel[], version: number }, manifest: CorpusManifest }>} The corpus manifest and sealed labels.
 */
export const prepareCorpus = async function ({
  repository,
  outputDir,
  split = "all",
  specPath = defaultSpec,
  rulesPath = defaultRules,
}) {
  requireValue(
    nonempty(repository) && nonempty(outputDir),
    "repository and outputDir are required",
  );
  requireValue(["calibration", "holdout", "all"].includes(split), "Invalid split");
  const samples = validateSamples(JSON.parse(await readFile(specPath, "utf8")));
  const scopes = await readRuleScopes(rulesPath);
  const selected = selectSamples(samples, split);
  const { documents, labels, pages } = await collectCorpusFiles(selected, repository, scopes);
  /* oxlint-disable eslint/sort-keys -- Preserve the field order of the prepared manifest and sealed labels. */
  const manifest = {
    rulesFile: path.resolve(rulesPath),
    model: "typesafe/jev",
    threshold: defaultThreshold,
    documents,
  };
  const labelFile = { version: corpusVersion, samples: labels };
  /* oxlint-enable eslint/sort-keys */
  await writeCorpusFiles(outputDir, { labelFile, manifest, pages });
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the native preparation result's field order.
  return { manifest, labels: labelFile };
};

/** @type {(options: ScoreOptions) => Promise<ReturnType<typeof scoreReport>>} */
export const scoreCorpus = async function ({ reportPath, labelsPath, outputPath }) {
  /** @type {unknown} */
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  /** @type {unknown} */
  const labels = JSON.parse(await readFile(labelsPath, "utf8"));
  const result = scoreReport(report, labels);
  await writeFile(outputPath, `${JSON.stringify(result, undefined, jsonIndent)}\n`, { flag: "wx" });
  return result;
};

/** @type {(state: { allowed: Set<string>, options: Record<string, string> }, flag: unknown, value: unknown) => void} */
const acceptOption = ({ allowed, options }, rawFlag, value) => {
  const flag = matchesString(rawFlag) ? rawFlag : "";
  const flagName = flag.slice(optionPrefix.length);
  requireValue(flag.startsWith(optionPrefix) && allowed.has(flagName), `Unknown argument: ${flag}`);
  requireValue(nonempty(value) && !value.startsWith(optionPrefix), `Missing value for ${flag}`);
  requireValue(matchesUndefined(options[flagName]), `Duplicate argument: ${flag}`);
  options[flagName] = value;
};

/**
 * @param {string[]} argv - User arguments after the native script path.
 * @returns {{ command: "prepare" | "score", options: Record<string, string> }} The selected command and its supplied options.
 */
export const parseArguments = function (argv) {
  const [command, ...argumentsList] = argv;
  requireValue(command === "prepare" || command === "score", "Expected prepare or score command");
  const allowed =
    command === "prepare"
      ? new Set(["repository", "output-dir", "split", "spec", "rules"])
      : new Set(["report", "labels", "output"]);
  /** @type {Record<string, string>} */
  const options = {};
  const optionState = { allowed, options };
  argumentsList.forEach((flag, index) => {
    if (index % optionFields === noEntries) {
      acceptOption(optionState, flag, argumentsList[index + optionValueOffset]);
    }
  });
  Iterator.from(
    command === "prepare" ? ["repository", "output-dir"] : ["report", "labels", "output"],
  ).forEach((required) => {
    requireValue(Boolean(options[required]), `--${required} is required`);
  });
  return { command, options };
};

const main = async function () {
  try {
    const { command, options } = parseArguments(process.argv.slice(firstCliArgument));
    if (command === "prepare") {
      await prepareCorpus({
        outputDir: options["output-dir"],
        repository: options.repository,
        rulesPath: options.rules,
        specPath: options.spec,
        split: options.split,
      });
    } else {
      const result = await scoreCorpus({
        labelsPath: options.labels,
        outputPath: options.output,
        reportPath: options.report,
      });
      if (!result.coverage.exact || result.totals.infrastructureError > noEntries) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    // oxlint-disable-next-line rules/no-instanceof-error, rules/no-error-property-access -- Keep the installed CLI's native Error message and its fallback for thrown values.
    const message = error instanceof Error ? error.message : "History corpus operation failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
