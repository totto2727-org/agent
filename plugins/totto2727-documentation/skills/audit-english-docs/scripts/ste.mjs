import { isRecord, matchesBoolean, matchesString, matchesUndefined } from "./native-predicates.mjs";

// Source: ASD-STE100 Issue 9, rules 5.1, 6.3, 6.6 and section 8.
// This is a bounded prose parser, not a grammar, typography or dictionary oracle.
const GROUP_CATEGORIES = [
  "number",
  "measurement",
  "abbreviation",
  "identifier",
  "quoted",
  "title",
  "proper-noun",
  "formula",
];
const supportedIssue = 9;
const maximumLiteralLength = 512;
const firstPrintableCodePoint = 32;
const maximumContextEntries = 1000;
const maximumVocabularyEntries = 20_000;
const maximumTokenLength = 128;
const maximumInflectedForms = 100;
const maximumNounCategory = 22;
const maximumVerbCategory = 4;

/** @typedef {{ kind: "new-technical" | "multi-word" | "official", source: string, text: string }} DeclaredNounGroup */
/** @typedef {Omit<ProseContext, "fragment"> & { nounGroups?: DeclaredNounGroup[], vocabularyFile?: string }} SteContext */
/** @typedef {new (message: string) => Error} ErrorConstructor */

const emptyLength = 0;
const textStart = 0;
const unitPattern = /^[\p{L}°µμΩ%/]+(?: [\p{L}°µμΩ%/]+)*$/u;
const contextKeys = [
  "writingMode",
  "wordGroups",
  "measurementUnits",
  "vocabularyFile",
  "nounGroups",
];
const nounKinds = ["new-technical", "multi-word", "official"];

/** @type {(value: unknown) => boolean} */
const isContextLiteral = (value) =>
  matchesString(value) &&
  value.trim() === value &&
  value.length > emptyLength &&
  value.length <= maximumLiteralLength &&
  !Array.from(value).some(
    (character) => character.codePointAt(textStart) < firstPrintableCodePoint,
  );

/** @type {(value: unknown) => boolean} */
const validWordGroup = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["text", "category"].includes(key)) ||
    !isContextLiteral(value.text)
  ) {
    return false;
  }
  const { category } = value;
  return matchesString(category) && GROUP_CATEGORIES.includes(category);
};

/** @type {(value: unknown) => boolean} */
const validMeasurementUnit = (value) =>
  matchesString(value) && isContextLiteral(value) && unitPattern.test(value);

/** @type {(value: unknown) => boolean} */
const validNounGroup = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["text", "kind", "source"].includes(key)) ||
    !isContextLiteral(value.text)
  ) {
    return false;
  }
  const { kind } = value;
  return matchesString(kind) && nounKinds.includes(kind) && isContextLiteral(value.source);
};

/** @type {(value: unknown, valid: (entry: unknown) => boolean) => boolean} */
const validContextEntries = (value, valid) =>
  Array.isArray(value) && value.length <= maximumContextEntries && value.every(valid);

/** @type {(label: string, ErrorType: ErrorConstructor) => (message: string) => never} */
const rejectWith = (label, ErrorType) => (message) => {
  throw new ErrorType(`${label}: ${message}`);
};

/**
 * @param {unknown} value - The manifest's language declarations.
 * @param {string} label - Their location in the manifest.
 * @param {ErrorConstructor} [ErrorType] - The caller's validation error constructor.
 * @returns {SteContext | undefined} The validated optional context.
 */
export const validateSteContext = (value, label, ErrorType = Error) => {
  if (matchesUndefined(value)) {
    return undefined;
  }
  /** @type {(message: string) => never} */
  const reject = rejectWith(label, ErrorType);
  if (!isRecord(value)) {
    reject("must be an object");
  }
  if (Object.keys(value).some((key) => !contextKeys.includes(key))) {
    reject("unexpected parameter");
  }
  const { measurementUnits, nounGroups, vocabularyFile, wordGroups, writingMode } = value;
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
  if (!matchesUndefined(vocabularyFile) && !isContextLiteral(vocabularyFile)) {
    reject("vocabularyFile must be a non-empty local path");
  }
  if (!matchesUndefined(nounGroups) && !validContextEntries(nounGroups, validNounGroup)) {
    reject(
      "nounGroups must contain at most 1000 literal text/kind/source records, never submitted counts",
    );
  }
  return { ...value };
};

