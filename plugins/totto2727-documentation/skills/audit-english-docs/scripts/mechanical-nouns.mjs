import { sourceRange } from "./mechanical-source-range.mjs";
import { inspectMarkdown } from "./mechanical-source.mjs";
import { countDeclaredNounGroup } from "./ste.mjs";

/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {{ hyphenComponentCounts: number[] | null, sourceRange: SourceRange, status: "counted" | "insufficient_context", wordCount: number | null }} NounGroupEvidence */
/** @typedef {{ markdown: string, targetRange: SourceRange, uncertainties: Uncertainty[], visible: string }} NounSource */

const DOCUMENT_START = 0;
const PREVIOUS_CODE_UNIT = 1;
const NO_MATCH = -1;
const NO_MATCHING_RANGE = undefined;
const WORD_BOUNDARY_CHARACTER = /[\p{L}\p{N}_'-]/u;
// oxlint-disable-next-line unicorn/no-null -- Counts missing from ambiguous noun evidence appear as JSON null.
const NO_COUNT = null;

/** @type {(source: NounSource, start: number, end: number) => SourceRange | undefined} */
const containedMatch = ({ markdown, targetRange, visible }, start, end) => {
  const range = sourceRange(markdown, start, end);
  if (range.startByte < targetRange.startByte || range.endByte > targetRange.endByte) {
    return NO_MATCHING_RANGE;
  }
  if (
    WORD_BOUNDARY_CHARACTER.test(visible[start - PREVIOUS_CODE_UNIT] ?? "") ||
    WORD_BOUNDARY_CHARACTER.test(visible[end] ?? "")
  ) {
    return NO_MATCHING_RANGE;
  }
  return range;
};

/**
 * @template {{ text: string }} Group
 * @param {Group} group - The declaration and its text.
 * @param {SourceRange} range - The matching occurrence.
 * @param {boolean} uncertain - Whether the occurrence intersects a parser warning.
 * @returns {Group & NounGroupEvidence} The declared group with its mechanical counts.
 */
const evidenceFor = (group, range, uncertain) => {
  const counts = uncertain ? NO_COUNT : countDeclaredNounGroup(group.text);
  return {
    ...group,
    status: counts ? "counted" : "insufficient_context",
    // oxlint-disable-next-line eslint/sort-keys -- Preserve absent count field order in the public report.
    ...(counts ?? { wordCount: NO_COUNT, hyphenComponentCounts: NO_COUNT }),
    sourceRange: range,
  };
};

/**
 * @template {{ text: string }} Group
 * @param {NounSource} source - The original Markdown, visible text and criterion scope.
 * @param {Group} group - The declaration and its text.
 * @param {Array<Group & NounGroupEvidence>} selected - Occurrences in declaration and source order.
 */
const appendOccurrences = (source, group, selected) => {
  const { uncertainties, visible } = source;
  const cursor = { start: visible.indexOf(group.text, DOCUMENT_START) };
  while (cursor.start !== NO_MATCH) {
    const { start } = cursor;
    const end = start + group.text.length;
    const range = containedMatch(source, start, end);
    if (range) {
      const uncertain = uncertainties.some((entry) => start < entry.end && end > entry.start);
      selected.push(evidenceFor(group, range, uncertain));
    }
    cursor.start = visible.indexOf(group.text, end);
  }
};

/**
 * Collects mechanical noun-group evidence within an explicit target range.
 * @template {{ text: string }} Group
 * @param {string} markdown - The complete source document.
 * @param {SourceRange} targetRange - The range in which to look for noun groups.
 * @param {Group[]} [groups] - The caller's declarations and their literal text.
 * @returns {Array<Group & NounGroupEvidence>} Evidence for matching declarations.
 */
export const nounGroupCounts = function nounGroupCounts(markdown, targetRange, groups = []) {
  const { visible, uncertainties } = inspectMarkdown(markdown);
  const source = { markdown, targetRange, uncertainties, visible };
  /** @type {Array<Group & NounGroupEvidence>} */
  const selected = [];
  Iterator.from(groups).forEach((group) => {
    appendOccurrences(source, group, selected);
  });
  return selected;
};
