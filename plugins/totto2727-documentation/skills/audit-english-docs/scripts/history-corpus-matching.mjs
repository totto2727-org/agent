import { asArray, asRecord, nonempty, requireValue } from "./history-corpus-labels.mjs";
import { matchesString, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {import("./history-corpus-labels.mjs").CorpusSample} CorpusSample */
/** @typedef {import("./history-corpus-labels.mjs").RuleScope} RuleScope */

/** @typedef {{ evaluation: Record<string, unknown>, answers: Array<Record<string, unknown> | undefined> }} AnswerMatch */
/** @typedef {{ documentId: string, matches: AnswerMatch[], ruleId: string, sample: CorpusSample, scope: RuleScope }} ScoringTarget */
/** @typedef {{ documentId?: unknown, kind: string, questionId?: unknown }} ScoreIssue */

/** @type {(kind: string, fields?: Omit<ScoreIssue, "kind">) => ScoreIssue} */
const scoreIssue = (kind, fields = {}) => ({ kind, ...fields });

/** @type {(documentId: unknown, ruleId: unknown) => string} */
const targetKey = (documentId, ruleId) => JSON.stringify([documentId, ruleId]);

/** @type {(samples: CorpusSample[]) => { documents: Set<string>, expected: Map<string, ScoringTarget> }} */
export const indexExpectedScores = (samples) => {
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
      /* oxlint-disable eslint/no-inline-comments, typescript/no-unsafe-type-assertion -- Read the supplied scope with native property lookup, then validate the selected value. */
      const scope =
        /** @type {Record<string, unknown> | undefined} */ (ruleScopes)?.[ruleId] ?? "section";
      /* oxlint-enable eslint/no-inline-comments, typescript/no-unsafe-type-assertion */
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

/** @type {(evaluation: Record<string, unknown>, rawQuestions: unknown[], state: { expected: Map<string, ScoringTarget>, issues: ScoreIssue[] }) => void} */
const matchQuestions = (evaluation, rawQuestions, { expected, issues }) => {
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
      issues.push(
        scoreIssue("unexpected_answer", {
          documentId: evaluation.documentId,
          questionId: answer?.questionId,
        }),
      );
    }
  });
  Iterator.from(questions).forEach((question) => {
    if (!nonempty(question?.id) || ambiguousIds.has(question.id)) {
      issues.push(
        scoreIssue("ambiguous_question_id", {
          documentId: evaluation.documentId,
          questionId: question?.id,
        }),
      );
      return;
    }
    const target = expected.get(targetKey(evaluation.documentId, asRecord(question.rule)?.id));
    const section = asRecord(evaluation.section);
    const range = asRecord(section?.sourceRange);
    if (
      !target ||
      evaluation.scope !== target.scope ||
      (target.scope === "section" &&
        (section?.id !== "target" ||
          range?.startLine !== target.sample.startLine ||
          range.endLine !== target.sample.endLine))
    ) {
      issues.push(
        scoreIssue("unexpected_question", {
          documentId: evaluation.documentId,
          questionId: question.id,
        }),
      );
      return;
    }
    target.matches.push({
      answers: answers.filter((answer) => answer?.questionId === question.id),
      evaluation,
    });
  });
};

/** @type {(evaluations: unknown[], index: ReturnType<typeof indexExpectedScores>) => ScoreIssue[]} */
export const matchEvaluations = (evaluations, { documents, expected }) => {
  /** @type {ScoreIssue[]} */
  const issues = [];
  evaluations.forEach((rawEvaluation) => {
    const evaluation = asRecord(rawEvaluation);
    const rawQuestions = asArray(evaluation?.questions);
    if (matchesUndefined(evaluation) || matchesUndefined(rawQuestions)) {
      issues.push(scoreIssue("malformed_evaluation"));
      return;
    }
    if (!matchesString(evaluation.documentId) || !documents.has(evaluation.documentId)) {
      issues.push(scoreIssue("unexpected_document", { documentId: evaluation.documentId }));
    }
    matchQuestions(evaluation, rawQuestions, { expected, issues });
  });
  return issues;
};
