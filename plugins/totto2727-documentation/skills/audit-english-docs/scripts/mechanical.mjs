import { analyzeSteProse, countDeclaredNounGroup } from "./ste.mjs";
import {
  hasObjectType,
  matchesBoolean,
  matchesNull,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";

const MAX_TERMS = 1000;
const MAX_TERM_LENGTH = 128;
const LITERAL_TERM = /^[\p{L}\p{N}_]+$/u;

/** @type {Record<string, string[]>} */
const allowedMechanicalParameters = {
  "fenced-code-language": ["kind"],
  "prohibited-terms": ["kind", "terms", "caseSensitive", "protectedTerms"],
  "ste-dictionary-membership": ["kind"],
  "ste-paragraph-length": ["kind"],
  "ste-punctuation": ["kind"],
  "ste-sentence-length": ["kind", "writingMode"],
};

/** @type {(value: unknown, allowEmpty: boolean) => string[] | undefined} */
const literalTerms = (value, allowEmpty) => {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > MAX_TERMS) {
    return undefined;
  }
  /** @type {unknown[]} */
  const terms = value;
  if (
    !terms.every((term) => matchesString(term)) ||
    terms.some((term) => term.length > MAX_TERM_LENGTH || !LITERAL_TERM.test(term))
  ) {
    return undefined;
  }
  return terms;
};

/** @typedef {{ end: number, start: number }} TextRange */
/** @typedef {{ endByte: number, endLine: number, startByte: number, startLine: number }} SourceRange */
/** @typedef {{ character: string, language: string, length: number, openingEnd: number, start: number }} FenceOpening */
/** @typedef {FenceOpening & { closed: boolean, end: number }} Fence */
/** @typedef {TextRange & { kind: string }} Exclusion */
/** @typedef {TextRange & { reason: string }} Uncertainty */
/** @typedef {{ hyphenComponentCounts: number[] | null, sourceRange: SourceRange, status: "counted" | "insufficient_context", wordCount: number | null }} NounGroupEvidence */
/** @typedef {"ste-dictionary-membership" | "ste-paragraph-length" | "ste-punctuation"} StaticSteKind */
/** @typedef {{ kind: StaticSteKind } | { kind: "ste-sentence-length", writingMode: "procedural" | "descriptive" }} SteCheck */
/** @typedef {SteCheck | { kind: "fenced-code-language" } | { caseSensitive?: boolean, kind: "prohibited-terms", protectedTerms?: string[], terms: string[] }} MechanicalCheck */
/** @typedef {import("./ste.mjs").VocabularyEntry} VocabularyEntry */
/** @typedef {import("./ste.mjs").TechnicalTerm} TechnicalTerm */
/** @typedef {Pick<import("./ste.mjs").Vocabulary, "entries" | "technicalTerms">} Vocabulary */
/** @typedef {import("./ste.mjs").ProseContext & { vocabulary?: Vocabulary }} MechanicalContext */
/** @typedef {"fail" | "insufficient_context" | "not_applicable" | "pass"} Choice */
/** @typedef {{ reason: string, sourceRange: SourceRange }} ParserWarning */
/** @typedef {{ claim: string, excluded: Array<{ kind: string, sourceRange: SourceRange }>, parserWarnings: ParserWarning[] }} Coverage */
/** @typedef {{ limit: number, parenthetical?: boolean, sentenceCount?: number, sourceRange: SourceRange, wordCount?: number }} ProseCount */
/** @typedef {{ basis?: string, defect?: string, limit?: number, message: string, parenthetical?: boolean, sentenceCount?: number, sourceRange: SourceRange, term?: string, wordCount?: number }} Finding */
/** @typedef {{ membership: "approved-form" | "not-approved-entry" | "unlisted", records: Array<Omit<VocabularyEntry, "forms"> & { listedForms: string[] }>, sourceRange: SourceRange, technicalRecords: TechnicalTerm[], technicalTermCandidate: boolean, term: string }} LexicalCandidate */
/** @typedef {{ choice: Choice, confidence: number, coverage: Coverage, findings: Finding[], reviewRequired: boolean, type: "choice" }} MechanicalResult */
/** @typedef {MechanicalResult & { counts: ProseCount[], coverage: Coverage & { declaredWordGroups: import("./ste.mjs").DeclaredWordGroup[], writingMode: MechanicalContext["writingMode"] | null }, lexicalCandidates: LexicalCandidate[] }} SteResult */
/**
 * @template Context
 * @typedef {{ headingPath: string[], id: string, sourceRange: SourceRange, ste: Context | undefined, text: string }} Paragraph
 */

