import { bounded, EvaluationError, object } from "./evaluation-validation.mjs";
import {
  hasObjectType,
  matchesBoolean,
  matchesNull,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

const maximumMetadataDepth = 8;
const rootMetadataDepth = 0;
const oneLevel = 1;

/** @type {(value: unknown, label: string) => string[]} */
export const constraints = (value, label) => {
  if (matchesUndefined(value)) {
    return [];
  }
  const message = `${label} must be an array of non-empty strings`;
  if (!Array.isArray(value)) {
    throw new EvaluationError(message);
  }
  /** @type {unknown[]} */
  const entries = value;
  if (!entries.every((entry) => matchesString(entry)) || entries.some((entry) => !entry.trim())) {
    throw new EvaluationError(message);
  }
  bounded(JSON.stringify(value), label);
  return entries;
};

/** @type {(entry: unknown, depth: number, label: string) => void} */
const validateMetadata = (entry, depth, label) => {
  if (depth > maximumMetadataDepth) {
    throw new EvaluationError(`${label} metadata is too deeply nested`);
  }
  if (
    matchesNull(entry) ||
    matchesString(entry) ||
    matchesBoolean(entry) ||
    Number.isFinite(entry)
  ) {
    return;
  }
  if (
    !hasObjectType(entry) ||
    (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype)
  ) {
    throw new EvaluationError(`${label} must be plain JSON metadata`);
  }
  Object.values(entry).forEach((child) => {
    validateMetadata(child, depth + oneLevel, label);
  });
};

/** @type {(value: unknown, label: string) => Record<string, unknown> | undefined} */
export const provenance = (value, label) => {
  if (matchesUndefined(value)) {
    return value;
  }
  const record = object(value, label);
  validateMetadata(record, rootMetadataDepth, label);
  bounded(JSON.stringify(record), label);
  return record;
};

/** @type {(id: string, names: Set<string>, kind: "rule" | "document") => void} */
export const registerId = (id, names, kind) => {
  if (names.has(id)) {
    throw new EvaluationError(`Duplicate ${kind} id: ${id}`);
  }
  names.add(id);
};
