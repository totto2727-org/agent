import { sourceRange } from "./mechanical-source-range.mjs";

/** @typedef {import("./mechanical-source.mjs").TextRange} TextRange */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {import("./mechanical-source.mjs").Exclusion} Exclusion */
/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical.mjs").Choice} Choice */
/** @typedef {import("./mechanical.mjs").ParserWarning} ParserWarning */

const FIRST_LENGTH = 0;
export const COMPLETE_CONFIDENCE = 1;

/** @type {(range: SourceRange, target: SourceRange) => boolean} */
export const overlaps = (range, target) =>
  range.startByte < target.endByte && range.endByte > target.startByte;

/** @type {(range: SourceRange, target: SourceRange) => boolean} */
export const contains = (range, target) =>
  range.startByte >= target.startByte && range.endByte <= target.endByte;

/** @type {(markdown: string, offsets: TextRange) => SourceRange} */
export const sourceSpan = (markdown, { end, start }) => sourceRange(markdown, start, end);

/** @type {(markdown: string, target: SourceRange, ranges: Uncertainty[]) => ParserWarning[]} */
export const warningRanges = (markdown, target, ranges) =>
  ranges.flatMap((range) => {
    const source = sourceSpan(markdown, range);
    return overlaps(source, target) ? [{ reason: range.reason, sourceRange: source }] : [];
  });

/** @type {(markdown: string, target: SourceRange, ranges: Exclusion[]) => { kind: string, sourceRange: SourceRange }[]} */
export const exclusionRanges = (markdown, target, ranges) =>
  ranges.flatMap((range) => {
    const source = sourceSpan(markdown, range);
    return overlaps(source, target) ? [{ kind: range.kind, sourceRange: source }] : [];
  });

/** @type {(findingCount: number, warningCount: number, applicable: boolean) => Choice} */
export const choiceFor = (findingCount, warningCount, applicable) => {
  if (findingCount > FIRST_LENGTH) {
    return "fail";
  }
  if (warningCount > FIRST_LENGTH) {
    return "insufficient_context";
  }
  return applicable ? "pass" : "not_applicable";
};
