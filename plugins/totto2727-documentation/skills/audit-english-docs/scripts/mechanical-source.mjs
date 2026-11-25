import { blockRanges } from "./mechanical-blocks.mjs";
import { excludeCodeSpans, excludeMarkup, masking } from "./mechanical-inline.mjs";

/** @typedef {{ end: number, start: number }} TextRange */
/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {{ character: string, language: string, length: number, openingEnd: number, start: number }} FenceOpening */
/** @typedef {FenceOpening & { closed: boolean, end: number }} Fence */
/** @typedef {TextRange & { kind: string }} Exclusion */
/** @typedef {TextRange & { reason: string }} Uncertainty */
/** @typedef {(start: number, end: number, kind: string) => void} RecordExclusion */

// Offsets remain UTF-16 source offsets until sourceRange converts them to UTF-8.
// Conservative exclusions intentionally reduce coverage rather than claim that
// Code, metadata, link destinations, or HTML meet a prose criterion.
/**
 * @param {string} markdown - The complete Markdown document.
 * @returns {{ exclusions: Exclusion[], fences: Fence[], frontmatter: TextRange | null, uncertainties: Uncertainty[], visible: string }} Visible text and the source spans consulted to derive it.
 */
export const inspectMarkdown = function inspectMarkdown(markdown) {
  /** @type {Exclusion[]} */
  const exclusions = [];
  /** @type {RecordExclusion} */
  const exclude = (start, end, kind) => {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve serialized exclusion fields in the inspection record.
    exclusions.push({ start, end, kind });
  };
  const { fences, frontmatter, uncertainties } = blockRanges(markdown, exclude);
  const mask = masking(markdown, exclusions);
  excludeCodeSpans(mask(), exclude);
  excludeMarkup(mask, exclude);
  // oxlint-disable-next-line eslint/sort-keys -- Keep the existing order of the public inspection record.
  return { visible: mask(), exclusions, fences, frontmatter, uncertainties };
};
