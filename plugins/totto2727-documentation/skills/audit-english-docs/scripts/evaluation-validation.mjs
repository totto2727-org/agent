import { isRecord, matchesString } from "./native-predicates.mjs";

const kibibyte = 1024;
const maxEvidenceKibibytes = 48;
export const MAX_EVIDENCE_BYTES = maxEvidenceKibibytes * kibibyte;

// oxlint-disable-next-line rules/require-tagged-error, unicorn/custom-error-definition -- Preserve the exported constructor and native Error name in the standalone CLI without dependencies.
export class EvaluationError extends Error {}

/** @type {(value: unknown, label: string, message?: string) => Record<string, unknown>} */
export const object = (value, label, message = `${label} must be an object`) => {
  if (!isRecord(value)) {
    throw new EvaluationError(message);
  }
  return value;
};

/** @type {(value: unknown, label: string) => string} */
export const text = (value, label) => {
  if (!matchesString(value) || !value.trim()) {
    throw new EvaluationError(`${label} must be a non-empty string`);
  }
  return value;
};

/** @type {(value: string, label: string) => string} */
export const bounded = (value, label) => {
  if (Buffer.byteLength(value, "utf8") > MAX_EVIDENCE_BYTES) {
    throw new EvaluationError(`${label} exceeds ${MAX_EVIDENCE_BYTES} bytes`);
  }
  return value;
};

/** @type {(failure: unknown) => string} */
export const failureMessage = (failure) =>
  // oxlint-disable-next-line rules/no-instanceof-error -- The standalone CLI preserves native Error messages without repository dependencies.
  failure instanceof Error ? failure.message : "Evaluation failed";
