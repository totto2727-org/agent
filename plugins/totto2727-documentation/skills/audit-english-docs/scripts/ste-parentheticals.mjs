import { collapseWord } from "./ste-mask.mjs";

/** @typedef {import("./ste.mjs").ProseContext} ProseContext */
/** @typedef {import("./ste.mjs").ProseWarning} ProseWarning */
/** @typedef {import("./ste.mjs").CountedSentence} CountedSentence */
/** @typedef {import("./ste-mask.mjs").Warn} Warn */
/** @typedef {typeof import("./ste.mjs").analyzeSteProse} ProseAnalyzer */
/** @typedef {{ context: ProseContext, paragraph: boolean }} ParenthesesOptions */
/** @typedef {{ extra: CountedSentence[], warn: Warn, warnings: ProseWarning[] }} ParenthesesEvidence */

const OPEN_LENGTH = 1;
const CLOSE_LENGTH = 1;
const TEXT_START = 0;

/** @type {(warning: ProseWarning, offset: number) => ProseWarning} */
const shiftWarning = (warning, offset) => ({
  ...warning,
  end: warning.end + offset,
  start: warning.start + offset,
});

/** @type {(sentence: CountedSentence, offset: number) => CountedSentence} */
const shiftSentence = (sentence, offset) => ({
  // Preserve the existing sentence property insertion order after translating offsets.
  ...sentence,
  end: sentence.end + offset,
  parenthetical: true,
  start: sentence.start + offset,
});

/** @type {(analysis: ReturnType<ProseAnalyzer>, offset: number, evidence: ParenthesesEvidence) => void} */
const includeAnalysis = (analysis, offset, { extra, warnings }) => {
  warnings.push(...analysis.warnings.map((warning) => shiftWarning(warning, offset)));
  extra.push(...analysis.sentences.map((sentence) => shiftSentence(sentence, offset)));
};

/** @type {(match: RegExpExecArray, options: ParenthesesOptions, run: { analyze: ProseAnalyzer, evidence: ParenthesesEvidence }) => void} */
const analyzeInner = (match, { context, paragraph }, { analyze, evidence }) => {
  const [source] = match;
  const inner = source.slice(OPEN_LENGTH, -CLOSE_LENGTH);
  if (/^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$/u.test(inner)) {
    return;
  }
  if (paragraph) {
    evidence.warn(
      "Parenthetical prose has a separate word-count sentence, but its paragraph sentence boundary requires review.",
      match.index,
      match.index + source.length,
    );
  }
  includeAnalysis(
    analyze(inner, { ...context, fragment: true }),
    match.index + OPEN_LENGTH,
    evidence,
  );
};

/** @type {(characters: string[], options: ParenthesesOptions, run: { analyze: ProseAnalyzer, evidence: ParenthesesEvidence }) => void} */
export const collapseParentheticals = (characters, options, run) => {
  const { warn } = run.evidence;
  const original = characters.join("");
  if (/\([^()]*\([^)]*\)/u.test(original)) {
    warn("Nested parentheses require contextual parsing.");
  }
  Iterator.from(original.matchAll(/\([^()]*\)/gu)).forEach((match) => {
    const [source] = match;
    const end = match.index + source.length;
    if (match.index > TEXT_START && /[\p{L}\p{N}]/u.test(original[match.index - OPEN_LENGTH])) {
      warn("Attached singular/plural parentheses require contextual counting.", match.index, end);
      return;
    }
    analyzeInner(match, options, run);
    collapseWord(characters, match.index, end);
  });
  if (/[()]/u.test(characters.join(""))) {
    warn("Unbalanced or nested parentheses require contextual parsing.");
  }
};
