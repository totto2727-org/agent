import {
  isRecord,
  matchesBoolean,
  matchesNumber,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";
import { MAXIMUM_LITERAL_LENGTH, rejectWith, validContextEntries } from "./ste-validation.mjs";

/** @typedef {import("./ste-validation.mjs").ErrorConstructor} ErrorConstructor */
/** @typedef {import("./ste-validation.mjs").Reject} Reject */

const supportedIssue = 9;
const maximumVocabularyEntries = 20_000;
const maximumTokenLength = 128;
const maximumInflectedForms = 100;
const maximumNounCategory = 22;
const maximumVerbCategory = 4;
const emptyLength = 0;

/** @typedef {{ approved: boolean, forms?: string[], meaning: string, partOfSpeech: string, word: string }} VocabularyEntry */
/** @typedef {{ category: number, kind: "noun" | "verb", source: string, text: string }} TechnicalTerm */
/** @typedef {{ entries: VocabularyEntry[], issue: number, source: string, technicalTerms?: Array<string | TechnicalTerm> }} Vocabulary */

const minimumTermCategory = 1;
const vocabularyKeys = new Set(["issue", "source", "entries", "technicalTerms"]);
const entryKeys = new Set(["word", "forms", "approved", "partOfSpeech", "meaning"]);
const technicalTermKeys = new Set(["text", "kind", "category", "source"]);
const tokenPattern = /^[\p{L}\p{N}]+(?:[-' ][\p{L}\p{N}]+)*$/u;

/** @type {(value: unknown) => boolean} */
const validToken = (value) =>
  matchesString(value) && value.length <= maximumTokenLength && tokenPattern.test(value);

/** @type {(value: unknown) => boolean} */
const hasMeaningfulText = (value) => matchesString(value) && value.trim().length > emptyLength;

/** @type {(value: unknown) => boolean} */
const validForms = (value) =>
  matchesUndefined(value) ||
  (Array.isArray(value) &&
    value.length <= maximumInflectedForms &&
    value.every((entry) => validToken(entry)));

/** @type {(value: unknown) => boolean} */
const validDictionaryEntry = (value) => {
  if (!isRecord(value) || Object.keys(value).some((key) => !entryKeys.has(key))) {
    return false;
  }
  return (
    validToken(value.word) &&
    matchesBoolean(value.approved) &&
    hasMeaningfulText(value.partOfSpeech) &&
    hasMeaningfulText(value.meaning) &&
    validForms(value.forms)
  );
};

/** @type {(value: unknown) => boolean} */
const technicalLiteral = (value) =>
  matchesString(value) &&
  value.length > emptyLength &&
  value.length <= MAXIMUM_LITERAL_LENGTH &&
  value.trim() === value &&
  tokenPattern.test(value);

/** @type {(value: unknown) => boolean} */
const validStructuredTerm = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !technicalTermKeys.has(key)) ||
    !technicalLiteral(value.text)
  ) {
    return false;
  }
  const { kind, category, source } = value;
  if (kind !== "noun" && kind !== "verb") {
    return false;
  }
  const maxCategory = kind === "noun" ? maximumNounCategory : maximumVerbCategory;
  return (
    matchesNumber(category) &&
    Number.isInteger(category) &&
    category >= minimumTermCategory &&
    category <= maxCategory &&
    matchesString(source) &&
    source.trim().length > emptyLength &&
    source.length <= MAXIMUM_LITERAL_LENGTH
  );
};

/** @type {(value: unknown, reject: Reject) => Record<string, unknown>} */
const vocabularyRecord = (value, reject) => {
  if (!isRecord(value) || Object.keys(value).some((key) => !vocabularyKeys.has(key))) {
    return reject("must contain issue, source, entries and optional technicalTerms");
  }
  if (value.issue !== supportedIssue || !hasMeaningfulText(value.source)) {
    return reject("requires issue 9 and declared source provenance");
  }
  return value;
};

/** @type {(entries: unknown, reject: Reject) => void} */
const validateEntries = (entries, reject) => {
  if (
    !Array.isArray(entries) ||
    entries.length === emptyLength ||
    entries.length > maximumVocabularyEntries
  ) {
    reject("entries must contain 1 through 20000 records");
    return;
  }
  /** @type {unknown[]} */
  const vocabularyEntries = entries;
  Iterator.from(vocabularyEntries).forEach((entry) => {
    if (!validDictionaryEntry(entry)) {
      reject(
        "invalid dictionary record: declare word, approved, partOfSpeech, meaning and optional exact forms",
      );
    }
  });
};

/** @type {(terms: unknown, reject: Reject) => void} */
const validateTechnicalTerms = (terms, reject) => {
  if (
    !matchesUndefined(terms) &&
    !validContextEntries(terms, (term) =>
      matchesString(term) ? technicalLiteral(term) : validStructuredTerm(term),
    )
  ) {
    reject("invalid technicalTerms: use candidate literals or text/kind/category/source records");
  }
};

/**
 * @param {unknown} value - The contents of the private vocabulary file.
 * @param {string} label - Its location in the manifest.
 * @param {ErrorConstructor} [ErrorType] - The caller's validation error constructor.
 * @returns {Vocabulary} The vocabulary records and their declared source.
 */
export const validateSteVocabulary = (value, label, ErrorType = Error) => {
  const reject = rejectWith(label, ErrorType);
  const record = vocabularyRecord(value, reject);
  validateEntries(record.entries, reject);
  validateTechnicalTerms(record.technicalTerms, reject);
  return (
    // oxlint-disable-next-line eslint/no-inline-comments, typescript/no-unsafe-type-assertion -- The JSDoc assertion follows field validation and retains the original vocabulary object.
    /** @type {Vocabulary} */ (record)
  );
};
