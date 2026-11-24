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
import { matchesNull, matchesString, matchesUndefined } from "./native-predicates.mjs";

const singleAnswer = 1;
const minimumProbability = 0;
const maximumProbability = 1;

/** @typedef {import("./history-corpus-labels.mjs").CorpusSample} CorpusSample */
/** @typedef {import("./history-corpus-labels.mjs").RuleScope} RuleScope */

/** @type {Readonly<["pass", "fail", "not_applicable", "insufficient_context"]>} */
const choices = ["pass", "fail", "not_applicable", "insufficient_context"];
/** @typedef {(typeof choices)[number]} PredictedChoice */
/** @typedef {"pass" | "fail" | "abstention" | "infrastructureError"} ScoreOutcome */

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

/** @type {(samples: CorpusSample[]) => { documents: Set<string>, expected: Map<string, ScoringTarget> }} */
const indexExpectedScores = (samples) => {
  /** @type {Map<string, ScoringTarget>} */
  const expected = new Map();
  /** @type {Set<string>} */
  const documents = new Set();
  samples.forEach((sample) => {
    const { documentId, ruleScopes } = sample.original;
    requireValue(
      nonempty(documentId) && !documents.has(documentId),
      "Labels need unique documentIds",
    );
    documents.add(documentId);
    sample.ruleIds.forEach((ruleId) => {
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
    });
  });
  return { documents, expected };
};

/** @type {(evaluations: unknown[], index: ReturnType<typeof indexExpectedScores>) => ScoreIssue[]} */
const matchEvaluations = (evaluations, { documents, expected }) => {
  /** @type {ScoreIssue[]} */
  const issues = [];
  evaluations.forEach((rawEvaluation) => {
    const evaluation = asRecord(rawEvaluation);
    const rawQuestions = asArray(evaluation?.questions);
    if (matchesUndefined(evaluation) || matchesUndefined(rawQuestions)) {
      issues.push({ kind: "malformed_evaluation" });
      return;
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
  });
  return issues;
};

/** @type {(targets: Iterable<ScoringTarget>, threshold: number) => { counts: { duplicates: number, missing: number }, rows: ScoreRow[] }} */
const scoreRows = (targets, threshold) => {
  const counts = { duplicates: 0, missing: 0 };
  const rows = Array.from(targets, ({ documentId, sample, ruleId, matches }) => {
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
      counts.missing += singleAnswer;
    } else if (matches.length > singleAnswer) {
      row.reason = "duplicate_question";
      counts.duplicates += matches.length - singleAnswer;
    } else {
      const { evaluation, answers } = matches[0];
      if (evaluation.status !== "complete") {
        row.reason = evaluation.status === "error" ? "evaluation_error" : "not_evaluated";
      } else if (answers.length === singleAnswer) {
        scoreCompletedAnswer(row, answers[0], threshold);
      } else {
        row.reason = hasEntries(answers) ? "duplicate_answer" : "missing";
        if (!hasEntries(answers)) {
          counts.missing += singleAnswer;
        } else {
          counts.duplicates += answers.length - singleAnswer;
        }
      }
    }
    return row;
  });
  return { counts, rows };
};

/** @param {ScoreRow[]} rows - The completed score rows in corpus order. */
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
};
