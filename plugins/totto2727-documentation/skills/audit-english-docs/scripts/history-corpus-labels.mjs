// oxlint-disable-next-line rules/no-node-imports -- Validate sample paths using the installed Node CLI's filesystem semantics.
import path from "node:path";
import { object } from "./evaluation-validation.mjs";
import {
  hasObjectType,
  matchesNull,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

const minimumTextLength = 1;
const firstSourceLine = 1;
export const noEntries = 0;
export const defaultThreshold = 0.8;
export const corpusVersion = 1;

/** @type {(condition: boolean, message: string) => asserts condition} */
export const requireValue = function (condition, message) {
  if (!condition) {
    // oxlint-disable-next-line rules/require-tagged-error -- The standalone corpus API reports validation failures with the existing native Error type.
    throw new Error(message);
  }
};

/** @type {(value: unknown) => value is string} */
export const nonempty = function (value) {
  return matchesString(value) && value.trim().length >= minimumTextLength;
};

/** @type {(entries: unknown[]) => boolean} */
export const hasEntries = (entries) => entries.length > noEntries;

/** @type {(value: unknown) => Record<string, unknown> | undefined} */
export const asRecord = (value) =>
  !matchesNull(value) && hasObjectType(value) && !Array.isArray(value)
    ? object(value, "Corpus data")
    : undefined;

/** @type {(value: unknown) => unknown[] | undefined} */
export const asArray = (value) => (Array.isArray(value) ? value : undefined);

/** @type {(fields: Record<string, unknown>, key: string) => string} */
const readField = (fields, key) => {
  const value = fields[key];
  requireValue(nonempty(value), `Sample ${key} must be non-empty`);
  return value;
};

/** @typedef {"calibration" | "holdout"} CorpusSplit */
/** @typedef {"section" | "page"} RuleScope */
/** @typedef {{ ids: Set<string>, families: Map<string, CorpusSplit> }} CorpusGroups */

/**
 * @param {Record<string, unknown>} sample - One corpus entry.
 * @param {CorpusGroups} groups - IDs and families from preceding entries.
 * @returns {{ audience: string, family: string, id: string, path: string, purpose: string, split: CorpusSplit }} The validated sample identity.
 */
const readIdentity = (sample, { ids, families }) => {
  const [id, family, purpose, audience, sourcePath] = [
    "id",
    "family",
    "purpose",
    "audience",
    "path",
  ].map((field) => readField(sample, field));
  requireValue(!ids.has(id), `Duplicate sample id: ${id}`);
  ids.add(id);
  const { split } = sample;
  requireValue(split === "calibration" || split === "holdout", "Invalid sample split");
  requireValue(
    !families.has(family) || families.get(family) === split,
    `Family crosses calibration and holdout: ${family}`,
  );
  families.set(family, split);
  return { audience, family, id, path: sourcePath, purpose, split };
};

/** @type {(value: Record<string, unknown>, path: string) => { endLine: number, revision: string, startLine: number }} */
const readSource = (value, sourcePath) => {
  const { revision } = value;
  requireValue(
    matchesString(revision) && /^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(revision),
    "Each revision must be a full Git object ID",
  );
  requireValue(
    !path.isAbsolute(sourcePath) &&
      !sourcePath.includes("\0") &&
      !sourcePath.split("/").some((part) => part === ".." || part.length < minimumTextLength),
    "Sample path must be repository-relative without traversal",
  );
  const startLine = Number.isInteger(value.startLine) ? Number(value.startLine) : Number.NaN;
  const endLine = Number.isInteger(value.endLine) ? Number(value.endLine) : Number.NaN;
  requireValue(startLine >= firstSourceLine && endLine >= startLine, "Invalid source line range");
  return { endLine, revision, startLine };
};

/**
 * @param {Record<string, unknown>} sample - A corpus identity and source range.
 * @returns {{ expected: Record<string, unknown>, headingPath: string[] | undefined, ruleIds: string[] }} The validated label selection.
 */
const readLabels = (sample) => {
  const ruleIds = asArray(sample.ruleIds);
  requireValue(
    !matchesUndefined(ruleIds) &&
      hasEntries(ruleIds) &&
      ruleIds.every((entry) => nonempty(entry)) &&
      new Set(ruleIds).size === ruleIds.length,
    "Sample ruleIds must be unique non-empty strings",
  );
  const expected = asRecord(sample.expected);
  requireValue(
    !matchesUndefined(expected) &&
      Object.entries(expected).every(
        ([ruleId, label]) => ruleIds.includes(ruleId) && (label === "pass" || label === "fail"),
      ),
    "Expected labels must map selected rules to pass or fail",
  );
  const rawHeading = sample.headingPath;
  const headingPath = asArray(rawHeading);
  if (!matchesUndefined(rawHeading)) {
    requireValue(
      !matchesUndefined(headingPath) && headingPath.every((entry) => nonempty(entry)),
      "headingPath must be an array of non-empty strings",
    );
    return { expected, headingPath, ruleIds };
  }
  return { expected, headingPath: undefined, ruleIds };
};

/** @typedef {{ original: Record<string, unknown> } & ReturnType<typeof readIdentity> & ReturnType<typeof readSource> & ReturnType<typeof readLabels>} CorpusSample */
/** @type {(raw: unknown) => CorpusSample[]} */
export const validateSamples = (raw) => {
  const samples = asArray(raw) ?? asArray(asRecord(raw)?.samples);
  requireValue(!matchesUndefined(samples) && hasEntries(samples), "Corpus must contain samples");
  /** @type {CorpusGroups} */
  const groups = { families: new Map(), ids: new Set() };
  return samples.map((rawSample) => {
    const sample = asRecord(rawSample);
    requireValue(!matchesUndefined(sample), "Each sample must be an object");
    const identity = readIdentity(sample, groups);
    const source = readSource(sample, identity.path);
    return Object.assign(identity, source, readLabels(sample), { original: sample });
  });
};
