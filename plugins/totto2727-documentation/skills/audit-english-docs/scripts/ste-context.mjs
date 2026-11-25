import { isRecord, matchesString, matchesUndefined } from "./native-predicates.mjs";
import { MAXIMUM_LITERAL_LENGTH, rejectWith, validContextEntries } from "./ste-validation.mjs";

/** @typedef {{ kind: "new-technical" | "multi-word" | "official", source: string, text: string }} DeclaredNounGroup */
/** @typedef {Omit<import("./ste.mjs").ProseContext, "fragment"> & { nounGroups?: DeclaredNounGroup[], vocabularyFile?: string }} SteContext */
/** @typedef {import("./ste-validation.mjs").ErrorConstructor} ErrorConstructor */
/** @typedef {import("./ste-validation.mjs").Reject} Reject */

const GROUP_CATEGORIES = new Set([
  "number",
  "measurement",
  "abbreviation",
  "identifier",
  "quoted",
  "title",
  "proper-noun",
  "formula",
]);
const WORD_GROUP_KEYS = new Set(["text", "category"]);
const CONTEXT_KEYS = new Set([
  "writingMode",
  "wordGroups",
  "measurementUnits",
  "vocabularyFile",
  "nounGroups",
]);
const NOUN_KINDS = new Set(["new-technical", "multi-word", "official"]);
const NOUN_GROUP_KEYS = new Set(["text", "kind", "source"]);
const FIRST_PRINTABLE_CODE_POINT = 32;
const FIRST_CHARACTER = 0;
const EMPTY_LENGTH = 0;
const UNIT_PATTERN = /^[\p{L}°µμΩ%/]+(?: [\p{L}°µμΩ%/]+)*$/u;
const NO_CONTEXT = undefined;
// oxlint-disable-next-line unicorn/no-null -- Unsupported noun forms retain the existing absent-count sentinel.
const NO_COUNTS = null;

/** @type {(value: unknown) => boolean} */
const isContextLiteral = (value) =>
  matchesString(value) &&
  value.trim() === value &&
  value.length > EMPTY_LENGTH &&
  value.length <= MAXIMUM_LITERAL_LENGTH &&
  !Iterator.from(value).some(
    (character) =>
      (character.codePointAt(FIRST_CHARACTER) ?? FIRST_PRINTABLE_CODE_POINT) <
      FIRST_PRINTABLE_CODE_POINT,
  );

/** @type {(value: unknown) => boolean} */
const validWordGroup = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !WORD_GROUP_KEYS.has(key)) ||
    !isContextLiteral(value.text)
  ) {
    return false;
  }
  const { category } = value;
  return matchesString(category) && GROUP_CATEGORIES.has(category);
};

/** @type {(value: unknown) => boolean} */
const validMeasurementUnit = (value) =>
  matchesString(value) && isContextLiteral(value) && UNIT_PATTERN.test(value);

/** @type {(value: unknown) => boolean} */
const validNounGroup = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !NOUN_GROUP_KEYS.has(key)) ||
    !isContextLiteral(value.text)
  ) {
    return false;
  }
  const { kind } = value;
  return matchesString(kind) && NOUN_KINDS.has(kind) && isContextLiteral(value.source);
};

/** @type {(context: Record<string, unknown>, reject: Reject) => void} */
const validateProseSettings = ({ measurementUnits, wordGroups, writingMode }, reject) => {
  if (
    !matchesUndefined(writingMode) &&
    writingMode !== "procedural" &&
    writingMode !== "descriptive"
  ) {
    reject("writingMode must be procedural or descriptive");
  }
  if (!matchesUndefined(wordGroups) && !validContextEntries(wordGroups, validWordGroup)) {
    reject("wordGroups must contain at most 1000 literal text/category records");
  }
  if (
    !matchesUndefined(measurementUnits) &&
    !validContextEntries(measurementUnits, validMeasurementUnit)
  ) {
    reject("measurementUnits must contain at most 1000 literal units");
  }
};

/** @type {(vocabularyFile: unknown, nounGroups: unknown, reject: Reject) => void} */
const validatePrivateSettings = (vocabularyFile, nounGroups, reject) => {
  if (!matchesUndefined(vocabularyFile) && !isContextLiteral(vocabularyFile)) {
    reject("vocabularyFile must be a non-empty local path");
  }
  if (!matchesUndefined(nounGroups) && !validContextEntries(nounGroups, validNounGroup)) {
    reject(
      "nounGroups must contain at most 1000 literal text/kind/source records, never submitted counts",
    );
  }
};

/** @type {(value: unknown, reject: Reject) => Record<string, unknown>} */
const contextRecord = (value, reject) => {
  if (!isRecord(value)) {
    return reject("must be an object");
  }
  if (Object.keys(value).some((key) => !CONTEXT_KEYS.has(key))) {
    return reject("unexpected parameter");
  }
  return value;
};

/**
 * @param {unknown} value - The manifest's language declarations.
 * @param {string} label - Their location in the manifest.
 * @param {ErrorConstructor} [ErrorType] - The caller's validation error constructor.
 * @returns {SteContext | undefined} The validated optional context.
 */
export const validateSteContext = (value, label, ErrorType = Error) => {
  if (matchesUndefined(value)) {
    return NO_CONTEXT;
  }
  const reject = rejectWith(label, ErrorType);
  const context = contextRecord(value, reject);
  // Preserve the validation order and the original declarations in returned report metadata.
  const { measurementUnits, nounGroups, vocabularyFile, wordGroups, writingMode } = context;
  validateProseSettings({ measurementUnits, wordGroups, writingMode }, reject);
  validatePrivateSettings(vocabularyFile, nounGroups, reject);
  return { ...context };
};

// Section 2.2 counts hyphenated noun tokens as one word and limits newly made hyphen groups.
/**
 * @param {string} text - A declared noun group.
 * @returns {{ hyphenComponentCounts: number[], wordCount: number } | null} Counts for forms the bounded tokenizer recognizes.
 */
export const countDeclaredNounGroup = function countDeclaredNounGroup(text) {
  if (!/^[A-Za-z]+(?:-[A-Za-z]+)*(?: [A-Za-z]+(?:-[A-Za-z]+)*)*$/u.test(text)) {
    return NO_COUNTS;
  }
  const words = text.split(" ");
  // oxlint-disable-next-line eslint/sort-keys -- Keep the public noun count property order used in report and cache evidence.
  return {
    wordCount: words.length,
    hyphenComponentCounts: words.map((word) => word.split("-").length),
  };
};
