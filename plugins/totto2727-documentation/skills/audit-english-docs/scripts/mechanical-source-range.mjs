/** @typedef {{ endByte: number, endLine: number, startByte: number, startLine: number }} SourceRange */

const SOURCE_START = 0;
const FIRST_LINE = 1;
const PREVIOUS_CHARACTER = 1;
const NEWLINE_AT_END = 1;
const NO_NEWLINE_AT_END = 0;

/**
 * Converts positions in the source into report coordinates.
 * @param {string} markdown - The complete source document.
 * @param {number} start - The first UTF-16 code unit in the span.
 * @param {number} end - The exclusive UTF-16 end of the span.
 * @returns {SourceRange} Line and UTF-8 byte offsets in the original document.
 */
export const sourceRange = function sourceRange(markdown, start, end) {
  const beforeStart = markdown.slice(SOURCE_START, start);
  const beforeEnd = markdown.slice(SOURCE_START, end);
  const lineBreak =
    end > SOURCE_START && markdown[end - PREVIOUS_CHARACTER] === "\n"
      ? NEWLINE_AT_END
      : NO_NEWLINE_AT_END;
  // oxlint-disable-next-line eslint/sort-keys -- Keep the public source range order used by report and evidence consumers.
  return {
    startLine: beforeStart.split("\n").length,
    endLine: Math.max(FIRST_LINE, beforeEnd.split("\n").length - lineBreak),
    startByte: Buffer.byteLength(beforeStart),
    endByte: Buffer.byteLength(beforeEnd),
  };
};