// Bounded local criteria only. These checks do not certify full STE compliance.
// No manifest-supplied executable expressions or regular expressions are accepted.
/**
 * @param {unknown} check - The manifest's mechanical criterion.
 * @param {string} label - Its location in the manifest.
 * @param {new (message: string) => Error} [ErrorType] - The caller's validation error constructor.
 * @returns {MechanicalCheck} A check restricted to the supported parameters.
 */
export const validateMechanicalCheck = function validateMechanicalCheck(
  check,
  label,
  ErrorType = Error,
) {
  /** @type {(message: string) => never} */
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (!hasObjectType(check) || matchesNull(check) || Array.isArray(check)) {
    reject("must be an object");
  }
  const kind = "kind" in check ? check.kind : undefined;
  if (!matchesString(kind) || !Object.hasOwn(allowedMechanicalParameters, kind)) {
    reject("unsupported mechanical kind");
  }
  const allowed = allowedMechanicalParameters[kind];
  if (Object.keys(check).some((key) => !allowed.includes(key))) {
    reject("unexpected parameter");
  }
  if (kind === "ste-sentence-length") {
    const writingMode = "writingMode" in check ? check.writingMode : undefined;
    if (writingMode !== "procedural" && writingMode !== "descriptive") {
      reject("writingMode must be procedural or descriptive");
    }
    return { kind, writingMode };
  }
  if (kind === "prohibited-terms") {
    const terms = literalTerms("terms" in check ? check.terms : undefined, false);
    if (matchesUndefined(terms)) {
      reject(
        "terms must contain 1 through 1000 literal whole tokens (at most 128 characters each)",
      );
    }
    const caseSensitive = "caseSensitive" in check ? check.caseSensitive : undefined;
    if (!matchesUndefined(caseSensitive) && !matchesBoolean(caseSensitive)) {
      reject("caseSensitive must be boolean");
    }
    const protectedInput = "protectedTerms" in check ? check.protectedTerms : undefined;
    const protectedTerms = matchesUndefined(protectedInput)
      ? []
      : literalTerms(protectedInput, true);
    if (matchesUndefined(protectedTerms)) {
      reject(
        "protectedTerms must be an array of literal whole tokens (at most 1000 tokens, 128 characters each)",
      );
    }
    return {
      kind,
      terms: [...new Set(terms)],
      protectedTerms: [...new Set(protectedTerms)],
      caseSensitive: caseSensitive ?? false,
    };
  }
  switch (kind) {
    case "fenced-code-language":
    case "ste-dictionary-membership":
    case "ste-paragraph-length":
    case "ste-punctuation": {
      return { kind };
    }
    default: {
      return reject("unsupported mechanical kind");
    }
  }
};

/**
 * @param {string} markdown - The complete source document.
 * @param {number} start - The first UTF-16 code unit of the span.
 * @param {number} end - The exclusive UTF-16 end of the span.
 * @returns {SourceRange} Line and UTF-8 byte offsets in the original document.
 */
export const sourceRange = function sourceRange(markdown, start, end) {
  return {
    startLine: markdown.slice(0, start).split("\n").length,
    endLine: Math.max(
      1,
      markdown.slice(0, end).split("\n").length - (end > 0 && markdown[end - 1] === "\n" ? 1 : 0),
    ),
    startByte: Buffer.byteLength(markdown.slice(0, start)),
    endByte: Buffer.byteLength(markdown.slice(0, end)),
  };
};

