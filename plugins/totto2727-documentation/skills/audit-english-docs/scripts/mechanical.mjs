import { checkMeasurement } from "./mechanical-measurement.mjs";
import { checkDictionary } from "./mechanical-dictionary.mjs";
import {
  choiceFor,
  COMPLETE_CONFIDENCE,
  contains,
  exclusionRanges,
  overlaps,
  warningRanges,
} from "./mechanical-evidence.mjs";
import { checkPunctuation } from "./mechanical-punctuation.mjs";
import { runLocalMechanical } from "./mechanical-local.mjs";
import { paragraphUnits } from "./mechanical-paragraphs.mjs";
import { inspectMarkdown } from "./mechanical-source.mjs";
import { sourceRange } from "./mechanical-source-range.mjs";

export { validateMechanicalCheck } from "./mechanical-criteria.mjs";
export { sourceRange } from "./mechanical-source-range.mjs";
export { inspectMarkdown } from "./mechanical-source.mjs";
export { nounGroupCounts } from "./mechanical-nouns.mjs";
export { paragraphUnits } from "./mechanical-paragraphs.mjs";

/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-source.mjs").TextRange} TextRange */
/** @typedef {import("./mechanical-source.mjs").FenceOpening} FenceOpening */
/** @typedef {import("./mechanical-source.mjs").Fence} Fence */
/** @typedef {import("./mechanical-source.mjs").Exclusion} Exclusion */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {import("./mechanical-source.mjs").RecordExclusion} RecordExclusion */
/** @typedef {import("./mechanical-nouns.mjs").NounGroupEvidence} NounGroupEvidence */
/** @typedef {import("./mechanical-criteria.mjs").SteCheck} SteCheck */
/** @typedef {import("./mechanical-criteria.mjs").MechanicalCheck} MechanicalCheck */
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
 * @typedef {import("./mechanical-paragraphs.mjs").Paragraph<Context>} Paragraph
 */

/** @typedef {{ markdown: string, targetRange: SourceRange }} SteInput */
/** @typedef {{ applicable: boolean, counts: ProseCount[], findings: Finding[], lexicalCandidates: LexicalCandidate[], parserWarnings: ParserWarning[], warning: (reason: string, range?: SourceRange) => void }} SteEvidence */
/** @typedef {SteInput & { check: SteCheck, context: MechanicalContext, evidence: SteEvidence, inspection: ReturnType<typeof inspectMarkdown> }} Assessment */
/** @typedef {import("./mechanical-measurement.mjs").MeasurementInput} MeasurementInput */

const DOCUMENT_START = 0;
const NO_MODE_OVERRIDE = undefined;
const NO_VISIBLE_UNIT = undefined;
// oxlint-disable-next-line unicorn/no-null -- Reports serialize an unspecified writing mode as JSON null.
const NO_MODE = null;

/** @type {(input: SteInput, inspection: ReturnType<typeof inspectMarkdown>) => SteEvidence} */
const newEvidence = ({ markdown, targetRange }, inspection) => {
  const parserWarnings = warningRanges(markdown, targetRange, inspection.uncertainties);
  /** @type {SteEvidence["warning"]} */
  const warning = (reason, range = targetRange) => {
    parserWarnings.push({ reason, sourceRange: range });
  };
  return {
    applicable: false,
    counts: [],
    findings: [],
    lexicalCandidates: [],
    parserWarnings,
    warning,
  };
};

/** @type {(assessment: Assessment, choice: Choice) => SteResult} */
const resultFor = ({ check, context, evidence, inspection, markdown, targetRange }, choice) => {
  const { counts, findings, lexicalCandidates, parserWarnings } = evidence;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the established STE result property order.
  return {
    type: "choice",
    choice,
    confidence: COMPLETE_CONFIDENCE,
    reviewRequired:
      parserWarnings.length > DOCUMENT_START || check.kind === "ste-dictionary-membership",
    findings,
    counts,
    lexicalCandidates,
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the STE coverage field order in the public report.
    coverage: {
      claim:
        "Only the declared ASD-STE100 Issue 9 local criterion, not full STE compliance. Counts require declared writing mode and unambiguous section 8 word groups.",
      writingMode: context.writingMode ?? NO_MODE,
      declaredWordGroups: context.wordGroups ?? [],
      parserWarnings,
      excluded: exclusionRanges(markdown, targetRange, inspection.exclusions),
    },
  };
};

