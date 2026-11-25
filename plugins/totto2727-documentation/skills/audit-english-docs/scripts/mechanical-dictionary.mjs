import { sourceRange } from "./mechanical-source-range.mjs";
import {
  hasObjectType,
  isEmptyString,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

/** @typedef {import("./mechanical.mjs").LexicalCandidate} LexicalCandidate */
/** @typedef {import("./mechanical.mjs").Vocabulary} Vocabulary */
/** @typedef {import("./mechanical.mjs").VocabularyEntry} VocabularyEntry */
/** @typedef {import("./mechanical.mjs").TechnicalTerm} TechnicalTerm */
/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {{ markdown: string, range: SourceRange, start: number, text: string }} DictionaryInput */
/** @typedef {{ lexicalCandidates: LexicalCandidate[], warning: (reason: string, range?: SourceRange) => void }} DictionaryEvidence */
/** @typedef {{ entries: Map<string, VocabularyEntry[]>, forms: string[], technical: Array<TechnicalTerm | string> }} DictionaryIndex */

const TEXT_START = 0;
const NO_FORM = undefined;
const WORD_CONTINUATION = /[\p{L}\p{N}_'-]/u;
const TOKEN = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
const NUMERIC_TOKEN = /^[0-9]+$/u;

/** @type {(entry: VocabularyEntry) => string[]} */
const entryForms = (entry) => [entry.word, ...(entry.forms ?? [])];

/** @type {(term: TechnicalTerm | string) => string} */
const technicalForm = (term) => (matchesString(term) ? term : term.text);

/** @type {(vocabulary: Vocabulary) => DictionaryIndex} */
const wordIndex = (vocabulary) => {
  /** @type {Map<string, VocabularyEntry[]>} */
  const entries = new Map();
  Iterator.from(vocabulary.entries).forEach((entry) => {
    entryForms(entry).forEach((form) => {
      const key = form.toLowerCase();
      entries.set(key, [...(entries.get(key) ?? []), entry]);
    });
  });
  const technical = vocabulary.technicalTerms ?? [];
  const forms = [
    ...new Set([...entries.keys(), ...technical.map((term) => technicalForm(term).toLowerCase())]),
  ].toSorted((left, right) => right.length - left.length);
  return { entries, forms, technical };
};

/** @type {(entries: VocabularyEntry[]) => LexicalCandidate["membership"]} */
const membership = (entries) => {
  if (entries.some((entry) => entry.approved)) {
    return "approved-form";
  }
  return entries.length ? "not-approved-entry" : "unlisted";
};

/** @type {(entry: VocabularyEntry, term: string) => LexicalCandidate["records"][number]} */
const matchingRecord = (entry, term) =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain the existing dictionary record order in evidence and cache inputs.
  ({
    word: entry.word,
    approved: entry.approved,
    partOfSpeech: entry.partOfSpeech,
    meaning: entry.meaning,
    listedForms: entryForms(entry).filter((listed) => listed.toLowerCase() === term.toLowerCase()),
  });

/** @type {(text: string, offset: number, forms: string[]) => string | undefined} */
const matchedForm = (text, offset, forms) =>
  forms.find(
    (candidate) =>
      text.slice(offset, offset + candidate.length).toLowerCase() === candidate &&
      !WORD_CONTINUATION.test(text[offset + candidate.length] ?? ""),
  );

/** @type {(index: DictionaryIndex, candidate: { term: string, form: string | undefined }, range: SourceRange) => LexicalCandidate} */
const lexicalCandidate = ({ entries, technical }, { form, term }, range) => {
  const records = matchesUndefined(form) ? [] : (entries.get(form) ?? []);
  const technicalMatches = technical.filter(
    (entry) => technicalForm(entry).toLowerCase() === term.toLowerCase(),
  );
  const technicalRecords = technicalMatches.filter((entry) => hasObjectType(entry));
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the evidence's public candidate field order.
  return {
    term,
    membership: membership(records),
    technicalTermCandidate: technicalMatches.length > TEXT_START,
    technicalRecords,
    records: records.map((entry) => matchingRecord(entry, term)),
    sourceRange: range,
  };
};

/** @type {(input: DictionaryInput, index: DictionaryIndex, lexicalCandidates: LexicalCandidate[]) => void} */
const collectCandidates = ({ markdown, start, text }, index, lexicalCandidates) => {
  const cursor = { consumed: TEXT_START };
  Iterator.from(text.matchAll(TOKEN)).forEach((match) => {
    if (match.index < cursor.consumed || NUMERIC_TOKEN.test(match[0])) {
      return;
    }
    const matchForm = matchedForm(text, match.index, index.forms);
    const form = matchesUndefined(matchForm) || isEmptyString(matchForm) ? NO_FORM : matchForm;
    const term = matchesUndefined(form)
      ? match[0]
      : text.slice(match.index, match.index + form.length);
    cursor.consumed = match.index + term.length;
    const range = sourceRange(markdown, start + match.index, start + cursor.consumed);
    lexicalCandidates.push(lexicalCandidate(index, { form, term }, range));
  });
};

/** @type {(input: DictionaryInput, vocabulary: Vocabulary | undefined, evidence: DictionaryEvidence) => void} */
export const checkDictionary = (input, vocabulary, { lexicalCandidates, warning }) => {
  if (!vocabulary) {
    warning(
      "No trustworthy private Issue 9 vocabulary data was supplied. Dictionary membership is unavailable, not a compliance pass.",
      input.range,
    );
    return;
  }
  collectCandidates(input, wordIndex(vocabulary), lexicalCandidates);
  warning(
    "Literal dictionary/inflection membership candidates do not establish contextual meaning, part of speech, or permitted technical noun/verb use (rules 1.1 through 1.4).",
    input.range,
  );
};
