/** @typedef {import("./ste.mjs").CountedSentence} CountedSentence */
/** @typedef {import("./ste-mask.mjs").Warn} Warn */
/** @typedef {{ fragment: boolean, paragraph: boolean, warn: Warn }} SentenceOptions */
/** @typedef {{ end: number, start: number }} SentenceSpan */

const FIRST_OFFSET = 0;
const AFTER_PUNCTUATION = 1;
const FIRST_TOKEN = 0;
const NO_SENTENCE = undefined;
const MAX_ASCII = 127;
const UNSUPPORTED = new Set("`*_[]<>\\|{}=+/");
const COUNTABLE_TOKEN = /[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/gu;
const CAPITALIZATION =
  "Capitalized or uppercase text can be an unmarked title, proper noun, label or abbreviation; declare its word group.";

/** @type {[RegExp, string][]} */
const PROSE_WARNINGS = [
  [
    /\b[\p{L}]+\.(?=[\p{L}]|\s+[a-z])/u,
    "A period can be an abbreviation boundary; declare abbreviations before counting.",
  ],
  [/\.{2,}|[!?]{2,}/u, "Ellipsis or repeated sentence punctuation requires review."],
  [/--|\s-\s/u, "A dash or compound token with repeated hyphens requires contextual counting."],
];

/** @type {(text: string, opts: { paragraph: boolean, procedural: boolean }, warn: Warn) => void} */
export const warnAboutProse = (text, { paragraph, procedural }, warn) => {
  // oxlint-disable-next-line eslint/require-unicode-regexp -- Preserve the existing ASCII case folding of these written English numbers.
  if (!paragraph && /\b(?:hundred|thousand|million|billion)\b/i.test(text)) {
    warn("Multi-word written numbers require a declared number group.");
  }
  PROSE_WARNINGS.forEach(([pattern, reason]) => {
    if (pattern.test(text)) {
      warn(reason);
    }
  });
  if (
    Iterator.from(text).some(
      (character) =>
        UNSUPPORTED.has(character) ||
        (character.codePointAt(FIRST_OFFSET) ?? FIRST_OFFSET) > MAX_ASCII,
    )
  ) {
    warn("Unsupported markup, formula, or punctuation requires contextual counting.");
  }
  if (/:/u.test(text)) {
    warn(
      "A colon outside a recognized vertical-list introduction requires contextual sentence parsing.",
    );
  }
  if (procedural && /\b(?:NOTE|NOTES)\b/u.test(text)) {
    warn("Notes in procedures use descriptive limits; supply a descriptive local target.");
  }
};

/** @type {(tokens: RegExpExecArray[], start: number, warn: Warn) => void} */
const warnAboutCapitalized = (tokens, start, warn) => {
  tokens.forEach((match, index) => {
    const [word] = match;
    if (/[A-Z]/u.test(word) && (index !== FIRST_TOKEN || /^[A-Z0-9-]+$/u.test(word))) {
      warn(CAPITALIZATION, start + match.index, start + match.index + word.length);
    }
  });
};

/** @type {(text: string, span: SentenceSpan, opts: SentenceOptions) => CountedSentence | undefined} */
const sentenceFor = (text, { end, start }, { paragraph, warn }) => {
  const tokens = [...text.slice(start, end).matchAll(COUNTABLE_TOKEN)];
  if (!tokens.length) {
    return NO_SENTENCE;
  }
  if (!paragraph) {
    warnAboutCapitalized(tokens, start, warn);
  }
  const [first] = tokens;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public sentence field order, including translated parenthetical offsets.
  return { start: start + first.index, end, wordCount: tokens.length };
};

/** @type {(text: string, options: SentenceOptions) => CountedSentence[]} */
export const countSentences = (text, options) => {
  /** @type {CountedSentence[]} */
  const sentences = [];
  const cursor = { start: FIRST_OFFSET };
  /** @type {(end: number) => void} */
  const flush = (end) => {
    const sentence = sentenceFor(text, { end, start: cursor.start }, options);
    if (sentence) {
      sentences.push(sentence);
    }
    cursor.start = end;
  };
  Iterator.from(text.matchAll(/[.!?]/gu)).forEach((match) => {
    flush(match.index + AFTER_PUNCTUATION);
  });
  if (text.slice(cursor.start).trim()) {
    const unfinishedStart = cursor.start;
    flush(text.length);
    if (!options.fragment) {
      options.warn(
        "Unterminated prose may be a fragment or incomplete sentence.",
        unfinishedStart,
        text.length,
      );
    }
  }
  return sentences;
};