/** @type {(assessment: Assessment) => Choice | undefined} */
const checkWritingMode = ({ check, context, evidence }) => {
  if (check.kind !== "ste-sentence-length" && check.kind !== "ste-paragraph-length") {
    return NO_MODE_OVERRIDE;
  }
  const { writingMode } = context;
  const hasMode = Boolean(writingMode);
  if (!hasMode) {
    evidence.warning(
      "Declare document.ste.writingMode or an explicit section.ste.writingMode. Procedures, descriptions, notes and safety instructions have different applicability.",
    );
    return "insufficient_context";
  }
  const mode = check.kind === "ste-sentence-length" ? check.writingMode : "descriptive";
  return writingMode === mode ? NO_MODE_OVERRIDE : "not_applicable";
};

/** @type {(assessment: Assessment, unit: Paragraph<unknown>) => MeasurementInput | undefined} */
const visibleUnit = ({ inspection, markdown }, unit) => {
  const { sourceRange: range } = unit;
  const start = Buffer.from(markdown).subarray(DOCUMENT_START, range.startByte).toString().length;
  const end = start + unit.text.length;
  const exclusions = inspection.exclusions.filter(
    (entry) => entry.start < end && entry.end > start,
  );
  const text = inspection.visible.slice(start, end);
  if (exclusions.some((entry) => entry.start <= start && entry.end >= end) || !text.trim()) {
    return NO_VISIBLE_UNIT;
  }
  const structural = /^(?: {0,3}>| {0,3}\|| {0,3}\[| {0,3}(?:=+|-+)\s*$)/mu.test(text);
  return { hasExclusions: Boolean(exclusions.length), markdown, range, start, structural, text };
};

/** @type {(assessment: Assessment, input: MeasurementInput) => void} */
const appliedCriterion = ({ check, context, evidence }, input) => {
  if (check.kind === "ste-punctuation") {
    checkPunctuation(input, context, evidence);
  } else if (check.kind === "ste-dictionary-membership") {
    checkDictionary(input, context.vocabulary, evidence);
  } else {
    checkMeasurement(
      input,
      { context, paragraph: check.kind === "ste-paragraph-length" },
      evidence,
    );
  }
};

/** @type {(assessment: Assessment, input: MeasurementInput) => void} */
const assessVisible = (assessment, input) => {
  const { evidence } = assessment;
  evidence.applicable = true;
  if (input.structural) {
    evidence.warning(
      "Unsupported block quote, table, reference, or setext/container structure requires contextual parsing.",
      input.range,
    );
  }
  appliedCriterion(assessment, input);
};

/** @type {(assessment: Assessment, unit: Paragraph<unknown>) => void} */
const assessParagraph = (assessment, unit) => {
  const { evidence, targetRange } = assessment;
  const { sourceRange: range } = unit;
  if (!overlaps(range, targetRange)) {
    return;
  }
  if (!contains(range, targetRange)) {
    evidence.warning(
      "The local source range selects only part of a paragraph or sentence. Select the complete paragraph.",
      range,
    );
    return;
  }
  const input = visibleUnit(assessment, unit);
  if (input) {
    assessVisible(assessment, input);
  }
};

/** @type {(check: SteCheck, input: SteInput, context: MechanicalContext) => SteResult} */
const runSteMechanical = (check, { markdown, targetRange }, context) => {
  const inspection = inspectMarkdown(markdown);
  const evidence = newEvidence({ markdown, targetRange }, inspection);
  const assessment = { check, context, evidence, inspection, markdown, targetRange };
  const mode = checkWritingMode(assessment);
  if (mode) {
    return resultFor(assessment, mode);
  }
  const paragraphs = paragraphUnits(markdown, [
    { headingPath: [], sourceRange: sourceRange(markdown, DOCUMENT_START, markdown.length) },
  ]);
  Iterator.from(paragraphs).forEach((unit) => {
    assessParagraph(assessment, unit);
  });
  return resultFor(
    assessment,
    choiceFor(evidence.findings.length, evidence.parserWarnings.length, evidence.applicable),
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
// oxlint-disable-next-line eslint/max-params -- Preserve the public check, document, target range, and optional semantic context inputs.
export const runMechanical = function runMechanical(check, markdown, targetRange, context = {}) {
  if (check.kind !== "fenced-code-language" && check.kind !== "prohibited-terms") {
    return runSteMechanical(check, { markdown, targetRange }, context);
  }
  return runLocalMechanical(check, markdown, targetRange);
};
