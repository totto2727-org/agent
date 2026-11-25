import { sourceRange } from "./mechanical-source-range.mjs";

/** @typedef {import("./mechanical.mjs").MechanicalContext} MechanicalContext */
/** @typedef {import("./mechanical.mjs").Finding} Finding */
/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {{ markdown: string, range: SourceRange, start: number, text: string }} PunctuationInput */
/** @typedef {{ findings: Finding[], warning: (reason: string, range?: SourceRange) => void }} PunctuationEvidence */

const ENTITY = /&(?:#[0-9]+|#[xX][0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/u;
const ENTITIES = new RegExp(ENTITY.source, "gu");
const QUOTED = /"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/gu;
const EXCLUDED_GROUPS = new Set(["quoted", "title", "proper-noun", "formula"]);
const SEMICOLON_LENGTH = 1;

/** @type {(text: string) => string} */
const whitespace = (text) => " ".repeat(text.length);

/** @type {(text: string, groups: NonNullable<MechanicalContext["wordGroups"]>) => string} */
const maskGroups = (text, groups) => {
  const prose = { visible: text };
  Iterator.from(groups).forEach(({ category, text: group }) => {
    if (EXCLUDED_GROUPS.has(category)) {
      prose.visible = prose.visible.replaceAll(group, whitespace(group));
    }
  });
  return prose.visible;
};

/** @type {(text: string, warning: PunctuationEvidence["warning"], range: SourceRange) => string} */
const maskEntities = (text, warning, range) => {
  if (!ENTITY.test(text)) {
    return text;
  }
  warning("HTML entities require decoding before deciding prose punctuation.", range);
  return text.replaceAll(ENTITIES, (match) => whitespace(match));
};

/** @type {(input: PunctuationInput, context: MechanicalContext, evidence: PunctuationEvidence) => void} */
export const checkPunctuation = (
  { markdown, range, start, text },
  context,
  { findings, warning },
) => {
  // Unchangeable quoted text can be non-STE under rule 8.6.
  const quoted = text.replaceAll(QUOTED, (match) => whitespace(match));
  const prose = maskGroups(maskEntities(quoted, warning, range), context.wordGroups ?? []);
  if (/["“”‘’]/u.test(prose)) {
    warning("Unbalanced quotation marks make punctuation ownership uncertain.", range);
  }
  Iterator.from(prose.matchAll(/;/gu)).forEach(({ index }) => {
    // oxlint-disable-next-line eslint/sort-keys -- Keep defect, origin and coordinates in the public finding order.
    findings.push({
      defect: "semicolon",
      basis: "ASD-STE100 Issue 9 rule 8.1",
      message: "STE prose does not permit a semicolon.",
      sourceRange: sourceRange(markdown, start + index, start + index + SEMICOLON_LENGTH),
    });
  });
};