/** @typedef {(start: number, end: number, kind: string) => void} RecordExclusion */

const FIRST_RUN = 0;
const NEXT_RUN = 1;
const NO_CLOSING_RUN = -1;

/** @type {(markdown: string, exclusions: Exclusion[]) => () => string} */
const masking = (markdown, exclusions) => {
  const lineBreaks = [...markdown.matchAll(/[\r\n]/gu)];
  return () => {
    const characters = markdown.split("");
    exclusions.forEach(({ start, end }) => {
      characters.fill(" ", start, end);
    });
    lineBreaks.forEach((lineBreak) => {
      const [character] = lineBreak;
      characters[lineBreak.index] = character;
    });
    return characters.join("");
  };
};

/** @type {(visible: string, exclude: RecordExclusion) => void} */
const excludeCodeSpans = (visible, exclude) => {
  // Code spans close at the next run of the same delimiter width, across newlines.
  const runs = [...visible.matchAll(/`+/gu)];
  const cursor = { index: FIRST_RUN };
  while (cursor.index < runs.length) {
    const { index } = cursor;
    const opening = runs[index];
    const closing = runs.findIndex(
      (other, position) => position > index && other[0].length === opening[0].length,
    );
    cursor.index = (closing === NO_CLOSING_RUN ? index : closing) + NEXT_RUN;
    if (closing !== NO_CLOSING_RUN) {
      const end = runs[closing];
      exclude(opening.index, end.index + end[0].length, "inline-code");
    }
  }
};

/** @type {[pattern: RegExp, kind: string][]} */
const MARKUP_PHASES = [
  [
    // oxlint-disable-next-line eslint/require-unicode-regexp -- Keep ASCII case folding for HTML tag names and their closing backreferences.
    /<(?<tag>script|pre|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\k<tag>\s*>|$)/gi,
    "html-block",
  ],
  [
    // oxlint-disable-next-line eslint/require-unicode-regexp -- Unicode case folding would accept extra characters in this fixed HTML block name list.
    /^ {0,3}<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|ul)\b[^\n]*[\s\S]*?(?=\n[ \t]*\r?\n|(?![\s\S]))/gim,
    "html-block",
  ],
  [
    // Paired HTML and comments are excluded with their contents.
    /<!--[\s\S]*?(?:-->|$)|<(?<tag>[A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\k<tag>\s*>|<[^>\n]+>/gu,
    "html",
  ],
  [
    /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>]+|\]\([^\n]*?\)|^ {0,3}\[[^\]\n]+\]:[^\n]*|\{#[^}\n]+\}\s*$/gmu,
    "url-or-markup",
  ],
  [/^ {4}[^\n]+|^\t[^\n]+/gmu, "indented-code"],
];

/** @type {(mask: () => string, exclude: RecordExclusion) => void} */
const excludeMarkup = (mask, exclude) => {
  MARKUP_PHASES.forEach(([pattern, kind]) => {
    // Mask each phase before the next one considers overlapping source.
    [...mask().matchAll(pattern)].forEach((match) => {
      exclude(match.index, match.index + match[0].length, kind);
    });
  });
};

const SOURCE_START = 0;
const AFTER_FRONTMATTER_OPENING = 1;
// oxlint-disable-next-line unicorn/no-null -- The public inspection record uses null when no frontmatter range is present.
const NO_BLOCK = null;

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
    return;
  }
  const fence = fences.find((candidate) => covers(candidate, start));
  const [source] = line;
  if ((fence && start !== fence.start) || /^[ \t\r\n]*$/u.test(source)) {
    return;
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
const blockRanges = (markdown, exclude) => {
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

/**
 * @template {{ text: string }} Group
 * @param {string} markdown - The complete source document.
 * @param {SourceRange} targetRange - The range in which to look for noun groups.
 * @param {Group[]} [groups] - The caller's declarations and their literal text.
 * @returns {Array<Group & NounGroupEvidence>} Evidence for matching declarations.
 */
export const nounGroupCounts = function nounGroupCounts(markdown, targetRange, groups = []) {
  const { visible, uncertainties } = inspectMarkdown(markdown);
  /** @type {Array<Group & NounGroupEvidence>} */
  const selected = [];
  Iterator.from(groups).forEach((group) => {
    let at = 0;
    while ((at = visible.indexOf(group.text, at)) !== -1) {
      const end = at + group.text.length;
      const range = sourceRange(markdown, at, end);
      if (
        range.startByte >= targetRange.startByte &&
        range.endByte <= targetRange.endByte &&
        !/[\p{L}\p{N}_'-]/u.test(visible[at - 1] ?? "") &&
        !/[\p{L}\p{N}_'-]/u.test(visible[end] ?? "")
      ) {
        const counts = uncertainties.some((entry) => at < entry.end && end > entry.start)
          ? null
          : countDeclaredNounGroup(group.text);
        selected.push({
          ...group,
          status: counts ? "counted" : "insufficient_context",
          ...(counts ?? { wordCount: null, hyphenComponentCounts: null }),
          sourceRange: range,
        });
      }
      at = end;
    }
  });
  return selected;
};

/**
 * @template Context
 * @param {string} markdown - The complete Markdown document.
 * @param {Array<{ headingPath: string[], id?: unknown, sourceRange: SourceRange, ste?: Context }>} sections - Sections eligible for paragraph checks.
 * @returns {Paragraph<Context>[]} Whole paragraphs contained in those sections.
 */
export const paragraphUnits = function paragraphUnits(markdown, sections) {
  const { fences, frontmatter } = inspectMarkdown(markdown);
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter((line) => line[0].length);
  /** @type {Paragraph<Context>[]} */
  const units = [];
  /** @type {number | null} */
  let start = null;
  let end = 0;
  const flush = () => {
    if (matchesNull(start)) {
      return;
    }
    const range = sourceRange(markdown, start, end);
    const partial = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte < range.endByte &&
        candidate.sourceRange.endByte > range.startByte &&
        (candidate.sourceRange.startByte > range.startByte ||
          candidate.sourceRange.endByte < range.endByte),
    );
    if (partial) {
      throw new Error(
        `Section ${partial.id} selects only part of a paragraph (paragraph lines ${range.startLine}-${range.endLine}). Expand the source range to include the complete paragraph.`,
      );
    }
    const section = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte <= range.startByte &&
        candidate.sourceRange.endByte >= range.endByte,
    );
    if (section) {
      units.push({
        id: `paragraph-${units.length + 1}`,
        headingPath: section.headingPath,
        ste: section.ste,
        text: markdown.slice(start, end),
        sourceRange: range,
      });
    }
    start = null;
  };
  Iterator.from(lines).forEach((line) => {
    if (frontmatter && line.index < frontmatter.end) {
      return;
    }
    const fence = fences.find(
      (candidate) => line.index >= candidate.start && line.index < candidate.end,
    );
    if (fence) {
      if (line.index === fence.start) {
        flush();
        start = fence.start;
        end = fence.end;
        flush();
      }
      return;
    }
    if (/^\s*$/u.test(line[0]) || /^ {0,3}#{1,6}\s/u.test(line[0])) {
      flush();
      if (/^\s*$/u.test(line[0]) || /^ {0,3}#{1,6}\s/u.test(line[0])) {
        return;
      }
    }
    start ??= line.index;
    end = line.index + line[0].length;
  });
  flush();
  return units;
};

/**
 * @param {SteCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} context - The declared language context.
 * @returns {SteResult} The result and evidence for one STE criterion.
 */
const runSteMechanical = function runSteMechanical(check, markdown, targetRange, context) {
  const inspection = inspectMarkdown(markdown);
  /** @type {Finding[]} */
  const findings = [];
  /** @type {ProseCount[]} */
  const counts = [];
  /** @type {LexicalCandidate[]} */
  const lexicalCandidates = [];
  /** @type {ParserWarning[]} */
  const parserWarnings = [];
  /** @type {(range: SourceRange) => boolean} */
  const overlaps = (range) =>
    range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
  /** @type {(range: SourceRange) => boolean} */
  const contains = (range) =>
    range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  /** @type {(reason: string, range?: SourceRange) => void} */
  const warning = (reason, range = targetRange) => {
    parserWarnings.push({ reason, sourceRange: range });
  };
  Iterator.from(inspection.uncertainties).forEach((entry) => {
    const range = sourceRange(markdown, entry.start, entry.end);
    if (overlaps(range)) {
      warning(entry.reason, range);
    }
  });
  /** @type {(choice: Choice) => SteResult} */
  const result = (choice) => ({
    type: "choice",
    choice,
    confidence: 1,
    reviewRequired: parserWarnings.length > 0 || check.kind === "ste-dictionary-membership",
    findings,
    counts,
    lexicalCandidates,
    coverage: {
      claim:
        "Only the declared ASD-STE100 Issue 9 local criterion, not full STE compliance. Counts require declared writing mode and unambiguous section 8 word groups.",
      writingMode: context.writingMode ?? null,
      declaredWordGroups: context.wordGroups ?? [],
      parserWarnings,
      excluded: inspection.exclusions
        .map(({ start, end, kind }) => ({ kind, sourceRange: sourceRange(markdown, start, end) }))
        .filter((entry) => overlaps(entry.sourceRange)),
    },
  });
  if (check.kind === "ste-sentence-length" || check.kind === "ste-paragraph-length") {
    if (!context.writingMode) {
      warning(
        "Declare document.ste.writingMode or an explicit section.ste.writingMode. Procedures, descriptions, notes and safety instructions have different applicability.",
      );
      return result("insufficient_context");
    }
    const mode = check.kind === "ste-sentence-length" ? check.writingMode : "descriptive";
    if (context.writingMode !== mode) {
      return result("not_applicable");
    }
  }
  let applicable = false;
  const paragraphs = paragraphUnits(markdown, [
    { sourceRange: sourceRange(markdown, 0, markdown.length), headingPath: [] },
  ]);
  for (const unit of paragraphs) {
    if (!overlaps(unit.sourceRange)) {
      continue;
    }
    if (!contains(unit.sourceRange)) {
      warning(
        "The local source range selects only part of a paragraph or sentence. Select the complete paragraph.",
        unit.sourceRange,
      );
      continue;
    }
    const start = Buffer.from(markdown).subarray(0, unit.sourceRange.startByte).toString().length;
    const end = start + unit.text.length;
    const exclusions = inspection.exclusions.filter(
      (entry) => entry.start < end && entry.end > start,
    );
    if (exclusions.some((entry) => entry.start <= start && entry.end >= end)) {
      continue;
    }
    const text = inspection.visible.slice(start, end);
    if (!text.trim()) {
      continue;
    }
    applicable = true;
    const structural = /^(?: {0,3}>| {0,3}\|| {0,3}\[| {0,3}(?:=+|-+)\s*$)/mu.test(text);
    if (structural) {
      warning(
        "Unsupported block quote, table, reference, or setext/container structure requires contextual parsing.",
        unit.sourceRange,
      );
    }
    if (check.kind === "ste-punctuation") {
      // Unchangeable quoted text can be non-STE (8.6). Do not flag its punctuation.
      let prose = text.replaceAll(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g, (match) =>
        " ".repeat(match.length),
      );
      if (/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(prose)) {
        warning(
          "HTML entities require decoding before deciding prose punctuation.",
          unit.sourceRange,
        );
        prose = prose.replaceAll(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match) =>
          " ".repeat(match.length),
        );
      }
      Iterator.from(context.wordGroups ?? []).forEach((group) => {
        if (!["quoted", "title", "proper-noun", "formula"].includes(group.category)) {
          return;
        }
        prose = prose.replaceAll(group.text, " ".repeat(group.text.length));
      });
      if (/["“”‘’]/.test(prose)) {
        warning(
          "Unbalanced quotation marks make punctuation ownership uncertain.",
          unit.sourceRange,
        );
      }
      Iterator.from(prose.matchAll(/;/gu)).forEach((match) => {
        findings.push({
          defect: "semicolon",
          basis: "ASD-STE100 Issue 9 rule 8.1",
          message: "STE prose does not permit a semicolon.",
          sourceRange: sourceRange(markdown, start + match.index, start + match.index + 1),
        });
      });
      continue;
    }
    if (check.kind === "ste-dictionary-membership") {
      if (!context.vocabulary) {
        warning(
          "No trustworthy private Issue 9 vocabulary data was supplied. Dictionary membership is unavailable, not a compliance pass.",
          unit.sourceRange,
        );
        continue;
      }
      /** @type {Map<string, VocabularyEntry[]>} */
      const entries = new Map();
      Iterator.from(context.vocabulary.entries).forEach((entry) => {
        for (const form of [entry.word, ...(entry.forms ?? [])]) {
          const key = form.toLowerCase();
          entries.set(key, [...(entries.get(key) ?? []), entry]);
        }
      });
      const technical = context.vocabulary.technicalTerms ?? [];
      const forms = [
        ...new Set([
          ...entries.keys(),
          ...technical.map((term) => (matchesString(term) ? term : term.text).toLowerCase()),
        ]),
      ].sort((left, right) => right.length - left.length);
      let consumed = 0;
      Iterator.from(text.matchAll(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)).forEach((match) => {
        if (match.index < consumed) {
          return;
        }
        if (/^[0-9]+$/u.test(match[0])) {
          return;
        }
        const form = forms.find(
          (candidate) =>
            text.slice(match.index, match.index + candidate.length).toLowerCase() === candidate &&
            !/[\p{L}\p{N}_'-]/u.test(text[match.index + candidate.length] ?? ""),
        );
        const term = form ? text.slice(match.index, match.index + form.length) : match[0];
        consumed = match.index + term.length;
        const records = (form ? entries.get(form) : []) ?? [];
        const matchedTechnical = technical.filter(
          (candidate) =>
            (matchesString(candidate) ? candidate : candidate.text).toLowerCase() ===
            term.toLowerCase(),
        );
        const technicalRecords = matchedTechnical.filter((candidate) => hasObjectType(candidate));
        lexicalCandidates.push({
          term,
          membership: records.some((entry) => entry.approved)
            ? "approved-form"
            : records.length
              ? "not-approved-entry"
              : "unlisted",
          technicalTermCandidate: matchedTechnical.length > 0,
          technicalRecords,
          records: records.map((entry) => ({
            word: entry.word,
            approved: entry.approved,
            partOfSpeech: entry.partOfSpeech,
            meaning: entry.meaning,
            listedForms: [entry.word, ...(entry.forms ?? [])].filter(
              (listed) => listed.toLowerCase() === term.toLowerCase(),
            ),
          })),
          sourceRange: sourceRange(
            markdown,
            start + match.index,
            start + match.index + term.length,
          ),
        });
      });
      warning(
        "Literal dictionary/inflection membership candidates do not establish contextual meaning, part of speech, or permitted technical noun/verb use (rules 1.1 through 1.4).",
        unit.sourceRange,
      );
      continue;
    }
    const localWarnings = [];
    if (exclusions.length) {
      localWarnings.push({
        reason:
          "Inline code, links, HTML or excluded syntax intersects a prose unit; do not count a partially masked sentence.",
        start: 0,
        end: text.length,
      });
    }
    if (structural) {
      localWarnings.push({ reason: "Unsupported prose structure.", start: 0, end: text.length });
    }
    if (
      context.writingMode === "descriptive" &&
      /^\s*(?:WARNING|CAUTION|DANGER)\s*:/mu.test(text)
    ) {
      localWarnings.push({
        reason:
          "Safety instructions obey the procedural 20-word limit even in descriptive material. Supply a procedural local target.",
        start: 0,
        end: text.length,
      });
    }
    const listLines = [...text.matchAll(/^ {0,3}(?:[-+*]|\d+[.)])\s+[^\n]*(?:\n|$)/gm)];
    let analyses;
    if (listLines.length) {
      if (check.kind === "ste-paragraph-length") {
        localWarnings.push({
          reason:
            "Vertical-list word-count units are not necessarily paragraph sentences (rules 6.6 and 8.4). Paragraph parsing requires review.",
          start: 0,
          end: text.length,
        });
        analyses = [];
      } else {
        const prefix = text.slice(0, listLines[0].index);
        const validList =
          /:\s*$/u.test(prefix) &&
          listLines.every(
            (line, index) =>
              !text
                .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                .trim(),
          );
        if (validList) {
          analyses = [
            { text: prefix.replace(/:(\s*)$/u, ".$1"), offset: 0, fragment: false },
            ...listLines.map((line) => {
              const marker = /^ {0,3}(?:[-+*]|\d+[.)])\s+/u.exec(line[0])[0];
              return {
                text: line[0].slice(marker.length),
                offset: line.index + marker.length,
                fragment: true,
              };
            }),
          ];
        } else {
          // Simple numbered work steps are separate units. Other lists need the 8.4 introduction.
          const steps =
            !prefix.trim() &&
            listLines.every((line) => /^ {0,3}\d+[.)]\s+/u.test(line[0])) &&
            listLines.every(
              (line, index) =>
                !text
                  .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                  .trim(),
            );
          if (steps) {
            analyses = listLines.map((line) => {
              const marker = /^ {0,3}\d+[.)]\s+/u.exec(line[0])[0];
              return {
                text: line[0].slice(marker.length),
                offset: line.index + marker.length,
                fragment: false,
              };
            });
          } else {
            analyses = [];
            localWarnings.push({
              reason:
                "A list without a supported colon introduction or complete numbered steps needs contextual parsing.",
              start: 0,
              end: text.length,
            });
          }
        }
      }
    } else {
      analyses = [{ text, offset: 0, fragment: false }];
    }
    for (const part of analyses) {
      const analysis = analyzeSteProse(
        part.text,
        { ...context, fragment: part.fragment },
        { paragraph: check.kind === "ste-paragraph-length" },
      );
      const warnings = [
        ...localWarnings,
        ...analysis.warnings.map((entry) => ({
          ...entry,
          start: entry.start + part.offset,
          end: entry.end + part.offset,
        })),
      ];
      Iterator.from(warnings).forEach((entry) => {
        warning(entry.reason, sourceRange(markdown, start + entry.start, start + entry.end));
      });
      if (warnings.length) {
        continue;
      }
      if (check.kind === "ste-paragraph-length") {
        counts.push({
          sentenceCount: analysis.paragraphSentences,
          limit: 6,
          sourceRange: unit.sourceRange,
        });
        if (analysis.paragraphSentences > 6) {
          findings.push({
            defect: "paragraph-length",
            sentenceCount: analysis.paragraphSentences,
            limit: 6,
            message: "The descriptive paragraph has more than six sentences (rule 6.6).",
            sourceRange: unit.sourceRange,
          });
        }
      } else {
        Iterator.from(analysis.sentences).forEach((sentence) => {
          const limit = context.writingMode === "procedural" ? 20 : 25;
          const counted = {
            wordCount: sentence.wordCount,
            limit,
            parenthetical: sentence.parenthetical ?? false,
            sourceRange: sourceRange(
              markdown,
              start + part.offset + sentence.start,
              start + part.offset + sentence.end,
            ),
          };
          counts.push(counted);
          if (sentence.wordCount > limit) {
            findings.push({
              ...counted,
              defect: "sentence-length",
              message: `The ${context.writingMode} word-count unit has more than ${limit} words (section 8 counting).`,
            });
          }
        });
      }
    }
    if (!analyses.length) {
      Iterator.from(localWarnings).forEach((entry) => {
        warning(entry.reason, unit.sourceRange);
      });
    }
  }
  return result(
    findings.length
      ? "fail"
      : parserWarnings.length
        ? "insufficient_context"
        : applicable
          ? "pass"
          : "not_applicable",
  );
};

/**
 * @overload
 * @param {SteCheck} check - The selected STE criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {SteResult} The result and STE evidence.
 */
/**
 * @overload
 * @param {MechanicalCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {MechanicalResult | SteResult} The result and collected evidence.
 */
/**
 * @param {MechanicalCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {MechanicalResult | SteResult} The result and collected evidence.
 */
export const runMechanical = function runMechanical(check, markdown, targetRange, context = {}) {
  if (check.kind !== "fenced-code-language" && check.kind !== "prohibited-terms") {
    return runSteMechanical(check, markdown, targetRange, context);
  }
  const { visible, exclusions, fences, uncertainties } = inspectMarkdown(markdown);
  /** @type {(start: number, end: number) => boolean} */
  const within = (start, end) => {
    const range = sourceRange(markdown, start, end);
    return range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  };
  /** @type {Finding[]} */
  const findings = [];
  let applicable = false;
  if (check.kind === "fenced-code-language") {
    Iterator.from(fences).forEach((fence) => {
      if (uncertainties.some((range) => fence.start < range.end && fence.end > range.start)) {
        return;
      }
      if (!within(fence.start, fence.end)) {
        return;
      }
      applicable = true;
      if (!fence.closed) {
        findings.push({
          defect: "unclosed-fence",
          message: "Fenced code block is unclosed, even if its language info string is present.",
          sourceRange: sourceRange(markdown, fence.start, fence.end),
        });
      } else if (!fence.language) {
        findings.push({
          defect: "missing-language",
          message: "Fenced code block has no language info string.",
          sourceRange: sourceRange(markdown, fence.start, fence.openingEnd),
        });
      }
    });
  } else {
    /** @type {(term: string) => string} */
    const normalize = (term) => (check.caseSensitive ? term : term.toLowerCase());
    const prohibited = new Set(check.terms.map(normalize));
    const protectedTerms = new Set((check.protectedTerms ?? []).map(normalize));
    Iterator.from(visible.matchAll(/[\p{L}\p{N}_]+/gu)).forEach((token) => {
      if (!within(token.index, token.index + token[0].length)) {
        return;
      }
      applicable = true;
      if (prohibited.has(normalize(token[0])) && !protectedTerms.has(normalize(token[0]))) {
        findings.push({
          term: token[0],
          basis: "exact-project-restriction",
          message: `Explicitly prohibited project token: ${token[0]}`,
          sourceRange: sourceRange(markdown, token.index, token.index + token[0].length),
        });
      }
    });
  }
  const parserWarnings = uncertainties
    .filter(({ start, end }) => {
      const range = sourceRange(markdown, start, end);
      return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
    })
    .map(({ start, end, reason }) => ({ reason, sourceRange: sourceRange(markdown, start, end) }));
  const choice = findings.length
    ? "fail"
    : parserWarnings.length
      ? "insufficient_context"
      : applicable
        ? "pass"
        : "not_applicable";
  return {
    type: "choice",
    choice,
    confidence: 1,
    reviewRequired: parserWarnings.length > 0,
    findings,
    coverage: {
      claim:
        "Only the declared local supplemental criterion, not STE dictionary or full STE compliance.",
      parserWarnings,
      excluded: exclusions
        .filter(({ start, end }) => {
          const range = sourceRange(markdown, start, end);
          return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
        })
        .map(({ start, end, kind }) => ({ kind, sourceRange: sourceRange(markdown, start, end) })),
    },
  };
};
