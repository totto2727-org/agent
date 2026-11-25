import { stateFor } from "./evaluation-state.mjs";
import { runMechanical } from "./mechanical.mjs";

/** @typedef {import("./evaluation-state.mjs").ReportBase} ReportBase */
/** @typedef {import("./evaluation-state.mjs").EvaluationState} EvaluationState */
/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {import("./evaluation-work.mjs").MechanicalWork} MechanicalWork */
/** @typedef {import("./evaluation-work.mjs").DecisionWork} DecisionWork */
/** @typedef {ReturnType<typeof runMechanical> & { questionId: string }} MechanicalAnswer */
/** @typedef {{ choice: "not_applicable", confidence: number, findings: [], questionId: string, reason: string, reviewRequired: boolean, type: "choice" }} UnavailableAnswer */
/** @typedef {{ choice: "insufficient_context", deferred: boolean, questionId: string, reviewRequired: boolean, type: "choice" }} DeferredAnswer */

// oxlint-disable-next-line unicorn/no-null -- Local-only and skipped report entries have no provider cache record.
const NO_CACHE = null;
const NO_PARAGRAPH = "No paragraph target is available.";
const COMPLETE_CONFIDENCE = 1;

/** @type {(base: ReportBase, item: PreparedWork) => ReportBase & { answers: [], cache: null, state: EvaluationState, status: "dry_run" }} */
export const dryOutcome = (base, item) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing dry-run report order.
  ({ ...base, status: "dry_run", state: stateFor(item), answers: [], cache: NO_CACHE });

/** @type {(item: MechanicalWork, range: ReportBase["sourceRange"], entry: [string, MechanicalWork["questions"][string]]) => MechanicalAnswer | UnavailableAnswer} */
const mechanicalAnswer = (item, range, [questionId, question]) => {
  if (!item.unavailable) {
    return { questionId, ...runMechanical(question.check, item.page, range, item.ste) };
  }
  // oxlint-disable-next-line eslint/sort-keys -- Keep the unavailable answer in its existing report order.
  return {
    questionId,
    type: "choice",
    choice: "not_applicable",
    confidence: COMPLETE_CONFIDENCE,
    reviewRequired: false,
    findings: [],
    reason: NO_PARAGRAPH,
  };
};

/** @type {(base: ReportBase, item: MechanicalWork) => ReportBase & { answers: (MechanicalAnswer | UnavailableAnswer)[], cache: null, status: "complete" }} */
export const mechanicalOutcome = (base, item) => {
  const answers = Object.entries(item.questions).map((entry) =>
    mechanicalAnswer(item, base.sourceRange, entry),
  );
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing mechanical result order.
  return { ...base, status: "complete", cache: NO_CACHE, answers };
};

/** @type {(base: ReportBase, item: DecisionWork) => ReportBase & { answers: DeferredAnswer[], cache: null, reason: string, status: "deferred" }} */
export const deferredOutcome = (base, item) => {
  const reason = item.unavailable
    ? (item.unavailableReason ?? NO_PARAGRAPH)
    : "Semantic checks are not executed in mechanical-only mode.";
  /** @type {DeferredAnswer[]} */
  const answers = base.questions.map((question) =>
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the deferred answer's public report key order.
    ({
      questionId: question.id,
      type: "choice",
      choice: "insufficient_context",
      deferred: true,
      reviewRequired: true,
    }),
  );
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing deferred result order.
  return { ...base, status: "deferred", reason, cache: NO_CACHE, answers };
};

/** @type {(base: ReportBase, message: string) => ReportBase & { answers: [], cache: null, error: string, status: "skipped" }} */
export const skippedOutcome = (base, message) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing skipped result order.
  ({ ...base, status: "skipped", error: message, answers: [], cache: NO_CACHE });
