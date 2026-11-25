import { TransportFailure } from "./evaluation-transport.mjs";
import { EvaluationError, failureMessage } from "./evaluation-validation.mjs";
import { hasObjectType, matchesNull, matchesString } from "./native-predicates.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Manifest} Manifest */
/** @typedef {import("./evaluation-state.mjs").ReportBase} ReportBase */
/** @typedef {import("./evaluation-work.mjs").DecisionWork} DecisionWork */
/** @typedef {import("./evaluation-batch.mjs").ActiveRequest} ActiveRequest */
/** @typedef {import("./evaluation-batch.mjs").RequestBatch} RequestBatch */
/** @typedef {import("./evaluation-batch.mjs").ValidatedOutcome} ValidatedOutcome */
/** @typedef {ValidatedOutcome["validated"]["answers"][number]} ProviderAnswer */
/** @typedef {{ cacheStatus: string | null, ray: string | null }} ResponseHeaders */
/** @typedef {{ key: string, ray: string | null, reused: boolean, status: string | null }} ReportCache */
/** @typedef {{ choice: "insufficient_context", confidence: number, origin: "evidence-guard", providerAnswer: ProviderAnswer, questionId: string, reason: string, reviewRequired: boolean, type: "choice" }} EvidenceGuardAnswer */
/** @typedef {(ProviderAnswer & { reviewRequired: boolean }) | EvidenceGuardAnswer} DecisionAnswer */
/** @typedef {ReportBase & { answers: DecisionAnswer[], cache: ReportCache, model: string, status: "complete", usage: unknown }} ProviderSuccess */
/** @typedef {ReportBase & { answers: [], cache: ReportCache, error: string, status: "error" }} ProviderFailure */
/** @typedef {{ item: DecisionWork, manifest: Manifest, base: ReportBase }} ProviderTarget */

const MISSING_EVIDENCE_CONFIDENCE = 0;
// oxlint-disable-next-line unicorn/no-null -- Absent provider response headers use JSON null in the public report.
const NO_HEADER = null;

/** @type {(failure: unknown) => ResponseHeaders} */
const headersFromFailure = (failure) => {
  if (matchesNull(failure) || !hasObjectType(failure)) {
    return { cacheStatus: NO_HEADER, ray: NO_HEADER };
  }
  const cacheStatus =
    "cacheStatus" in failure && matchesString(failure.cacheStatus)
      ? failure.cacheStatus
      : NO_HEADER;
  const ray = "ray" in failure && matchesString(failure.ray) ? failure.ray : NO_HEADER;
  return { cacheStatus, ray };
};

/** @type {(answer: ProviderAnswer, threshold: Manifest["threshold"]) => boolean} */
const reviewFor = (answer, threshold) =>
  answer.choice === "insufficient_context" ||
  answer.choice === "not_applicable" ||
  (answer.choice === "pass" && (matchesNull(threshold) || answer.confidence < threshold));

/** @type {(answer: ProviderAnswer, questionId: string, requiresNounEvidence: boolean) => EvidenceGuardAnswer} */
const missingEvidenceAnswer = (answer, questionId, requiresNounEvidence) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve evidence-guard answers in report order.
  ({
    type: "choice",
    questionId,
    choice: "insufficient_context",
    confidence: MISSING_EVIDENCE_CONFIDENCE,
    reviewRequired: true,
    origin: "evidence-guard",
    providerAnswer: { ...answer, questionId },
    reason: requiresNounEvidence
      ? "A model pass cannot establish noun-group compliance while required local machine counts are unavailable."
      : "A model pass cannot establish dictionary-dependent compliance while local entries or parsing context are missing.",
  });

/** @type {(answer: ProviderAnswer, item: DecisionWork, manifest: Manifest) => DecisionAnswer} */
const decisionAnswer = (answer, item, manifest) => {
  const questionId = item.questionMap[answer.questionId];
  const rule = manifest.rules.find(
    (candidate) => candidate.id === item.questions[questionId].ruleId,
  );
  if (!rule) {
    throw new EvaluationError("The validated answer no longer has a corresponding manifest rule.");
  }
  const missingNouns = (rule.requiresNounGroupCounts ?? false) && !item.nounCoverageComplete;
  const missingDictionary =
    (rule.requiresDictionaryEntries ?? false) && !item.dictionaryCoverageComplete;
  if (answer.choice === "pass" && (missingDictionary || missingNouns)) {
    return missingEvidenceAnswer(answer, questionId, missingNouns);
  }
  return { ...answer, questionId, reviewRequired: reviewFor(answer, manifest.threshold) };
};

/** @type {(identity: Pick<ActiveRequest, "key" | "reused">, headers: ResponseHeaders) => ReportCache} */
const reportCache = ({ key, reused }, { cacheStatus, ray }) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve reported cache identity and metadata order.
  ({ key, status: cacheStatus, reused, ray });

/** @type {(target: ProviderTarget, active: ActiveRequest, failures: RequestBatch["failures"]) => Promise<ProviderSuccess | ProviderFailure>} */
export const providerOutcome = async ({ base, item, manifest }, active, failures) => {
  try {
    const outcome = await active.request;
    const { validated } = outcome;
    const answers = validated.answers.map((answer) => decisionAnswer(answer, item, manifest));
    // oxlint-disable-next-line eslint/sort-keys -- Preserve successful provider output in public report order.
    return {
      ...base,
      status: "complete",
      model: validated.model,
      usage: validated.usage,
      answers,
      cache: reportCache(active, outcome),
    };
  } catch (error) {
    const cache = reportCache(active, headersFromFailure(error));
    if (error instanceof TransportFailure) {
      failures.fatal ??= error;
    }
    // oxlint-disable-next-line eslint/sort-keys -- Preserve failed provider output in public report order.
    return { ...base, status: "error", error: failureMessage(error), answers: [], cache };
  }
};
