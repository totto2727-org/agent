import { hasObjectType, matchesNull, matchesString } from "./native-predicates.mjs";

const kibibyte = 1_024;
const maxEvidenceKibibytes = 48;
export const MAX_EVIDENCE_BYTES = maxEvidenceKibibytes * kibibyte;

// oxlint-disable-next-line rules/require-tagged-error -- Preserve the native error type for the installed CLI without dependencies.
export class EvaluationError extends Error {}

/** @type {(value: unknown, label: string) => Record<string, unknown>} */
export const object = (value, label) => {
  if (!hasObjectType(value) || matchesNull(value) || Array.isArray(value)) {
    throw new EvaluationError(`${label} must be an object`);
  }
  return /** @type {Record<string, unknown>} */ (value);
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
