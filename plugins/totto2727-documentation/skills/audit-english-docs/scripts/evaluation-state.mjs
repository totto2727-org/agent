import { sourceRange } from "./mechanical.mjs";
import { matchesNull } from "./native-predicates.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Rule} Rule */
/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {import("./evaluation-work.mjs").PreparedQuestion} PreparedQuestion */
/** @typedef {ReturnType<typeof sourceRange>} SourceRange */
/** @typedef {{ check: PreparedQuestion["check"], criteria: PreparedQuestion["criteria"], id: string, instructions: PreparedQuestion["instructions"], rule: { engine: PreparedWork["engine"], id: string, scope: PreparedWork["scope"], source: Rule["source"] }, type: PreparedQuestion["type"] | "mechanical" }} QuestionSnapshot */
/** @typedef {{ documentId: string, engine: PreparedWork["engine"], nounGroupCounts?: NounEvidence, path: string, questions: QuestionSnapshot[], scope: PreparedWork["scope"], section: null | { headingPath: string[], id: unknown, sourceRange: SourceRange }, sourceLanguage: string | null, sourceRange: SourceRange, templateConstraints: string[] }} ReportBase */
/** @typedef {import("./evaluation-work.mjs").DictionaryEvidence} DictionaryEvidence */
/** @typedef {import("./evaluation-work.mjs").NounEvidence} NounEvidence */
/** @typedef {{ dictionaryCandidates?: DictionaryEvidence, markdown: string, nounGroupCounts?: NounEvidence }} PageEvidence */
/** @typedef {PageEvidence & { headingPath: string[], sourceRange: ReturnType<typeof sourceRange> }} LocalEvidence */
/** @typedef {{ evidence: { document: { audience: string, purpose: string, sourceLanguage: string | null, templateConstraints: string[] }, local: LocalEvidence | null, page: PageEvidence } }} EvaluationState */

const DOCUMENT_START = 0;
// oxlint-disable-next-line unicorn/no-null -- An unspecified report value is represented by JSON null in the public payload.
const ABSENT = null;

/** @type {(item: PreparedWork) => EvaluationState["evidence"]} */
const evidenceFor = (item) =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the state fields sent to the evaluator and included in the cache fingerprint.
  ({
    // oxlint-disable-next-line eslint/sort-keys -- Keep document metadata in the established state key order.
    document: {
      purpose: item.document.purpose,
      audience: item.document.audience,
      templateConstraints: item.document.templateConstraints,
      sourceLanguage: item.document.sourceLanguage ?? ABSENT,
    },
    page: { markdown: item.page },
    local: matchesNull(item.section)
      ? ABSENT
      : {
          headingPath: item.section.headingPath,
          markdown: item.section.text,
          sourceRange: item.section.sourceRange,
        },
  });

/** @type {(item: PreparedWork) => EvaluationState} */
export const stateFor = (item) => {
  const evidence = evidenceFor(item);
  const target = evidence.local ?? evidence.page;
  if (item.dictionaryEvidence) {
    target.dictionaryCandidates = item.dictionaryEvidence;
  }
  if (item.nounEvidence?.length ?? DOCUMENT_START) {
    target.nounGroupCounts = item.nounEvidence;
  }
  return { evidence };
};

/** @type {(item: PreparedWork, rules: Rule[]) => QuestionSnapshot[]} */
const reportQuestionsFor = (item, rules) => {
  /** @type {{ questions: Record<string, PreparedQuestion> }} */
  const { questions } = item;
  return Object.entries(questions).map(([id, question]) =>
    // oxlint-disable-next-line eslint/sort-keys -- Preserve question field order in the public report.
    ({
      id,
      type: item.engine === "mechanical" ? "mechanical" : question.type,
      instructions: question.instructions,
      criteria: question.criteria,
      check: question.check,
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the full rule snapshot in public report key order.
      rule: {
        id: question.ruleId,
        scope: item.scope,
        engine: item.engine,
        source: rules.find((rule) => rule.id === question.ruleId)?.source,
      },
    }),
  );
};

/**
 * Builds the common report fields for a single document scope.
 * @param {PreparedWork} item - The prepared evaluation target.
 * @param {Rule[]} rules - The rule catalog used to prepare the questions.
 * @returns {ReportBase} The common report fields and the question snapshots.
 */
export const reportBaseFor = (item, rules) => {
  const questions = reportQuestionsFor(item, rules);
  // oxlint-disable-next-line eslint/sort-keys -- Keep common evaluation fields in the public JSON report order.
  return {
    documentId: item.document.id,
    path: item.path,
    scope: item.scope,
    engine: item.engine,
    templateConstraints: item.document.templateConstraints,
    sourceLanguage: item.document.sourceLanguage ?? ABSENT,
    ...((item.nounEvidence?.length ?? DOCUMENT_START)
      ? { nounGroupCounts: item.nounEvidence }
      : {}),
    sourceRange:
      item.section?.sourceRange ?? sourceRange(item.page, DOCUMENT_START, item.page.length),
    section: item.section
      ? // oxlint-disable-next-line eslint/sort-keys -- Keep the section identity before its heading path and range.
        {
          id: item.section.id,
          headingPath: item.section.headingPath,
          sourceRange: item.section.sourceRange,
        }
      : ABSENT,
    questions,
  };
};
