import {
  choiceFor,
  COMPLETE_CONFIDENCE,
  contains,
  exclusionRanges,
  sourceSpan,
  warningRanges,
} from "./mechanical-evidence.mjs";
import { sourceRange } from "./mechanical-source-range.mjs";
import { inspectMarkdown } from "./mechanical-source.mjs";

/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-source.mjs").Fence} Fence */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {import("./mechanical.mjs").Finding} Finding */
/** @typedef {import("./mechanical.mjs").MechanicalResult} MechanicalResult */
/** @typedef {import("./mechanical-criteria.mjs").ProhibitedTerms} ProhibitedTerms */
/** @typedef {ProhibitedTerms | { kind: "fenced-code-language" }} LocalCheck */
/** @typedef {{ applicable: boolean, findings: Finding[] }} Evidence */
/** @typedef {{ markdown: string, target: SourceRange }} LocalTarget */
/** @typedef {{ fences: Fence[], uncertainties: Uncertainty[] }} Layout */

const FIRST_LENGTH = 0;
const NO_FINDING = undefined;

/** @type {(markdown: string, fence: Fence) => Finding | undefined} */
const fenceFinding = (markdown, fence) => {
  if (!fence.closed) {
    return {
      defect: "unclosed-fence",
      message: "Fenced code block is unclosed, even if its language info string is present.",
      sourceRange: sourceSpan(markdown, fence),
    };
  }
  if (!fence.language) {
    return {
      defect: "missing-language",
      message: "Fenced code block has no language info string.",
      sourceRange: sourceRange(markdown, fence.start, fence.openingEnd),
    };
  }
  return NO_FINDING;
};

/** @type {(input: LocalTarget, layout: Layout) => Evidence} */
const fenceEvidence = ({ markdown, target }, { fences, uncertainties }) => {
  const selected = fences.filter(
    (fence) =>
      !uncertainties.some((range) => fence.start < range.end && fence.end > range.start) &&
      contains(sourceSpan(markdown, fence), target),
  );
  const findings = selected.flatMap((fence) => {
    const finding = fenceFinding(markdown, fence);
    return finding ? [finding] : [];
  });
  return { applicable: selected.length > FIRST_LENGTH, findings };
};

/** @type {(term: string, range: SourceRange) => Finding} */
const prohibitedFinding = (term, range) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public finding field order.
  ({
    term,
    basis: "exact-project-restriction",
    message: `Explicitly prohibited project token: ${term}`,
    sourceRange: range,
  });

/** @type {(check: ProhibitedTerms, input: LocalTarget, visible: string) => Evidence} */
const termEvidence = (check, { markdown, target }, visible) => {
  /** @type {(term: string) => string} */
  const normalize = (term) => ((check.caseSensitive ?? false) ? term : term.toLowerCase());
  const prohibited = new Set(check.terms.map((term) => normalize(term)));
  const protectedTerms = new Set((check.protectedTerms ?? []).map((term) => normalize(term)));
  /** @type {Evidence} */
  const evidence = { applicable: false, findings: [] };
  Iterator.from(visible.matchAll(/[\p{L}\p{N}_]+/gu)).forEach((token) => {
    const [term] = token;
    const range = sourceRange(markdown, token.index, token.index + term.length);
    if (contains(range, target)) {
      evidence.applicable = true;
      if (prohibited.has(normalize(term)) && !protectedTerms.has(normalize(term))) {
        evidence.findings.push(prohibitedFinding(term, range));
      }
    }
  });
  return evidence;
};

/** @type {(check: LocalCheck, markdown: string, target: SourceRange) => MechanicalResult} */
export const runLocalMechanical = (check, markdown, target) => {
  const layout = inspectMarkdown(markdown);
  const input = { markdown, target };
  const { applicable, findings } =
    check.kind === "fenced-code-language"
      ? fenceEvidence(input, layout)
      : termEvidence(check, input, layout.visible);
  const parserWarnings = warningRanges(markdown, target, layout.uncertainties);
  const choice = choiceFor(findings.length, parserWarnings.length, applicable);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public result field order.
  return {
    type: "choice",
    choice,
    confidence: COMPLETE_CONFIDENCE,
    reviewRequired: parserWarnings.length > FIRST_LENGTH,
    findings,
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the coverage field order in the public report.
    coverage: {
      claim:
        "Only the declared local supplemental criterion, not STE dictionary or full STE compliance.",
      parserWarnings,
      excluded: exclusionRanges(markdown, target, layout.exclusions),
    },
  };
};
