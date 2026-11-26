import { proseParts } from "./mechanical-prose-units.mjs";
import { sourceRange } from "./mechanical-source-range.mjs";
import { analyzeSteProse } from "./ste.mjs";

/** @typedef {import("./mechanical.mjs").MechanicalContext} MechanicalContext */
/** @typedef {import("./mechanical.mjs").Finding} Finding */
/** @typedef {import("./mechanical.mjs").ProseCount} ProseCount */
/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-prose-units.mjs").LocalWarning} LocalWarning */
/** @typedef {import("./mechanical-prose-units.mjs").ProsePart} ProsePart */
/** @typedef {ReturnType<typeof analyzeSteProse>} Analysis */
/** @typedef {{ hasExclusions: boolean, markdown: string, range: SourceRange, start: number, structural: boolean, text: string }} MeasurementInput */
/** @typedef {{ counts: ProseCount[], findings: Finding[], warning: (reason: string, range?: SourceRange) => void }} MeasurementEvidence */

const START = 0;
const PROCEDURAL_WORD_LIMIT = 20;
const DESCRIPTIVE_WORD_LIMIT = 25;
const SENTENCE_LIMIT = 6;

/** @type {(input: MeasurementInput, context: MechanicalContext) => LocalWarning[]} */
const initialWarnings = ({ hasExclusions, structural, text }, { writingMode }) => {
  /** @type {LocalWarning[]} */
  const warnings = [];
  if (hasExclusions) {
    warnings.push({
      end: text.length,
      reason:
        "Inline code, links, HTML or excluded syntax intersects a prose unit; do not count a partially masked sentence.",
      start: START,
    });
  }
  if (structural) {
    warnings.push({ end: text.length, reason: "Unsupported prose structure.", start: START });
  }
  if (writingMode === "descriptive" && /^\s*(?:WARNING|CAUTION|DANGER)\s*:/mu.test(text)) {
    warnings.push({
      end: text.length,
      reason:
        "Safety instructions obey the procedural 20-word limit even in descriptive material. Supply a procedural local target.",
      start: START,
    });
  }
  return warnings;
};

/** @type {(range: SourceRange, sentenceCount: number, evidence: MeasurementEvidence) => void} */
const recordParagraph = (range, sentenceCount, { counts, findings }) => {
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the descriptive paragraph count's report order.
  counts.push({ sentenceCount, limit: SENTENCE_LIMIT, sourceRange: range });
  if (sentenceCount > SENTENCE_LIMIT) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the descriptive paragraph finding's report order.
    findings.push({
      defect: "paragraph-length",
      sentenceCount,
      limit: SENTENCE_LIMIT,
      message: "The descriptive paragraph has more than six sentences (rule 6.6).",
      sourceRange: range,
    });
  }
};

/** @type {(input: MeasurementInput, detail: { analysis: Analysis, offset: number, writingMode: MechanicalContext["writingMode"] }, evidence: MeasurementEvidence) => void} */
const recordSentences = (
  { markdown, start },
  { analysis, offset, writingMode },
  { counts, findings },
) => {
  const limit = writingMode === "procedural" ? PROCEDURAL_WORD_LIMIT : DESCRIPTIVE_WORD_LIMIT;
  Iterator.from(analysis.sentences).forEach((sentence) => {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the fields of a sentence count in public report order.
    const counted = {
      wordCount: sentence.wordCount,
      limit,
      parenthetical: sentence.parenthetical ?? false,
      sourceRange: sourceRange(
        markdown,
        start + offset + sentence.start,
        start + offset + sentence.end,
      ),
    };
    counts.push(counted);
    if (sentence.wordCount > limit) {
      findings.push({
        ...counted,
        defect: "sentence-length",
        message: `The ${writingMode} word-count unit has more than ${limit} words (section 8 counting).`,
      });
    }
  });
};

/** @type {(input: MeasurementInput, detail: { analysis: Analysis, local: LocalWarning[], offset: number }, report: MeasurementEvidence["warning"]) => boolean} */
const reportWarnings = ({ markdown, start }, { analysis, local, offset }, report) => {
  const warnings = [
    ...local,
    ...analysis.warnings.map((entry) => ({
      ...entry,
      end: entry.end + offset,
      start: entry.start + offset,
    })),
  ];
  Iterator.from(warnings).forEach((entry) => {
    report(entry.reason, sourceRange(markdown, start + entry.start, start + entry.end));
  });
  return warnings.length > START;
};

/** @type {(part: ProsePart, input: MeasurementInput, settings: { context: MechanicalContext, evidence: MeasurementEvidence, local: LocalWarning[], paragraph: boolean }) => void} */
const measurePart = (part, input, { context, evidence, local, paragraph }) => {
  const analysis = analyzeSteProse(
    part.text,
    { ...context, fragment: part.fragment },
    { paragraph },
  );
  if (reportWarnings(input, { analysis, local, offset: part.offset }, evidence.warning)) {
    return;
  }
  if (paragraph) {
    recordParagraph(input.range, analysis.paragraphSentences, evidence);
  } else {
    recordSentences(
      input,
      { analysis, offset: part.offset, writingMode: context.writingMode },
      evidence,
    );
  }
};

/** @type {(input: MeasurementInput, settings: { context: MechanicalContext, paragraph: boolean }, evidence: MeasurementEvidence) => void} */
export const checkMeasurement = (input, { context, paragraph }, evidence) => {
  const local = initialWarnings(input, context);
  const parts = proseParts(input.text, paragraph, local);
  parts.forEach((part) => {
    measurePart(part, input, { context, evidence, local, paragraph });
  });
  if (!parts.length) {
    Iterator.from(local).forEach((entry) => {
      evidence.warning(entry.reason, input.range);
    });
  }
};
