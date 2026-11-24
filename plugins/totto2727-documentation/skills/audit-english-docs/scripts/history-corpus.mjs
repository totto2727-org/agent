#!/usr/bin/env node

// oxlint-disable-next-line rules/no-node-imports -- Run Git with the standalone corpus builder's native child process API.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Read and write corpus files from the standalone Node.js CLI.
import { mkdir, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve Git checkout paths without requiring packages in the target checkout.
import { dirname, isAbsolute, resolve } from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Locate the corpus builder's resources relative to the installed script.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await the native Git child process without an additional runtime dependency.
import { promisify } from "node:util";
import {
  hasObjectType,
  matchesNull,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

const execute = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultSpec = resolve(scriptDirectory, "../references/history-corpus.json");
const defaultRules = resolve(scriptDirectory, "../references/rules.json");
const choices = new Set(["pass", "fail", "not_applicable", "insufficient_context"]);

/** @typedef {{ outputDir: string, repository: string, rulesPath?: string, specPath?: string, split?: string }} PrepareOptions */
/** @typedef {{ labelsPath: string, outputPath: string, reportPath: string }} ScoreOptions */

/** @type {(condition: unknown, message: string) => asserts condition} */
const requireValue = function (condition, message) {
  if (!condition) {
    throw new Error(message);
  }
};

/** @type {(value: unknown) => value is string} */
const nonempty = function (value) {
  return matchesString(value) && value.trim().length > 0;
};

/** @param {unknown} value - The candidate JSON record. */
const record = function (value) {
  return !matchesNull(value) && hasObjectType(value) && !Array.isArray(value);
};

/** @type {(value: unknown) => Record<string, unknown> | undefined} */
const asRecord = (value) => record(value) ? /** @type {Record<string, unknown>} */ (value) : undefined;

/** @type {(value: unknown) => unknown[] | undefined} */
const asArray = (value) => Array.isArray(value) ? value : undefined;

/** @type {(fields: Record<string, unknown>, key: string) => string} */
const readField = (fields, key) => {
  const value = fields[key];
  requireValue(nonempty(value), `Sample ${key} must be non-empty`);
  return value;
};

/** @typedef {"calibration" | "holdout"} CorpusSplit */
/** @typedef {"section" | "page"} RuleScope */
/** @typedef {{ ids: Set<string>, families: Map<string, CorpusSplit> }} CorpusGroups */

/**
 * @param {Record<string, unknown>} sample - One corpus entry.
 * @param {CorpusGroups} groups - IDs and families from preceding entries.
 * @returns {{ audience: string, family: string, id: string, path: string, purpose: string, split: CorpusSplit }} The validated sample identity.
 */
const readIdentity = (sample, { ids, families }) => {
  const id = readField(sample, "id");
  const family = readField(sample, "family");
  const purpose = readField(sample, "purpose");
  const audience = readField(sample, "audience");
  const path = readField(sample, "path");
  requireValue(!ids.has(id), `Duplicate sample id: ${id}`);
  ids.add(id);
  const { split } = sample;
  requireValue(split === "calibration" || split === "holdout", "Invalid sample split");
  requireValue(!families.has(family) || families.get(family) === split, `Family crosses calibration and holdout: ${family}`);
  families.set(family, split);
  return { audience, family, id, path, purpose, split };
};

/** @type {(value: Record<string, unknown>, path: string) => { endLine: number, revision: string, startLine: number }} */
const readSource = (value, path) => {
  const { revision } = value;
  requireValue(
    matchesString(revision) && /^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(revision),
    "Each revision must be a full Git object ID",
  );
  requireValue(
    !isAbsolute(path) && !path.includes("\0") && !path.split("/").some((part) => part === ".." || part === ""),
    "Sample path must be repository-relative without traversal",
  );
  const startLine = Number.isInteger(value.startLine) ? Number(value.startLine) : Number.NaN;
  const endLine = Number.isInteger(value.endLine) ? Number(value.endLine) : Number.NaN;
  requireValue(startLine > 0 && endLine >= startLine, "Invalid source line range");
  return { endLine, revision, startLine };
};

/**
 * @param {Record<string, unknown>} sample - A corpus identity and source range.
 * @returns {{ expected: Record<string, unknown>, headingPath: string[] | undefined, ruleIds: string[] }} The validated label selection.
 */
const readLabels = (sample) => {
  const ruleIds = asArray(sample.ruleIds);
  requireValue(
    !matchesUndefined(ruleIds) && ruleIds.length > 0 && ruleIds.every(nonempty) &&
      new Set(ruleIds).size === ruleIds.length,
    "Sample ruleIds must be unique non-empty strings",
  );
  const expected = asRecord(sample.expected);
  requireValue(
    !matchesUndefined(expected) && Object.entries(expected).every(
      ([ruleId, label]) => ruleIds.includes(ruleId) && (label === "pass" || label === "fail"),
    ),
    "Expected labels must map selected rules to pass or fail",
  );
  const rawHeading = sample.headingPath;
  const headingPath = asArray(rawHeading);
  if (!matchesUndefined(rawHeading)) {
    requireValue(!matchesUndefined(headingPath) && headingPath.every(nonempty), "headingPath must be an array of non-empty strings");
    return { expected, headingPath, ruleIds };
  }
  return { expected, headingPath: undefined, ruleIds };
};

/** @typedef {{ original: Record<string, unknown> } & ReturnType<typeof readIdentity> & ReturnType<typeof readSource> & ReturnType<typeof readLabels>} CorpusSample */
/** @type {(raw: unknown) => CorpusSample[]} */
const validateSamples = (raw) => {
  const samples = asArray(raw) ?? asArray(asRecord(raw)?.samples);
  requireValue(!matchesUndefined(samples) && samples.length > 0, "Corpus must contain samples");
  /** @type {CorpusGroups} */
  const groups = { families: new Map(), ids: new Set() };
  return samples.map((rawSample) => {
    const sample = asRecord(rawSample);
    requireValue(!matchesUndefined(sample), "Each sample must be an object");
    const identity = readIdentity(sample, groups);
    const source = readSource(sample, identity.path);
    return { ...identity, ...source, ...readLabels(sample), original: sample };
  });
};

/** @param {PrepareOptions} options - The pinned corpus inputs and output directory. */
export async function prepareCorpus({
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
  const selected = samples
    .map((sample, index) => ({
      sample,
      documentId: `sample-${String(index + 1).padStart(4, "0")}`,
    }))
    .filter(({ sample }) => split === "all" || sample.split === split);
  requireValue(selected.length > 0, "No samples selected");
  const documents = [];
  const labels = [];
  const pages = [];
  for (const { sample, documentId } of selected) {
    requireValue(
      sample.ruleIds.every((id) => scopes.has(id)),
      `Unknown rule in ${sample.id}`,
    );
    const { stdout: page } = await execute(
      "git",
      [
        "-C",
        resolve(repository),
        "show",
        "--no-ext-diff",
        "--no-textconv",
        `${sample.revision}:${sample.path}`,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    requireValue(
      sample.endLine <= page.split(/(?<=\n)/u).length && page.trim().length > 0,
      `Source range exceeds page: ${sample.id}`,
    );
    const path = `${documentId}.md`;
    pages.push({ path, page });
    documents.push({
      id: documentId,
      path,
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
    labels.push({
      ...sample.original,
      documentId,
      ruleScopes: Object.fromEntries(sample.ruleIds.map((id) => [id, scopes.get(id)])),
    });
  }
  const manifest = {
    rulesFile: resolve(rulesPath),
    model: "typesafe/jev",
    threshold: 0.8,
    documents,
  };
  const labelFile = { version: 1, samples: labels };
  await mkdir(outputDir, { recursive: true });
  for (const { path, page } of pages) {
    await writeFile(resolve(outputDir, path), page, { flag: "wx" });
  }
  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });
  await writeFile(resolve(outputDir, "labels.json"), `${JSON.stringify(labelFile, null, 2)}\n`, {
    flag: "wx",
  });
  return { manifest, labels: labelFile };
}

const counters = function () {
  return {
    total: 0,
    labeled: 0,
    exploratory: 0,
    expectedPass: 0,
    expectedFail: 0,
    predictedPass: 0,
    predictedFail: 0,
    truePositive: 0,
    trueNegative: 0,
    falseAcceptance: 0,
    falseRejection: 0,
    abstention: 0,
    infrastructureError: 0,
    missing: 0,
  };
};

const addCount = function (count, row) {
  count.total += 1;
  count[matchesNull(row.expected) ? "exploratory" : "labeled"] += 1;
  if (!matchesNull(row.expected)) {
    count[row.expected === "pass" ? "expectedPass" : "expectedFail"] += 1;
  }
  if (row.outcome === "pass" || row.outcome === "fail") {
    count[row.outcome === "pass" ? "predictedPass" : "predictedFail"] += 1;
    if (row.expected === "fail") {
      count[row.outcome === "fail" ? "truePositive" : "falseAcceptance"] += 1;
    } else if (row.expected === "pass") {
      count[row.outcome === "pass" ? "trueNegative" : "falseRejection"] += 1;
    }
  } else {
    count[row.outcome] += 1;
  }
  if (row.reason === "missing") {
    count.missing += 1;
  }
};

export function scoreReport(report, labels) {
  requireValue(
    record(report) && Array.isArray(report.evaluations),
    "Report must contain evaluations",
  );
  const samples = validateSamples(labels);
  const threshold = report.threshold ?? 0.8;
  requireValue(
    Number.isFinite(threshold) && threshold >= 0 && threshold <= 1,
    "Invalid report threshold",
  );
  const expected = new Map();
  const documents = new Set();
  const key = (documentId, ruleId) => JSON.stringify([documentId, ruleId]);
  for (const sample of samples) {
    const { documentId, ruleScopes } = sample.original;
    requireValue(
      nonempty(documentId) && !documents.has(documentId),
      "Labels need unique documentIds",
    );
    documents.add(documentId);
    for (const ruleId of sample.ruleIds) {
      const scope = (/** @type {Record<string, unknown> | undefined} */ (ruleScopes))?.[ruleId] ?? "section";
      requireValue(scope === "section" || scope === "page", "Invalid label rule scope");
      expected.set(key(documentId, ruleId), { documentId, sample, ruleId, scope, matches: [] });
    }
  }
  const issues = [];
  for (const evaluation of report.evaluations) {
    if (!record(evaluation) || !Array.isArray(evaluation.questions)) {
      issues.push({ kind: "malformed_evaluation" });
      continue;
    }
    if (!documents.has(evaluation.documentId)) {
      issues.push({ kind: "unexpected_document", documentId: evaluation.documentId });
    }
    const answers = Array.isArray(evaluation.answers) ? evaluation.answers : [];
    const questionIds = new Set(evaluation.questions.map((question) => question?.id));
    const ambiguousIds = new Set(
      evaluation.questions
        .filter(
          (question, index, all) => all.findIndex((other) => other?.id === question?.id) !== index,
        )
        .map((question) => question?.id),
    );
    for (const answer of answers) {
      if (!questionIds.has(answer?.questionId)) {
        issues.push({
          kind: "unexpected_answer",
          documentId: evaluation.documentId,
          questionId: answer?.questionId,
        });
      }
    }
    for (const question of evaluation.questions) {
      if (!nonempty(question?.id) || ambiguousIds.has(question.id)) {
        issues.push({
          kind: "ambiguous_question_id",
          documentId: evaluation.documentId,
          questionId: question?.id,
        });
        continue;
      }
      const target = expected.get(key(evaluation.documentId, question?.rule?.id));
      if (
        !target ||
        evaluation.scope !== target.scope ||
        (target.scope === "section" &&
          (evaluation.section?.id !== "target" ||
            evaluation.section.sourceRange?.startLine !== target.sample.startLine ||
            evaluation.section.sourceRange?.endLine !== target.sample.endLine))
      ) {
        issues.push({
          kind: "unexpected_question",
          documentId: evaluation.documentId,
          questionId: question?.id,
        });
        continue;
      }
      target.matches.push({
        evaluation,
        question,
        answers: answers.filter((answer) => answer?.questionId === question.id),
      });
    }
  }
  const rows = [];
  let missing = 0;
  let duplicates = 0;
  for (const { documentId, sample, ruleId, matches } of expected.values()) {
    const row = {
      documentId,
      sampleId: sample.id,
      family: sample.family,
      split: sample.split,
      ruleId,
      expected: Object.hasOwn(sample.expected, ruleId) ? sample.expected[ruleId] : null,
      outcome: "infrastructureError",
    };
    if (matches.length === 0) {
      row.reason = "missing";
      missing += 1;
    } else if (matches.length > 1) {
      row.reason = "duplicate_question";
      duplicates += matches.length - 1;
    } else {
      const { evaluation, answers } = matches[0];
      const answer = answers[0];
      if (evaluation.status !== "complete") {
        row.reason = evaluation.status === "error" ? "evaluation_error" : "not_evaluated";
      } else if (answers.length !== 1) {
        row.reason = answers.length === 0 ? "missing" : "duplicate_answer";
        if (answers.length === 0) {
          missing += 1;
        } else {
          duplicates += answers.length - 1;
        }
      } else if (
        !choices.has(answer.choice) ||
        !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 ||
        answer.confidence > 1
      ) {
        row.reason = "malformed_answer";
      } else {
        row.choice = answer.choice;
        row.confidence = answer.confidence;
        if (
          !["pass", "fail"].includes(answer.choice) ||
          answer.confidence < threshold ||
          (answer.choice === "pass" && answer.reviewRequired === true)
        ) {
          row.outcome = "abstention";
          row.reason =
            answer.confidence < threshold
              ? "low_confidence"
              : answer.choice === "pass"
                ? "review_required"
                : answer.choice;
        } else {
          row.outcome = answer.choice;
        }
      }
    }
    rows.push(row);
  }
  const totals = counters();
  const perRule = new Map();
  const perFamily = new Map();
  for (const row of rows) {
    if (!perRule.has(row.ruleId)) {
      perRule.set(row.ruleId, counters());
    }
    if (!perFamily.has(row.family)) {
      perFamily.set(row.family, counters());
    }
    for (const count of [totals, perRule.get(row.ruleId), perFamily.get(row.family)]) {
      addCount(count, row);
    }
  }
  return {
    version: 1,
    positiveClass: "fail",
    threshold,
    coverage: {
      expected: expected.size,
      labeled: rows.filter((row) => !matchesNull(row.expected)).length,
      exploratory: rows.filter((row) => matchesNull(row.expected)).length,
      matched: [...expected.values()].filter((target) => target.matches.length > 0).length,
      missing,
      duplicates,
      unexpected: issues.length,
      exact: missing === 0 && duplicates === 0 && issues.length === 0,
    },
    totals,
    perRule: Object.fromEntries(perRule),
    perFamily: Object.fromEntries(perFamily),
    rows,
    issues,
  };
}

/** @param {ScoreOptions} options - The evaluator output, sealed labels, and score path. */
export async function scoreCorpus({ reportPath, labelsPath, outputPath }) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const labels = JSON.parse(await readFile(labelsPath, "utf8"));
  const result = scoreReport(report, labels);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return result;
}

/**
 * @param {string[]} argv - User arguments after the native script path.
 * @returns {{ command: "prepare" | "score", options: Record<string, string> }} The selected command and its supplied options.
 */
export function parseArguments(argv) {
  const [command, ...argumentsList] = argv;
  requireValue(command === "prepare" || command === "score", "Expected prepare or score command");
  const allowed =
    command === "prepare"
      ? new Set(["repository", "output-dir", "split", "spec", "rules"])
      : new Set(["report", "labels", "output"]);
  /** @type {Record<string, string>} */
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const flags = argumentsList[index];
    const flag = matchesString(flags) ? flags : "";
    const value = argumentsList[index + 1];
    requireValue(flag.startsWith("--") && allowed.has(flag.slice(2)), `Unknown argument: ${flag}`);
    requireValue(nonempty(value) && !value.startsWith("--"), `Missing value for ${flag}`);
    requireValue(matchesUndefined(options[flag.slice(2)]), `Duplicate argument: ${flag}`);
    options[flag.slice(2)] = value;
  }
  for (const required of command === "prepare"
    ? ["repository", "output-dir"]
    : ["report", "labels", "output"]) {
    requireValue(options[required], `--${required} is required`);
  }
  return { command, options };
}

const main = async function () {
  try {
    const { command, options } = parseArguments(process.argv.slice(2));
    if (command === "prepare") {
      await prepareCorpus({
        repository: options.repository,
        outputDir: options["output-dir"],
        split: options.split,
        specPath: options.spec,
        rulesPath: options.rules,
      });
    } else {
      const result = await scoreCorpus({
        reportPath: options.report,
        labelsPath: options.labels,
        outputPath: options.output,
      });
      if (!result.coverage.exact || result.totals.infrastructureError > 0) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "History corpus operation failed");
    process.exitCode = 2;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
