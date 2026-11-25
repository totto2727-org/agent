import { maskProse } from "./ste-mask.mjs";
import { collapseNumbers } from "./ste-numbers.mjs";
import { collapseParentheticals } from "./ste-parentheticals.mjs";
import { countSentences, warnAboutProse } from "./ste-sentences.mjs";

// Source: ASD-STE100 Issue 9, rules 5.1, 6.3, 6.6 and section 8.
// This is a bounded prose parser, not a grammar, typography or dictionary oracle.
export { countDeclaredNounGroup, validateSteContext } from "./ste-context.mjs";
export { validateSteVocabulary } from "./ste-vocabulary.mjs";

/** @typedef {import("./ste-context.mjs").DeclaredNounGroup} DeclaredNounGroup */
/** @typedef {import("./ste-context.mjs").SteContext} SteContext */
/** @typedef {import("./ste-validation.mjs").ErrorConstructor} ErrorConstructor */
/** @typedef {import("./ste-vocabulary.mjs").VocabularyEntry} VocabularyEntry */
/** @typedef {import("./ste-vocabulary.mjs").TechnicalTerm} TechnicalTerm */
/** @typedef {import("./ste-vocabulary.mjs").Vocabulary} Vocabulary */

/** @typedef {{ end: number, parenthetical?: boolean, start: number, wordCount: number }} CountedSentence */
/** @typedef {{ end: number, reason: string, start: number }} ProseWarning */
/** @typedef {{ category: string, text: string }} DeclaredWordGroup */
/** @typedef {{ fragment?: boolean, measurementUnits?: string[], wordGroups?: DeclaredWordGroup[], writingMode?: "procedural" | "descriptive" }} ProseContext */

const SOURCE_START = 0;
const DEFAULT_CONTEXT = {};
const DEFAULT_OPTIONS = {};

/**
 * @param {string} text - The source prose to count.
 * @param {ProseContext} [context] - The declarations that apply to this span.
 * @param {{ paragraph?: boolean }} [options] - Whether to use paragraph counting.
 * @returns {{ paragraphSentences: number, sentences: CountedSentence[], warnings: ProseWarning[] }} Counts and unresolved source spans.
 */
export const analyzeSteProse = function analyzeSteProse(
  text,
  context = DEFAULT_CONTEXT,
  { paragraph = false } = DEFAULT_OPTIONS,
) {
  /** @type {ProseWarning[]} */
  const warnings = [];
  /** @type {import("./ste-mask.mjs").Warn} */
  const warn = (reason, start = SOURCE_START, end = text.length) => {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the public warning field order.
    warnings.push({ reason, start, end });
  };
  const characters = maskProse(text, context, warn);
  /** @type {CountedSentence[]} */
  const extra = [];
  collapseParentheticals(
    characters,
    { context, paragraph },
    {
      analyze: analyzeSteProse,
      evidence: { extra, warn, warnings },
    },
  );
  const current = collapseNumbers(characters, context.measurementUnits, { paragraph, warn });
  warnAboutProse(current, { paragraph, procedural: context.writingMode === "procedural" }, warn);
  const sentences = countSentences(current, {
    fragment: context.fragment ?? false,
    paragraph,
    warn,
  });
  // oxlint-disable-next-line eslint/sort-keys -- Keep the existing analysis result order for callers.
  return { sentences: [...sentences, ...extra], paragraphSentences: sentences.length, warnings };
};
