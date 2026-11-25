import {
  asArray,
  asRecord,
  corpusVersion,
  defaultThreshold,
  hasEntries,
  noEntries,
  requireValue,
  validateSamples,
} from "./history-corpus-labels.mjs";
import { indexExpectedScores, matchEvaluations } from "./history-corpus-matching.mjs";
import { matchesNull, matchesUndefined } from "./native-predicates.mjs";

const singleAnswer = 1;
const minimumProbability = 0;
const maximumProbability = 1;
// oxlint-disable-next-line unicorn/no-null -- The score format stores a JSON null for exploratory rows without expected labels.
const exploratoryLabel = null;

/** @typedef {import("./history-corpus-labels.mjs").CorpusSample} CorpusSample */
/** @typedef {import("./history-corpus-matching.mjs").ScoringTarget} ScoringTarget */

/** @type {Readonly<["pass", "fail", "not_applicable", "insufficient_context"]>} */
const choices = ["pass", "fail", "not_applicable", "insufficient_context"];
/** @typedef {(typeof choices)[number]} PredictedChoice */
/** @typedef {"pass" | "fail" | "abstention" | "infrastructureError"} ScoreOutcome */

/* oxlint-disable eslint/sort-keys -- Preserve the score file's established counter field order. */
const initialCounts = {
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
/* oxlint-enable eslint/sort-keys */

/** @type {() => typeof initialCounts} */
const counters = () => ({ ...initialCounts });

/** @type {(count: ReturnType<typeof counters>, row: ScoreRow) => void} */
const countPrediction = (count, row) => {
  count[row.outcome === "pass" ? "predictedPass" : "predictedFail"] += 1;
  if (row.expected === "fail") {
    count[row.outcome === "fail" ? "truePositive" : "falseAcceptance"] += 1;
  } else if (row.expected === "pass") {
    count[row.outcome === "pass" ? "trueNegative" : "falseRejection"] += 1;
  }
};

/** @type {(count: ReturnType<typeof counters>, row: ScoreRow) => void} */
const addCount = function (count, row) {
  count.total += 1;
  count[matchesNull(row.expected) ? "exploratory" : "labeled"] += 1;
  if (!matchesNull(row.expected)) {
    count[row.expected === "pass" ? "expectedPass" : "expectedFail"] += 1;
  }
  if (row.outcome === "pass" || row.outcome === "fail") {
    countPrediction(count, row);
  } else {
    count[row.outcome] += 1;
  }
  if (row.reason === "missing") {
    count.missing += 1;
  }
};

/** @typedef {import("./history-corpus-labels.mjs").CorpusSplit} CorpusSplit */
/** @typedef {{ choice?: PredictedChoice, confidence?: number, documentId: string, expected: unknown, family: string, outcome: ScoreOutcome, reason?: string, ruleId: string, sampleId: string, split: CorpusSplit }} ScoreRow */
/** @typedef {{ duplicates: number, missing: number }} Counts */
/** @typedef {import("./history-corpus-matching.mjs").ScoreIssue} ScoreIssue */
/** @type {(choice: PredictedChoice, lowConfidence: boolean, reviewRequired: boolean) => Pick<ScoreRow, "outcome" | "reason">} */
const scoredOutcome = (choice, lowConfidence, reviewRequired) => {
  if (lowConfidence) {
    return { outcome: "abstention", reason: "low_confidence" };
  }
  if (choice === "fail" || (choice === "pass" && !reviewRequired)) {
    return { outcome: choice };
  }
  return { outcome: "abstention", reason: choice === "pass" ? "review_required" : choice };
};

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
  Object.assign(
    row,
    { choice, confidence },
    scoredOutcome(
      choice,
      confidence < threshold,
      confidence >= threshold && choice === "pass" && answer?.reviewRequired === true,
    ),
  );
};

/** @type {(report: unknown, labels: unknown) => { evaluations: unknown[], samples: CorpusSample[], threshold: number }} */
const scoreInput = (report, labels) => {
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
  return { evaluations, samples, threshold };
};

