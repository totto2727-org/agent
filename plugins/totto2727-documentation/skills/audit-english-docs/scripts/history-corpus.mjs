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
const minimumTextLength = 1;
const noEntries = 0;
const singleAnswer = 1;
const firstSourceLine = 1;
const firstSampleId = 1;
const sampleIdWidth = 4;
const gitOutputLimit = 16_777_216;
const defaultThreshold = 0.8;
const minimumProbability = 0;
const maximumProbability = 1;
const jsonIndent = 2;
const corpusVersion = 1;
const optionPrefix = "--";
const optionFields = 2;
const optionValueOffset = 1;
const firstCliArgument = 2;
/** @type {Readonly<["pass", "fail", "not_applicable", "insufficient_context"]>} */
const choices = ["pass", "fail", "not_applicable", "insufficient_context"];
/** @typedef {(typeof choices)[number]} PredictedChoice */
/** @typedef {"pass" | "fail" | "abstention" | "infrastructureError"} ScoreOutcome */

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
  return matchesString(value) && value.trim().length >= minimumTextLength;
};

/** @type {(entries: unknown[]) => boolean} */
const hasEntries = (entries) => entries.length > noEntries;

/** @param {unknown} value - The candidate JSON record. */
const record = function (value) {
  return !matchesNull(value) && hasObjectType(value) && !Array.isArray(value);
};

/** @type {(value: unknown) => Record<string, unknown> | undefined} */
const asRecord = (value) =>
  record(value) ? /** @type {Record<string, unknown>} */ (value) : undefined;

/** @type {(value: unknown) => unknown[] | undefined} */
const asArray = (value) => (Array.isArray(value) ? value : undefined);

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
  requireValue(
    !families.has(family) || families.get(family) === split,
    `Family crosses calibration and holdout: ${family}`,
  );
  families.set(family, split);
  return { audience, family, id, path, purpose, split };
};

/** @type {(value: Record<string, unknown>, path: string) => { endLine: number, revision: string, startLine: number }} */
const readSource = (value, path) => {
  const { revision } = value;
  requireValue(
    matchesString(revision) && /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(revision),
    "Each revision must be a full Git object ID",
  );
  requireValue(
    !isAbsolute(path) &&
      !path.includes("\0") &&
      !path.split("/").some((part) => part === ".." || part === ""),
    "Sample path must be repository-relative without traversal",
  );
  const startLine = Number.isInteger(value.startLine) ? Number(value.startLine) : Number.NaN;
  const endLine = Number.isInteger(value.endLine) ? Number(value.endLine) : Number.NaN;
  requireValue(startLine >= firstSourceLine && endLine >= startLine, "Invalid source line range");
  return { endLine, revision, startLine };
};

/**
 * @param {Record<string, unknown>} sample - A corpus identity and source range.
 * @returns {{ expected: Record<string, unknown>, headingPath: string[] | undefined, ruleIds: string[] }} The validated label selection.
 */
const readLabels = (sample) => {
  const ruleIds = asArray(sample.ruleIds);
  requireValue(
    !matchesUndefined(ruleIds) &&
      hasEntries(ruleIds) &&
      ruleIds.every(nonempty) &&
      new Set(ruleIds).size === ruleIds.length,
    "Sample ruleIds must be unique non-empty strings",
  );
  const expected = asRecord(sample.expected);
  requireValue(
    !matchesUndefined(expected) &&
      Object.entries(expected).every(
        ([ruleId, label]) => ruleIds.includes(ruleId) && (label === "pass" || label === "fail"),
      ),
    "Expected labels must map selected rules to pass or fail",
  );
  const rawHeading = sample.headingPath;
  const headingPath = asArray(rawHeading);
  if (!matchesUndefined(rawHeading)) {
    requireValue(
      !matchesUndefined(headingPath) && headingPath.every(nonempty),
      "headingPath must be an array of non-empty strings",
    );
    return { expected, headingPath, ruleIds };
  }
  return { expected, headingPath: undefined, ruleIds };
};

