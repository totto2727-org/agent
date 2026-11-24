import { isNativeModel } from "./evaluation-transport.mjs";
import { EvaluationError, object, text } from "./evaluation-validation.mjs";
import { matchesUndefined } from "./native-predicates.mjs";

/** @type {Readonly<["pass", "fail", "not_applicable", "insufficient_context"]>} */
const CHOICES = ["pass", "fail", "not_applicable", "insufficient_context"];
/** @typedef {{ fail: number, insufficient_context: number, not_applicable: number, pass: number }} ProbabilityDistribution */
/** @typedef {(typeof CHOICES)[number]} Choice */
const MIN_PROBABILITY = 0;
const MAX_PROBABILITY = 1;
const ROUNDING_TOLERANCE = 0.0200001;
const INVALID_ANSWER = "Cloudflare response contains an invalid answer";
const INVALID_DISTRIBUTION = "Cloudflare response contains an invalid probability distribution";

/** @type {(value: unknown) => number | undefined} */
const unitInterval = (value) => {
  const number = Number.isFinite(value) ? Number(value) : Number.NaN;
  return number >= MIN_PROBABILITY && number <= MAX_PROBABILITY ? number : undefined;
};

/**
 * @param {unknown} value - A probability from the remote response.
 * @returns {number} The validated value within the unit interval.
 */
const probability = (value) => {
  const number = unitInterval(value);
  if (matchesUndefined(number)) {
    throw new EvaluationError(INVALID_DISTRIBUTION);
  }
  return number;
};

/**
 * @param {unknown} value - The remote choice distribution.
 * @returns {ProbabilityDistribution} The validated probabilities for every choice.
 */
const readProbabilities = (value) => {
  const original = object(value, "Cloudflare answer probabilities", INVALID_DISTRIBUTION);
  if (Object.keys(original).length !== CHOICES.length) {
    throw new EvaluationError(INVALID_DISTRIBUTION);
  }
  const probabilities = {
    fail: probability(original.fail),
    insufficient_context: probability(original.insufficient_context),
    not_applicable: probability(original.not_applicable),
    pass: probability(original.pass),
  };
  const total =
    probabilities.pass +
    probabilities.fail +
    probabilities.not_applicable +
    probabilities.insufficient_context;
  if (Math.abs(total - MAX_PROBABILITY) > ROUNDING_TOLERANCE) {
    throw new EvaluationError("Cloudflare response probabilities must sum to 1");
  }
  return { ...original, ...probabilities };
};

/**
 * @param {string} questionId - The supplied question key.
 * @param {unknown} value - The answer from the remote response.
 * @returns {{ choice: Choice, confidence: number, probabilities: ProbabilityDistribution, questionId: string, type: "choice" }} The answer with its question key and validated choice fields.
 */
const readAnswer = (questionId, value) => {
  const original = object(value, "Cloudflare answer", INVALID_ANSWER);
  const choice = CHOICES.find((candidate) => candidate === original.choice);
  const confidence = unitInterval(original.confidence);
  if (original.type !== "choice" || matchesUndefined(choice) || matchesUndefined(confidence)) {
    throw new EvaluationError(INVALID_ANSWER);
  }
  const probabilities = readProbabilities(original.probabilities);
  return { questionId, ...original, choice, confidence, probabilities, type: "choice" };
};

/** @type {(response: unknown, model: string) => Record<string, unknown>} */
const envelopeResult = (response, model) => {
  const envelope = object(response, "Cloudflare response");
  if (envelope.success !== true) {
    throw new EvaluationError("Cloudflare response reports an unsuccessful request");
  }
  const outer = object(envelope.result, "Cloudflare response result");
  if (isNativeModel(model)) {
    return outer;
  }
  if (outer.state !== "Completed") {
    throw new EvaluationError(
      // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions -- Preserve the public error text for any state returned by the provider.
      `Cloudflare job did not complete (state ${outer.state ?? "unknown"})`,
    );
  }
  return object(outer.result, "Cloudflare job result");
};

/**
 * @param {unknown} response - The provider's response envelope.
 * @param {Record<string, unknown>} questions - The exact submitted question IDs.
 * @param {string} model - The requested model.
 * @returns {{ answers: Array<ReturnType<typeof readAnswer>>, model: string, usage: unknown }} Validated answers and the provider's reported model and usage.
 */
export const validateResponse = (response, questions, model) => {
  const result = envelopeResult(response, model);
  const reportedModel = text(result.model, "Cloudflare response model");
  const answers = object(
    result.answers,
    "Cloudflare answers payload",
    "Cloudflare response has an invalid answers payload",
  );
  const questionIds = Object.keys(questions);
  const answerIds = Object.keys(answers);
  if (
    answerIds.length !== questionIds.length ||
    answerIds.some((id) => !Object.hasOwn(questions, id))
  ) {
    throw new EvaluationError(
      "Cloudflare response does not answer every submitted question exactly once",
    );
  }
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the property order of the public response object.
  return {
    model: reportedModel,
    // oxlint-disable-next-line unicorn/no-null -- The published response uses JSON null when the provider omits usage.
    usage: result.usage ?? null,
    answers: Object.entries(answers).map(([questionId, answer]) => readAnswer(questionId, answer)),
  };
};
