import { matchesNull, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {import("./mechanical-source.mjs").TextRange} TextRange */
/** @typedef {import("./mechanical-source.mjs").Fence} Fence */
/** @typedef {import("./mechanical-source.mjs").FenceOpening} FenceOpening */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {import("./mechanical-source.mjs").RecordExclusion} RecordExclusion */

const SOURCE_START = 0;
const AFTER_FRONTMATTER_OPENING = 1;
// oxlint-disable-next-line unicorn/no-null -- The public inspection record uses null when no frontmatter range is present.
const NO_BLOCK = null;
const NO_LIST_CONTENT = undefined;

/** @type {(markdown: string) => RegExpExecArray[]} */
const sourceLines = (markdown) =>
  [...markdown.matchAll(/[^\n]*(?:\n|$)/gu)].filter(([line]) => line.length > SOURCE_START);

/** @type {(markdown: string, lines: RegExpExecArray[]) => TextRange | null} */
const frontmatterRange = (markdown, lines) => {
  if (!/^---\s*(?:\r?\n|$)/u.test(markdown)) {
    return NO_BLOCK;
  }
  const closing = lines
    .slice(AFTER_FRONTMATTER_OPENING)
    .find(([line]) => /^(?:---|\.\.\.)\s*$/u.test(line.trimEnd()));
  const end = closing ? closing.index + closing[0].length : markdown.length;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve serialized source range fields in the inspection record.
  return { start: SOURCE_START, end };
};

/** @type {(line: RegExpExecArray) => FenceOpening | null} */
const readFenceOpening = (line) => {
  const [source] = line;
  const groups = /^ {0,3}(?<delimiter>`{3,}|~{3,})(?<info>[^\n]*)/u.exec(source)?.groups;
  if (!groups) {
    return NO_BLOCK;
  }
  const { delimiter, info } = groups;
  const [character] = delimiter;
  if (character === "`" && info.includes("`")) {
    return NO_BLOCK;
  }
  /* oxlint-disable eslint/sort-keys -- Keep the observable order of the public fence record fields. */
  return {
    start: line.index,
    openingEnd: line.index + source.trimEnd().length,
    character,
    length: delimiter.length,
    language: info.trim(),
  };
  /* oxlint-enable eslint/sort-keys */
};

/** @type {(source: string, opening: FenceOpening) => boolean} */
const closesFence = (source, opening) => {
  const delimiter = /^ {0,3}(?<delimiter>`{3,}|~{3,})\s*$/u.exec(source)?.groups?.delimiter;
  return (
    !matchesUndefined(delimiter) &&
    delimiter.startsWith(opening.character) &&
    delimiter.length >= opening.length
  );
};

/** @type {(lines: RegExpExecArray[], frontmatterEnd: number, markdownLength: number) => Fence[]} */
const findFences = (lines, frontmatterEnd, markdownLength) => {
  /** @type {Fence[]} */
  const fences = [];
  /** @type {{ opening: FenceOpening | null }} */
  const scan = { opening: NO_BLOCK };
  lines.forEach((line) => {
    if (line.index < frontmatterEnd) {
      return;
    }
    const { opening } = scan;
    if (matchesNull(opening)) {
      scan.opening = readFenceOpening(line);
    } else if (closesFence(line[0], opening)) {
      const end = line.index + line[0].length;
      // oxlint-disable-next-line eslint/sort-keys -- Retain the insertion order of the closing fields.
      fences.push({ ...opening, end, closed: true });
      scan.opening = NO_BLOCK;
    }
  });
  const { opening } = scan;
  if (!matchesNull(opening)) {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the insertion order of the closing fields.
    fences.push({ ...opening, end: markdownLength, closed: false });
  }
  return fences;
};

const UNCERTAINTY_REASONS = {
  "unsupported-container-fence": "Container-nested fences require contextual Markdown parsing.",
  "unsupported-list-continuation":
    "Indented list continuation may be prose or a nested code block and requires contextual Markdown parsing.",
};

/** @typedef {{ fences: Fence[], frontmatterEnd: number, markdownLength: number }} BlockLayout */
/** @typedef {(start: number, end: number, kind: keyof typeof UNCERTAINTY_REASONS) => void} NoteUncertainty */
/** @typedef {{ note: NoteUncertainty, ranges: Uncertainty[] }} BlockNotes */
/** @typedef {{ end: number, source: string, start: number }} ListContent */

/** @type {(range: TextRange, offset: number) => boolean} */
const covers = (range, offset) => offset >= range.start && offset < range.end;

/** @type {(lines: RegExpExecArray[], layout: BlockLayout) => RegExpExecArray | undefined} */
const containerFence = (lines, { frontmatterEnd, fences }) =>
  // A full container parser is required to classify quote/list fences.
  lines.find(
    (line) =>
      line.index >= frontmatterEnd &&
      !fences.some((fence) => covers(fence, line.index)) &&
      /^ {0,3}(?:>\s*|(?:[-+*]|\d+[.)])\s+)(?:>\s*)*(?:`{3,}|~{3,})/u.test(line[0]),
  );

/** @type {(line: RegExpExecArray, layout: BlockLayout, notes: Uncertainty[]) => ListContent | undefined} */
const listContent = (line, { frontmatterEnd, fences }, notes) => {
  const { index: start } = line;
  if (start < frontmatterEnd || notes.some((range) => covers(range, start))) {
    return NO_LIST_CONTENT;
  }
  const fence = fences.find((candidate) => covers(candidate, start));
  const [source] = line;
  if ((fence && start !== fence.start) || /^[ \t\r\n]*$/u.test(source)) {
    return NO_LIST_CONTENT;
  }
  return { end: fence?.end ?? start + source.length, source, start };
};

/** @type {(lines: RegExpExecArray[], layout: BlockLayout, notes: BlockNotes) => void} */
const noteListContinuations = (lines, layout, { note, ranges }) => {
  /** @type {{ indent: number | null }} */
  const list = { indent: NO_BLOCK };
  lines.forEach((line) => {
    const content = listContent(line, layout, ranges);
    if (!content) {
      return;
    }
    const { end, source, start } = content;
    const indentation = (/^[ \t]*/u.exec(source)?.[0] ?? "").replaceAll("\t", "    ").length;
    if (/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/u.test(source)) {
      list.indent = matchesNull(list.indent) ? indentation : Math.min(list.indent, indentation);
    } else if (!matchesNull(list.indent) && indentation > list.indent) {
      // Keep uncertainty within the continuation instead of affecting later top-level prose.
      note(start, end, "unsupported-list-continuation");
    } else {
      list.indent = NO_BLOCK;
    }
  });
};

/** @type {(lines: RegExpExecArray[], layout: BlockLayout, exclude: RecordExclusion) => Uncertainty[]} */
const uncertainBlocks = (lines, layout, exclude) => {
  /** @type {Uncertainty[]} */
  const ranges = [];
  /** @type {NoteUncertainty} */
  const note = (start, end, kind) => {
    // oxlint-disable-next-line eslint/sort-keys -- Prevent reordering the public uncertainty record.
    ranges.push({ start, end, reason: UNCERTAINTY_REASONS[kind] });
    exclude(start, end, kind);
  };
  const nestedFence = containerFence(lines, layout);
  if (nestedFence) {
    note(nestedFence.index, layout.markdownLength, "unsupported-container-fence");
  }
  noteListContinuations(lines, layout, { note, ranges });
  return ranges;
};

/** @type {(markdown: string, exclude: RecordExclusion) => { fences: Fence[], frontmatter: TextRange | null, uncertainties: Uncertainty[] }} */
export const blockRanges = (markdown, exclude) => {
  const lines = sourceLines(markdown);
  const frontmatter = frontmatterRange(markdown, lines);
  const frontmatterEnd = frontmatter?.end ?? SOURCE_START;
  if (frontmatter) {
    exclude(frontmatter.start, frontmatterEnd, "frontmatter");
  }
  const fences = findFences(lines, frontmatterEnd, markdown.length);
  fences.forEach((fence) => {
    exclude(fence.start, fence.end, "fenced-code");
  });
  const uncertainties = uncertainBlocks(
    lines,
    { fences, frontmatterEnd, markdownLength: markdown.length },
    exclude,
  );
  return { fences, frontmatter, uncertainties };
};
