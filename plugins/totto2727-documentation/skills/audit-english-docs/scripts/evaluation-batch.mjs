import { validateResponse } from "./evaluation-response.mjs";
import { stateFor } from "./evaluation-state.mjs";
import {
  actionRequest,
  cacheFingerprint,
  endpointFor,
  payloadFor,
  readCredentials,
} from "./evaluation-transport.mjs";
import { EvaluationError } from "./evaluation-validation.mjs";
import { hasObjectType, matchesNull, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {import("./evaluation-work.mjs").DecisionWork} DecisionWork */
/** @typedef {import("./evaluation-transport.mjs").ActionInput} ActionInput */
/** @typedef {import("./evaluation-transport.mjs").ResponseHeaders} ResponseHeaders */
/** @typedef {import("./evaluation-transport.mjs").RequestMetrics} RequestMetrics */
/** @typedef {import("./evaluation-transport.mjs").TransportFailure} TransportFailure */
/** @typedef {ResponseHeaders & { validated: ReturnType<typeof validateResponse> }} ValidatedOutcome */
/** @typedef {{ key: string, request: Promise<ValidatedOutcome>, reused: boolean }} ActiveRequest */
/** @typedef {{ dryRun: boolean, environment: Record<string, string | undefined>, mechanicalOnly: boolean, model: string | undefined }} BatchSettings */
/** @typedef {{ failures: { fatal?: TransportFailure }, metrics: RequestMetrics, submit: (item: DecisionWork) => ActiveRequest }} RequestBatch */

const INITIAL_REQUEST_COUNT = 0;
// oxlint-disable-next-line unicorn/no-null -- Retain the absent gateway credentials state for local-only runs.
const NO_CREDENTIALS = null;

/** @type {(value: unknown) => boolean} */
const isAbsentHeader = (value) => matchesNull(value) || matchesUndefined(value);

/** @type {(failure: unknown, headers: ResponseHeaders) => void} */
const preserveHeaders = (failure, { cacheStatus, ray }) => {
  if (!hasObjectType(failure) || matchesNull(failure)) {
    return;
  }
  if (!("cacheStatus" in failure) || isAbsentHeader(failure.cacheStatus)) {
    Object.assign(failure, { cacheStatus });
  }
  if (!("ray" in failure) || isAbsentHeader(failure.ray)) {
    Object.assign(failure, { ray });
  }
};

/** @type {(request: ActionInput) => Promise<ValidatedOutcome>} */
const requestAndValidate = async (request) => {
  const outcome = await actionRequest(request);
  try {
    const validated = validateResponse(outcome.response, request.questions, request.model);
    return { cacheStatus: outcome.cacheStatus, ray: outcome.ray, validated };
  } catch (error) {
    preserveHeaders(error, outcome);
    throw error;
  }
};

/** @type {(work: PreparedWork[], settings: BatchSettings) => ActionInput["credentials"] | null} */
const credentialsFor = (work, { dryRun, environment, mechanicalOnly }) => {
  if (
    dryRun ||
    mechanicalOnly ||
    !work.some((item) => item.engine === "decision" && !item.unavailable)
  ) {
    return NO_CREDENTIALS;
  }
  return readCredentials(environment);
};

/** @type {(item: DecisionWork, model: ActionInput["model"], credentials: ActionInput["credentials"]) => Pick<ActionInput, "cacheKey" | "credentials" | "model" | "questions" | "state">} */
const requestFor = (item, model, credentials) => {
  const state = stateFor(item);
  const url = endpointFor(model, credentials.accountId);
  const body = payloadFor(model, state, item.requestQuestions);
  const cacheKey = cacheFingerprint({
    apiKey: credentials.apiKey,
    body,
    gatewayId: credentials.gatewayId,
    url,
  });
  return { cacheKey, credentials, model, questions: item.requestQuestions, state };
};

/** @type {(input: ActionInput, inflight: Map<string, Promise<ValidatedOutcome>>) => ActiveRequest} */
const submitOnce = (input, inflight) => {
  const key = input.cacheKey;
  const existing = inflight.get(key);
  if (!matchesUndefined(existing)) {
    return { key, request: existing, reused: true };
  }
  const request = requestAndValidate(input);
  // Cache the promise before waiting so all equivalent work observes the same validation result.
  inflight.set(key, request);
  return { key, request, reused: false };
};

/** @type {(work: PreparedWork[], settings: BatchSettings) => RequestBatch} */
export const requestsFor = (work, settings) => {
  const credentials = credentialsFor(work, settings);
  const { model } = settings;
  const metrics = {
    activeRequests: INITIAL_REQUEST_COUNT,
    observedPeakActiveRequests: INITIAL_REQUEST_COUNT,
    requestCount: INITIAL_REQUEST_COUNT,
  };
  /** @type {Map<string, Promise<ValidatedOutcome>>} */
  const inflight = new Map();
  /** @type {RequestBatch["failures"]} */
  const failures = {};
  /** @type {RequestBatch["submit"]} */
  const submit = (item) => {
    if (matchesNull(credentials) || matchesUndefined(model)) {
      throw new EvaluationError(
        "An active semantic evaluation requires a model and gateway credentials.",
      );
    }
    return submitOnce({ ...requestFor(item, model, credentials), metrics }, inflight);
  };
  return { failures, metrics, submit };
};
