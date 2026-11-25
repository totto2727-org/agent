import { bounded, EvaluationError, object, text } from "./evaluation-validation.mjs";
import { inspectMarkdown, sourceRange } from "./mechanical.mjs";
import { matchesString, matchesUndefined } from "./native-predicates.mjs";
import { validateSteContext } from "./ste.mjs";

/** @typedef {{ heading: string, level: number, start: number }} Heading */
/** @typedef {import("./ste.mjs").SteContext} SteContext */
/** @typedef {{ headingPath: string[], id: unknown, sourceRange: ReturnType<typeof sourceRange>, ste?: SteContext, text: string, unavailable?: boolean }} Section */

const textStart = 0;
const lineNumberBase = 1;
const nextIndex = 1;
const missingHeadings = 0;
const header = /^(?<marks>#{1,6})\s+(?<title>.+?)\s*#*\s*(?:\n)?$/u;

/** @type {(markdown: string) => Heading[]} */
const collectHeadings = (markdown) => {
  const lines = markdown.split(/(?<=\n)/u);
  const { frontmatter, fences } = inspectMarkdown(markdown);
  /** @type {Heading[]} */
  const headings = [];
  // oxlint-disable-next-line rules/no-let -- The offset advances through the original Markdown while retaining its source positions.
  let offset = textStart;
  lines.forEach((line) => {
    const start = offset;
    offset += line.length;
    if (
      fences.some((fence) => start >= fence.start && start < fence.end) ||
      (frontmatter && start < frontmatter.end)
    ) {
      return;
    }
    const match = header.exec(line)?.groups;
    if (matchesUndefined(match)) {
      return;
    }
    headings.push({
      heading: match.title.replace(/\s*\{#[^}]+\}\s*$/u, ""),
      level: match.marks.length,
      start,
    });
  });
  return headings;
};

/** @type {(headings: Heading[], index: number) => string[]} */
const headingPathFor = (headings, index) =>
  headings
    .slice(textStart, index + nextIndex)
    .filter(
      (heading, childIndex, all) =>
        !all.slice(childIndex + nextIndex).some((other) => other.level <= heading.level),
    )
    .map((heading) => heading.heading);

/** @type {(section: Pick<Section, "id" | "headingPath" | "sourceRange" | "text">) => Section} */
const segment = ({ headingPath, id, sourceRange: range, text: body }) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the field order in serialized Markdown sections.
  ({ id, headingPath, text: body, sourceRange: range });

/**
 * @param {string} markdown - The original Markdown document.
 * @returns {Section[]} Heading sections and their byte and line coordinates.
 */
export const segmentMarkdown = (markdown) => {
  bounded(markdown, "document");
  const headings = collectHeadings(markdown);
  if (headings.length === missingHeadings) {
    return [
      segment({
        headingPath: [],
        id: "document",
        sourceRange: sourceRange(markdown, textStart, markdown.length),
        text: markdown,
      }),
    ];
  }
  const preambleEnd = headings[textStart].start;
  const preamble = markdown.slice(textStart, preambleEnd);
  const sections = headings.map((heading, index) => {
    const end = headings[index + nextIndex]?.start ?? markdown.length;
    return segment({
      headingPath: headingPathFor(headings, index),
      id: `section-${index + lineNumberBase}`,
      sourceRange: sourceRange(markdown, heading.start, end),
      text: bounded(markdown.slice(heading.start, end), `section ${heading.heading}`),
    });
  });
  if (preamble.trim().length > missingHeadings) {
    sections.unshift(
      segment({
        headingPath: [],
        id: "preamble",
        sourceRange: sourceRange(markdown, textStart, preambleEnd),
        text: preamble,
      }),
    );
  }
  return sections;
};

/** @typedef {{ endLine: number, startLine: number }} LineBounds */

/** @type {(section: Record<string, unknown>, index: number, lineCount: number) => LineBounds} */
const validateLineBounds = (section, index, lineCount) => {
  const invalidRange = `sections[${index}] must provide valid startLine and endLine values`;
  if (!Number.isInteger(section.startLine) || !Number.isInteger(section.endLine)) {
    throw new EvaluationError(invalidRange);
  }
  const startLine = Number(section.startLine);
  const endLine = Number(section.endLine);
  if (startLine < lineNumberBase || endLine < startLine || endLine > lineCount) {
    throw new EvaluationError(invalidRange);
  }
  return { endLine, startLine };
};

/** @type {(bounds: LineBounds, index: number, fences: LineBounds[]) => void} */
const checkFenceBoundaries = ({ endLine, startLine }, index, fences) => {
  if (
    fences.some(
      (fence) =>
        (startLine > fence.startLine && startLine <= fence.endLine) ||
        (endLine >= fence.startLine && endLine < fence.endLine),
    )
  ) {
    throw new EvaluationError(`sections[${index}] must not split a fenced code block`);
  }
};

/** @type {(value: unknown, index: number) => string[]} */
const validateHeadingPath = (value, index) => {
  const headings = value ?? [];
  const message = `sections[${index}].headingPath must be an array of strings`;
  if (!Array.isArray(headings)) {
    throw new EvaluationError(message);
  }
  /** @type {unknown[]} */
  const headingPath = headings;
  if (!headingPath.every((heading) => matchesString(heading))) {
    throw new EvaluationError(message);
  }
  return headingPath;
};

/** @type {(lines: string[], bounds: LineBounds) => ReturnType<typeof sourceRange>} */
const explicitSourceRange = (lines, { endLine, startLine }) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the source range key order in existing report JSON.
  ({
    startLine,
    endLine,
    startByte: Buffer.byteLength(lines.slice(textStart, startLine - lineNumberBase).join("")),
    endByte: Buffer.byteLength(lines.slice(textStart, endLine).join("")),
  });

/** @type {(value: unknown, index: number, source: { fences: LineBounds[], lines: string[] }) => Section} */
const explicitSection = (value, index, { fences, lines }) => {
  const section = object(value, `sections[${index}]`);
  const bounds = validateLineBounds(section, index, lines.length);
  checkFenceBoundaries(bounds, index, fences);
  const label = `sections[${index}] source range`;
  const content = bounded(
    text(lines.slice(bounds.startLine - lineNumberBase, bounds.endLine).join(""), label),
    label,
  );
  const headingPath = validateHeadingPath(section.headingPath, index);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve explicit section field order in existing report JSON.
  return {
    id: section.id ?? `explicit-${index + lineNumberBase}`,
    ste: validateSteContext(section.ste, `sections[${index}].ste`, EvaluationError),
    headingPath,
    text: content,
    sourceRange: explicitSourceRange(lines, bounds),
  };
};

/**
 * @param {unknown[]} sections - The manifest's section declarations.
 * @param {string} page - The complete Markdown document.
 * @returns {Section[]} The validated sections and their source ranges.
 */
export const explicitSections = function (sections, page) {
  if (!sections.length) {
    throw new EvaluationError("documents sections must not be empty");
  }
  const lines = page.split(/(?<=\n)/u);
  const fences = inspectMarkdown(page).fences.map((fence) =>
    sourceRange(page, fence.start, fence.end),
  );
  return sections.map((value, index) => explicitSection(value, index, { fences, lines }));
};