// Section 2.2 counts hyphenated noun tokens as one word while limiting newly
// Made hyphen groups to three components. This does not identify noun roles.
/**
 * @param {string} text - A declared noun group.
 * @returns {{ hyphenComponentCounts: number[], wordCount: number } | null} Counts for forms the bounded tokenizer recognizes.
 */
export function countDeclaredNounGroup(text) {
  if (!/^[A-Za-z]+(?:-[A-Za-z]+)*(?: [A-Za-z]+(?:-[A-Za-z]+)*)*$/u.test(text)) {
    return null;
  }
  const words = text.split(" ");
  return {
    wordCount: words.length,
    hyphenComponentCounts: words.map((word) => word.split("-").length),
  };
}

/** @typedef {{ approved: boolean, forms?: string[], meaning: string, partOfSpeech: string, word: string }} VocabularyEntry */
/** @typedef {{ category: number, kind: "noun" | "verb", source: string, text: string }} TechnicalTerm */
/** @typedef {{ entries: VocabularyEntry[], issue: number, source: string, technicalTerms?: Array<string | TechnicalTerm> }} Vocabulary */

const minimumTermCategory = 1;
const vocabularyKeys = ["issue", "source", "entries", "technicalTerms"];
const entryKeys = ["word", "forms", "approved", "partOfSpeech", "meaning"];
const technicalTermKeys = ["text", "kind", "category", "source"];
const tokenPattern = /^[\p{L}\p{N}]+(?:[-' ][\p{L}\p{N}]+)*$/u;

/** @type {(value: unknown) => boolean} */
const validToken = (value) =>
  matchesString(value) && value.length <= maximumTokenLength && tokenPattern.test(value);

/** @type {(value: unknown) => boolean} */
const hasMeaningfulText = (value) => matchesString(value) && value.trim().length > emptyLength;

/** @type {(value: unknown) => boolean} */
const validForms = (value) =>
  matchesUndefined(value) ||
  (Array.isArray(value) && value.length <= maximumInflectedForms && value.every(validToken));

/** @type {(value: unknown) => boolean} */
const validDictionaryEntry = (value) => {
  if (!isRecord(value) || Object.keys(value).some((key) => !entryKeys.includes(key))) {
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
  value.length <= maximumLiteralLength &&
  value.trim() === value &&
  tokenPattern.test(value);

/** @type {(value: unknown) => boolean} */
const validStructuredTerm = (value) => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !technicalTermKeys.includes(key)) ||
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
    typeof category === "number" &&
    Number.isInteger(category) &&
    category >= minimumTermCategory &&
    category <= maxCategory &&
    matchesString(source) &&
    source.trim().length > emptyLength &&
    source.length <= maximumLiteralLength
  );
};

/**
 * @param {unknown} value - The contents of the private vocabulary file.
 * @param {string} label - Its location in the manifest.
 * @param {ErrorConstructor} [ErrorType] - The caller's validation error constructor.
 * @returns {Vocabulary} The vocabulary records and their declared source.
 */
export const validateSteVocabulary = (value, label, ErrorType = Error) => {
  /** @type {(message: string) => never} */
  const reject = rejectWith(label, ErrorType);
  if (!isRecord(value) || Object.keys(value).some((key) => !vocabularyKeys.includes(key))) {
    reject("must contain issue, source, entries and optional technicalTerms");
  }
  if (value.issue !== supportedIssue || !hasMeaningfulText(value.source)) {
    reject("requires issue 9 and declared source provenance");
  }
  const { entries } = value;
  if (
    !Array.isArray(entries) ||
    entries.length === emptyLength ||
    entries.length > maximumVocabularyEntries
  ) {
    reject("entries must contain 1 through 20000 records");
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
  const { technicalTerms } = value;
  if (
    !matchesUndefined(technicalTerms) &&
    !validContextEntries(technicalTerms, (term) =>
      matchesString(term) ? technicalLiteral(term) : validStructuredTerm(term),
    )
  ) {
    reject("invalid technicalTerms: use candidate literals or text/kind/category/source records");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- All vocabulary fields and records are validated above without replacing the input object.
  return /** @type {Vocabulary} */ (value);
};

/** @typedef {{ end: number, parenthetical?: boolean, start: number, wordCount: number }} CountedSentence */
/** @typedef {{ end: number, reason: string, start: number }} ProseWarning */
/** @typedef {{ category: string, text: string }} DeclaredWordGroup */
/** @typedef {{ fragment?: boolean, measurementUnits?: string[], wordGroups?: DeclaredWordGroup[], writingMode?: "procedural" | "descriptive" }} ProseContext */

// Edits preserve source offsets. A group becomes one artificial lowercase word.
/** @type {(characters: string[], start: number, end: number) => void} */
const collapse = function (characters, start, end) {
  for (let index = start; index < end; index += 1) {
    if (!/[\r\n]/u.test(characters[index])) {
      characters[index] = index === start ? "x" : " ";
    }
  }
};
/** @type {(text: string, index: number) => boolean} */
const boundary = function (text, index) {
  return index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
};

/**
 * @param {string} text - The source prose to count.
 * @param {ProseContext} [context] - The declarations that apply to this span.
 * @param {{ paragraph?: boolean }} [options] - Whether to use paragraph counting.
 * @returns {{ paragraphSentences: number, sentences: CountedSentence[], warnings: ProseWarning[] }} Counts and unresolved source spans.
 */
export function analyzeSteProse(text, context = {}, { paragraph = false } = {}) {
  /** @type {ProseWarning[]} */
  const warnings = [];
  /** @type {(reason: string, start?: number, end?: number) => number} */
  const warn = (reason, start = 0, end = text.length) => warnings.push({ reason, start, end });
  const characters = text.split("");
  const label =
    context.writingMode === "procedural"
      ? /^\s*(?:WARNING|CAUTION|DANGER):[ \t]*/u.exec(text)
      : /^\s*(?:NOTE|NOTES):[ \t]*/u.exec(text);
  if (label) {
    for (let index = 0; index < label[0].length; index += 1) {
      if (!/[\r\n]/u.test(characters[index])) {
        characters[index] = " ";
      }
    }
  }
  // Section 8.6 excludes document/work-step numbering, not ordinary identifiers.
  if (context.writingMode === "procedural") {
    Iterator.from(text.matchAll(/^(?:\(\d+\)|[A-Z][.)])\s+/gm)).forEach((match) => {
      for (let { index } = match; index < match.index + match[0].length; index += 1) {
        if (!/[\r\n]/u.test(characters[index])) {
          characters[index] = " ";
        }
      }
    });
  }
  /** @type {CountedSentence[]} */
  const extraSentences = [];
  const groups = [...(context.wordGroups ?? [])].sort(
    (left, right) => right.text.length - left.text.length,
  );
  Iterator.from(groups).forEach((group) => {
    let at = 0;
    while ((at = characters.join("").indexOf(group.text, at)) !== -1) {
      if (boundary(text, at - 1) && boundary(text, at + group.text.length)) {
        collapse(characters, at, at + group.text.length);
      }
      at += group.text.length;
    }
  });
  // Quoted text, including its punctuation, is one word, not new sentences.
  Iterator.from(characters.join("").matchAll(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g)).forEach((match) => {
    collapse(characters, match.index, match.index + match[0].length);
  });
  if (/["“”‘’]/.test(characters.join(""))) {
    warn("Unbalanced quotation marks require contextual parsing.");
  }
  let current = characters.join("");
  if (/\([^()]*\([^)]*\)/.test(current)) {
    warn("Nested parentheses require contextual parsing.");
  }
  Iterator.from(current.matchAll(/\([^()]*\)/g)).forEach((match) => {
    const inner = match[0].slice(1, -1);
    const identifier = /^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$/u.test(inner);
    const attached = match.index > 0 && /[\p{L}\p{N}]/u.test(current[match.index - 1]);
    if (attached) {
      warn(
        "Attached singular/plural parentheses require contextual counting.",
        match.index,
        match.index + match[0].length,
      );
      return;
    }
    if (!identifier) {
      if (paragraph) {
        warn(
          "Parenthetical prose has a separate word-count sentence, but its paragraph sentence boundary requires review.",
          match.index,
          match.index + match[0].length,
        );
      }
      const analysis = analyzeSteProse(inner, { ...context, fragment: true });
      warnings.push(
        ...analysis.warnings.map((warning) => ({
          ...warning,
          start: warning.start + match.index + 1,
          end: warning.end + match.index + 1,
        })),
      );
      extraSentences.push(
        ...analysis.sentences.map((sentence) => ({
          ...sentence,
          start: sentence.start + match.index + 1,
          end: sentence.end + match.index + 1,
          parenthetical: true,
        })),
      );
    }
    collapse(characters, match.index, match.index + match[0].length);
  });
  current = characters.join("");
  if (/[()]/u.test(current)) {
    warn("Unbalanced or nested parentheses require contextual parsing.");
  }
  // These abbreviations and compounds are explicitly illustrated in section 8.6.
  Iterator.from(
    current.matchAll(/\b(?:No\.\s+\d[\w-]*|\d+(?:\.\d+)?\s+(?:a\.m\.|p\.m\.))(?=\s|[,.!?]|$)/g),
  ).forEach((match) => {
    collapse(characters, match.index, match.index + match[0].length);
    if (match[0].endsWith(".") && !current.slice(match.index + match[0].length).trim()) {
      characters[match.index + match[0].length - 1] = ".";
    }
  });
  const units = [
    ...new Set([
      "mm",
      "mA",
      "°C",
      "degrees Celsius",
      "kg",
      "kilograms",
      "ohms",
      "Ω",
      ...(context.measurementUnits ?? []),
    ]),
  ].sort((left, right) => right.length - left.length);
  current = characters.join("");
  Iterator.from(current.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g)).forEach((match) => {
    if (!boundary(current, match.index - 1) || !boundary(current, match.index + match[0].length)) {
      return;
    }
    const tail = current.slice(match.index + match[0].length);
    const gap = /^\s+/u.exec(tail)?.[0] ?? "";
    const unit = units.find(
      (candidate) =>
        tail.slice(gap.length).startsWith(candidate) &&
        boundary(tail, gap.length + candidate.length),
    );
    if (unit && gap) {
      collapse(characters, match.index, match.index + match[0].length + gap.length + unit.length);
    } else {
      collapse(characters, match.index, match.index + match[0].length);
      if (!paragraph && /^\s+[\p{L}°µμΩ%]/u.test(tail)) {
        warn(
          "A number followed by an undeclared word can be a measurement or identifier; declare the literal group or measurement unit.",
          match.index,
          match.index + match[0].length + gap.length,
        );
      }
    }
  });
  current = characters.join("");
  if (!paragraph && /\b(?:hundred|thousand|million|billion)\b/i.test(current)) {
    warn("Multi-word written numbers require a declared number group.");
  }
  if (/\b[\p{L}]+\.(?=[\p{L}]|\s+[a-z])/u.test(current)) {
    warn("A period can be an abbreviation boundary; declare abbreviations before counting.");
  }
  if (/\.{2,}|[!?]{2,}/u.test(current)) {
    warn("Ellipsis or repeated sentence punctuation requires review.");
  }
  if (/--|\s-\s/u.test(current)) {
    warn("A dash or compound token with repeated hyphens requires contextual counting.");
  }
  if (
    [...current].some(
      (character) => "`*_[]<>\\|{}=+/".includes(character) || character.codePointAt(0) > 127,
    )
  ) {
    warn("Unsupported markup, formula, or punctuation requires contextual counting.");
  }
  if (/:/u.test(current)) {
    warn(
      "A colon outside a recognized vertical-list introduction requires contextual sentence parsing.",
    );
  }
  if (/\b(?:NOTE|NOTES)\b/u.test(current) && context.writingMode === "procedural") {
    warn("Notes in procedures use descriptive limits; supply a descriptive local target.");
  }
  /** @type {CountedSentence[]} */
  const sentences = [];
  let start = 0;
  /** @type {(end: number) => void} */
  const flush = (end) => {
    const body = current.slice(start, end);
    const tokens = [...body.matchAll(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)];
    if (tokens.length) {
      for (let index = 0; index < tokens.length; index += 1) {
        if (
          !paragraph &&
          /[A-Z]/u.test(tokens[index][0]) &&
          (index !== 0 || /^[A-Z0-9-]+$/u.test(tokens[index][0]))
        ) {
          warn(
            "Capitalized or uppercase text can be an unmarked title, proper noun, label or abbreviation; declare its word group.",
            start + tokens[index].index,
            start + tokens[index].index + tokens[index][0].length,
          );
        }
      }
      sentences.push({ start: start + tokens[0].index, end, wordCount: tokens.length });
    }
    start = end;
  };
  Iterator.from(current.matchAll(/[.!?]/g)).forEach((match) => {
    flush(match.index + 1);
  });
  if (current.slice(start).trim()) {
    const unfinishedStart = start;
    flush(current.length);
    if (!context.fragment) {
      warn(
        "Unterminated prose may be a fragment or incomplete sentence.",
        unfinishedStart,
        current.length,
      );
    }
  }
  return {
    sentences: [...sentences, ...extraSentences],
    paragraphSentences: sentences.length,
    warnings,
  };
}