/** @typedef {{ original: Record<string, unknown> } & ReturnType<typeof readIdentity> & ReturnType<typeof readSource> & ReturnType<typeof readLabels>} CorpusSample */
/** @type {(raw: unknown) => CorpusSample[]} */
const validateSamples = (raw) => {
  const samples = asArray(raw) ?? asArray(asRecord(raw)?.samples);
  requireValue(!matchesUndefined(samples) && hasEntries(samples), "Corpus must contain samples");
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
      documentId: `sample-${String(index + firstSampleId).padStart(sampleIdWidth, "0")}`,
    }))
    .filter(({ sample }) => split === "all" || sample.split === split);
  requireValue(hasEntries(selected), "No samples selected");
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
      { encoding: "utf8", maxBuffer: gitOutputLimit },
    );
    requireValue(
      sample.endLine <= page.split(/(?<=\n)/u).length && nonempty(page),
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
    threshold: defaultThreshold,
    documents,
  };
  const labelFile = { version: corpusVersion, samples: labels };
  await mkdir(outputDir, { recursive: true });
  for (const { path, page } of pages) {
    await writeFile(resolve(outputDir, path), page, { flag: "wx" });
  }
  await writeFile(
    resolve(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, undefined, jsonIndent)}\n`,
    {
      flag: "wx",
    },
  );
  await writeFile(
    resolve(outputDir, "labels.json"),
    `${JSON.stringify(labelFile, undefined, jsonIndent)}\n`,
    {
      flag: "wx",
    },
  );
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

/** @type {(count: ReturnType<typeof counters>, row: ScoreRow) => void} */
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

/** @typedef {{ evaluation: Record<string, unknown>, answers: Array<Record<string, unknown> | undefined> }} AnswerMatch */
/** @typedef {{ documentId: string, matches: AnswerMatch[], ruleId: string, sample: CorpusSample, scope: RuleScope }} ScoringTarget */
/** @typedef {{ choice?: PredictedChoice, confidence?: number, documentId: string, expected: unknown, family: string, outcome: ScoreOutcome, reason?: string, ruleId: string, sampleId: string, split: CorpusSplit }} ScoreRow */
/** @typedef {{ documentId?: unknown, kind: string, questionId?: unknown }} ScoreIssue */

/** @type {(documentId: unknown, ruleId: unknown) => string} */
const targetKey = (documentId, ruleId) => JSON.stringify([documentId, ruleId]);

/** @type {(row: ScoreRow, answer: Record<string, unknown> | undefined, threshold: number) => void} */
const scoreCompletedAnswer = (row, answer, threshold) => {
  const choice = choices.find((option) => option === answer?.choice);
  const providedConfidence = answer?.confidence;
  const confidence = Number.isFinite(providedConfidence) ? Number(providedConfidence) : Number.NaN;
  if (
    matchesUndefined(choice) ||
    !(confidence >= minimumProbability && confidence <= maximumProbability)
  ) {
    row.reason = "malformed_answer";
    return;
  }
  row.choice = choice;
  row.confidence = confidence;
  if (confidence < threshold) {
    row.outcome = "abstention";
    row.reason = "low_confidence";
    return;
  }
  if (choice === "fail" || (choice === "pass" && answer?.reviewRequired !== true)) {
    row.outcome = choice;
    return;
  }
  row.outcome = "abstention";
  row.reason = choice === "pass" ? "review_required" : choice;
};

/**
 * @param {unknown} report - A semantic evaluator report.
 * @param {unknown} labels - The sealed corpus labels.
 */
export function scoreReport(report, labels) {
  const sourceReport = asRecord(report);
  const evaluations = asArray(sourceReport?.evaluations);
  requireValue(!matchesUndefined(evaluations), "Report must contain evaluations");
  const samples = validateSamples(labels);
  const reportedThreshold = sourceReport?.threshold ?? defaultThreshold;
  const threshold = Number.isFinite(reportedThreshold) ? Number(reportedThreshold) : Number.NaN;
  requireValue(
    Number.isFinite(threshold) &&
      threshold >= minimumProbability &&
      threshold <= maximumProbability,
    "Invalid report threshold",
  );
  /** @type {Map<string, ScoringTarget>} */
  const expected = new Map();
  /** @type {Set<string>} */
  const documents = new Set();
  Iterator.from(samples).forEach((sample) => {
    const { documentId, ruleScopes } = sample.original;
    requireValue(
      nonempty(documentId) && !documents.has(documentId),
      "Labels need unique documentIds",
    );
    documents.add(documentId);
    for (const ruleId of sample.ruleIds) {
      const scope =
        /** @type {Record<string, unknown> | undefined} */ (ruleScopes)?.[ruleId] ?? "section";
      requireValue(scope === "section" || scope === "page", "Invalid label rule scope");
      expected.set(targetKey(documentId, ruleId), {
        documentId,
        matches: [],
        ruleId,
        sample,
        scope,
      });
    }
  });
  /** @type {ScoreIssue[]} */
  const issues = [];
  for (const rawEvaluation of evaluations) {
    const evaluation = asRecord(rawEvaluation);
    const rawQuestions = asArray(evaluation?.questions);
    if (matchesUndefined(evaluation) || matchesUndefined(rawQuestions)) {
      issues.push({ kind: "malformed_evaluation" });
      continue;
    }
    if (!matchesString(evaluation.documentId) || !documents.has(evaluation.documentId)) {
      issues.push({ kind: "unexpected_document", documentId: evaluation.documentId });
    }
    const questions = rawQuestions.map((question) => asRecord(question));
    const answers = (asArray(evaluation.answers) ?? []).map((answer) => asRecord(answer));
    const questionIds = new Set(questions.map((question) => question?.id));
    const ambiguousIds = new Set(
      questions
        .filter(
          (question, index, all) => all.findIndex((other) => other?.id === question?.id) !== index,
        )
        .map((question) => question?.id),
    );
    Iterator.from(answers).forEach((answer) => {
      if (!questionIds.has(answer?.questionId)) {
        issues.push({
          kind: "unexpected_answer",
          documentId: evaluation.documentId,
          questionId: answer?.questionId,
        });
      }
    });
    Iterator.from(questions).forEach((question) => {
      if (!nonempty(question?.id) || ambiguousIds.has(question.id)) {
        issues.push({
          kind: "ambiguous_question_id",
          documentId: evaluation.documentId,
          questionId: question?.id,
        });
        return;
      }
      const target = expected.get(targetKey(evaluation.documentId, asRecord(question?.rule)?.id));
      const section = asRecord(evaluation.section);
      const range = asRecord(section?.sourceRange);
      if (
        !target ||
        evaluation.scope !== target.scope ||
        (target.scope === "section" &&
          (section?.id !== "target" ||
            range?.startLine !== target.sample.startLine ||
            range?.endLine !== target.sample.endLine))
      ) {
        issues.push({
          kind: "unexpected_question",
          documentId: evaluation.documentId,
          questionId: question?.id,
        });
        return;
      }
      target.matches.push({
        evaluation,
        answers: answers.filter((answer) => answer?.questionId === question.id),
      });
    });
  }
  /** @type {ScoreRow[]} */
  const rows = [];
  let missing = 0;
  let duplicates = 0;
  Iterator.from(expected.values()).forEach(({ documentId, sample, ruleId, matches }) => {
    /** @type {ScoreRow} */
    const row = {
      documentId,
      sampleId: sample.id,
      family: sample.family,
      split: sample.split,
      ruleId,
      expected: Object.hasOwn(sample.expected, ruleId) ? sample.expected[ruleId] : null,
      outcome: "infrastructureError",
    };
    if (!hasEntries(matches)) {
      row.reason = "missing";
      missing += singleAnswer;
    } else if (matches.length > singleAnswer) {
      row.reason = "duplicate_question";
      duplicates += matches.length - singleAnswer;
    } else {
      const { evaluation, answers } = matches[0];
      if (evaluation.status !== "complete") {
        row.reason = evaluation.status === "error" ? "evaluation_error" : "not_evaluated";
      } else if (answers.length === singleAnswer) {
        scoreCompletedAnswer(row, answers[0], threshold);
      } else {
        row.reason = hasEntries(answers) ? "duplicate_answer" : "missing";
        if (!hasEntries(answers)) {
          missing += singleAnswer;
        } else {
          duplicates += answers.length - singleAnswer;
        }
      }
    }
    rows.push(row);
  });
  const totals = counters();
  /** @type {Map<string, ReturnType<typeof counters>>} */
  const perRule = new Map();
  /** @type {Map<string, ReturnType<typeof counters>>} */
  const perFamily = new Map();
  Iterator.from(rows).forEach((row) => {
    const ruleCounts = perRule.get(row.ruleId) ?? counters();
    const familyCounts = perFamily.get(row.family) ?? counters();
    perRule.set(row.ruleId, ruleCounts);
    perFamily.set(row.family, familyCounts);
    [totals, ruleCounts, familyCounts].forEach((count) => {
      addCount(count, row);
    });
  });
  return {
    version: corpusVersion,
    positiveClass: "fail",
    threshold,
    coverage: {
      expected: expected.size,
      labeled: rows.filter((row) => !matchesNull(row.expected)).length,
      exploratory: rows.filter((row) => matchesNull(row.expected)).length,
      matched: [...expected.values()].filter((target) => hasEntries(target.matches)).length,
      missing,
      duplicates,
      unexpected: issues.length,
      exact: missing === noEntries && duplicates === noEntries && !hasEntries(issues),
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
  await writeFile(outputPath, `${JSON.stringify(result, undefined, jsonIndent)}\n`, { flag: "wx" });
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
  for (let index = 0; index < argumentsList.length; index += optionFields) {
    const flags = argumentsList[index];
    const flag = matchesString(flags) ? flags : "";
    const value = argumentsList[index + optionValueOffset];
    const flagName = flag.slice(optionPrefix.length);
    requireValue(
      flag.startsWith(optionPrefix) && allowed.has(flagName),
      `Unknown argument: ${flag}`,
    );
    requireValue(nonempty(value) && !value.startsWith(optionPrefix), `Missing value for ${flag}`);
    requireValue(matchesUndefined(options[flagName]), `Duplicate argument: ${flag}`);
    options[flagName] = value;
  }
  Iterator.from(
    command === "prepare" ? ["repository", "output-dir"] : ["report", "labels", "output"],
  ).forEach((required) => {
    requireValue(options[required], `--${required} is required`);
  });
  return { command, options };
}

const main = async function () {
  try {
    const { command, options } = parseArguments(process.argv.slice(firstCliArgument));
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
      if (!result.coverage.exact || result.totals.infrastructureError > noEntries) {
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