/** @type {(row: ScoreRow, match: ScoringTarget["matches"][number], state: { counts: Counts, threshold: number }) => void} */
const scoreMatchedQuestion = (row, { evaluation, answers }, { counts, threshold }) => {
  if (evaluation.status !== "complete") {
    row.reason = evaluation.status === "error" ? "evaluation_error" : "not_evaluated";
  } else if (answers.length === singleAnswer) {
    scoreCompletedAnswer(row, answers[0], threshold);
  } else if (hasEntries(answers)) {
    row.reason = "duplicate_answer";
    counts.duplicates += answers.length - singleAnswer;
  } else {
    row.reason = "missing";
    counts.missing += singleAnswer;
  }
};

/** @type {(targets: Iterable<ScoringTarget>, threshold: number) => { counts: Counts, rows: ScoreRow[] }} */
const scoreRows = (targets, threshold) => {
  const counts = { duplicates: 0, missing: 0 };
  const rows = Array.from(targets, ({ documentId, sample, ruleId, matches }) => {
    /* oxlint-disable eslint/sort-keys -- Keep the serialized row columns in their established order. */
    /** @type {ScoreRow} */
    const row = {
      documentId,
      sampleId: sample.id,
      family: sample.family,
      split: sample.split,
      ruleId,
      expected: Object.hasOwn(sample.expected, ruleId) ? sample.expected[ruleId] : exploratoryLabel,
      outcome: "infrastructureError",
    };
    /* oxlint-enable eslint/sort-keys */
    if (!hasEntries(matches)) {
      row.reason = "missing";
      counts.missing += singleAnswer;
    } else if (matches.length > singleAnswer) {
      row.reason = "duplicate_question";
      counts.duplicates += matches.length - singleAnswer;
    } else {
      scoreMatchedQuestion(row, matches[0], { counts, threshold });
    }
    return row;
  });
  return { counts, rows };
};

/** @type {(rows: ScoreRow[]) => { perFamily: Record<string, typeof initialCounts>, perRule: Record<string, typeof initialCounts>, totals: typeof initialCounts }} */
const summarizeRows = (rows) => {
  const totals = counters();
  /** @type {Map<string, ReturnType<typeof counters>>} */
  const perRule = new Map();
  /** @type {Map<string, ReturnType<typeof counters>>} */
  const perFamily = new Map();
  rows.forEach((row) => {
    const ruleCounts = perRule.get(row.ruleId) ?? counters();
    const familyCounts = perFamily.get(row.family) ?? counters();
    perRule.set(row.ruleId, ruleCounts);
    perFamily.set(row.family, familyCounts);
    [totals, ruleCounts, familyCounts].forEach((count) => {
      addCount(count, row);
    });
  });
  return { perFamily: Object.fromEntries(perFamily), perRule: Object.fromEntries(perRule), totals };
};

/**
 * @param {unknown} report - A semantic evaluator report.
 * @param {unknown} labels - The sealed corpus labels.
 * @returns {ReturnType<typeof summarizeRows> & { coverage: Counts & { exact: boolean, expected: number, exploratory: number, labeled: number, matched: number, unexpected: number }, issues: ScoreIssue[], positiveClass: string, rows: ScoreRow[], threshold: number, version: number }} The score and coverage report in corpus order.
 */
export const scoreReport = function (report, labels) {
  const { evaluations, samples, threshold } = scoreInput(report, labels);
  const index = indexExpectedScores(samples);
  const issues = matchEvaluations(evaluations, index);
  const { expected } = index;
  const {
    counts: { duplicates, missing },
    rows,
  } = scoreRows(expected.values(), threshold);
  const { perFamily, perRule, totals } = summarizeRows(rows);
  /* oxlint-disable eslint/sort-keys -- Keep the public score report and coverage fields in their established order. */
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
    perRule,
    perFamily,

    rows,
    issues,
  };
  /* oxlint-enable eslint/sort-keys */
};
