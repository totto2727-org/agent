import { sourceRange } from "./mechanical-source-range.mjs";
import { inspectMarkdown } from "./mechanical-source.mjs";
import { matchesNull } from "./native-predicates.mjs";

/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-source.mjs").Fence} Fence */
/** @typedef {import("./mechanical-source.mjs").TextRange} TextRange */
/** @typedef {{ end: number, start: number | null }} ParagraphSpan */
/** @typedef {{ fences: Fence[], frontmatter: TextRange | null }} BlockLayout */
/** @typedef {{ emit: (span: ParagraphSpan) => void, span: ParagraphSpan }} ParagraphCollector */
/**
 * @template Context
 * @typedef {{ headingPath: string[], id?: unknown, sourceRange: SourceRange, ste?: Context }} Section
 */
/**
 * @template Context
 * @typedef {{ headingPath: string[], id: string, sourceRange: SourceRange, ste: Context | undefined, text: string }} Paragraph
 */

const FIRST_BYTE = 0;
const FIRST_PARAGRAPH_NUMBER = 1;
const BLANK_OR_HEADING = /^(?:\s*$| {0,3}#{1,6}\s)/u;
// oxlint-disable-next-line unicorn/no-null -- An empty paragraph span has no starting coordinate.
const NO_PARAGRAPH_START = null;

/**
 * @template Context
 * @param {Section<Context>[]} sections - The selected manifest sections.
 * @param {SourceRange} range - The complete paragraph source range.
 * @returns {Section<Context> | undefined} The first section which contains the paragraph.
 */
const sectionFor = (sections, range) => {
  const partial = sections.find(
    (candidate) =>
      candidate.sourceRange.startByte < range.endByte &&
      candidate.sourceRange.endByte > range.startByte &&
      (candidate.sourceRange.startByte > range.startByte ||
        candidate.sourceRange.endByte < range.endByte),
  );
  if (partial) {
    const message =
      // oxlint-disable-next-line typescript/restrict-template-expressions -- Retain the existing display of manifest-provided section identifiers.
      `Section ${partial.id} selects only part of a paragraph (paragraph lines ${range.startLine}-${range.endLine}). Expand the source range to include the complete paragraph.`;
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the installed skill's native error for a partial paragraph selection.
    throw new Error(message);
  }
  return sections.find(
    (candidate) =>
      candidate.sourceRange.startByte <= range.startByte &&
      candidate.sourceRange.endByte >= range.endByte,
  );
};

/**
 * @template Context
 * @param {string} markdown - The source document.
 * @param {Section<Context>[]} sections - The selected manifest sections.
 * @param {Paragraph<Context>[]} units - Paragraphs already emitted.
 * @returns {(span: ParagraphSpan) => void} Flushes the current paragraph or fence.
 */
const emitter =
  (markdown, sections, units) =>
  ({ end, start }) => {
    if (matchesNull(start)) {
      return;
    }
    const range = sourceRange(markdown, start, end);
    const section = sectionFor(sections, range);
    if (section) {
      // oxlint-disable-next-line eslint/sort-keys -- Keep the fields of a serialized paragraph in their existing order.
      units.push({
        id: `paragraph-${units.length + FIRST_PARAGRAPH_NUMBER}`,
        headingPath: section.headingPath,
        ste: section.ste,
        text: markdown.slice(start, end),
        sourceRange: range,
      });
    }
  };

/** @type {(index: number, fences: Fence[], collector: ParagraphCollector) => boolean} */
const appendFenceLine = (index, fences, { emit, span }) => {
  const fence = fences.find((candidate) => index >= candidate.start && index < candidate.end);
  if (!fence) {
    return false;
  }
  if (index === fence.start) {
    emit(span);
    emit(fence);
    span.start = NO_PARAGRAPH_START;
  }
  return true;
};

/** @type {(line: RegExpExecArray, layout: BlockLayout, collector: ParagraphCollector) => void} */
const appendLine = (line, { fences, frontmatter }, collector) => {
  const { index } = line;
  if ((frontmatter && index < frontmatter.end) || appendFenceLine(index, fences, collector)) {
    return;
  }
  const { emit, span } = collector;
  const [source] = line;
  if (BLANK_OR_HEADING.test(source)) {
    emit(span);
    span.start = NO_PARAGRAPH_START;
  } else {
    span.start ??= index;
    span.end = index + source.length;
  }
};

/**
 * Splits the document into complete paragraphs within the selected sections.
 * @template Context
 * @param {string} markdown - The complete source document.
 * @param {Section<Context>[]} sections - Sections eligible for paragraph checks.
 * @returns {Paragraph<Context>[]} Whole paragraphs contained in those sections.
 */
export const paragraphUnits = function paragraphUnits(markdown, sections) {
  const layout = inspectMarkdown(markdown);
  const lines = Iterator.from(markdown.matchAll(/[^\n]*(?:\n|$)/gu)).filter((line) =>
    Boolean(line[0].length),
  );
  /** @type {Paragraph<Context>[]} */
  const units = [];
  /** @type {ParagraphSpan} */
  const span = { end: FIRST_BYTE, start: NO_PARAGRAPH_START };
  const emit = emitter(markdown, sections, units);
  const collector = { emit, span };
  lines.forEach((line) => {
    appendLine(line, layout, collector);
  });
  emit(span);
  return units;
};
