// oxlint-disable-next-line rules/no-node-imports -- The installed skill reads its manifest-selected local evidence with Node.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the manifest paths using the host filesystem conventions.
import nodePath from "node:path";

import { questionEntriesFor } from "./evaluation-questions.mjs";
import { explicitSections, segmentMarkdown } from "./evaluation-sections.mjs";

import { bounded, EvaluationError, MAX_EVIDENCE_BYTES, text } from "./evaluation-validation.mjs";
import { nounGroupCounts, paragraphUnits, runMechanical, sourceRange } from "./mechanical.mjs";
import { vocabularyLoader } from "./evaluation-vocabulary.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Document} Document */
/** @typedef {import("./evaluation-manifest.mjs").Manifest} Manifest */
/** @typedef {import("./evaluation-manifest.mjs").Rule} Rule */
/** @typedef {import("./evaluation-manifest.mjs").RuleScope} RuleScope */
/** @typedef {import("./evaluation-sections.mjs").Section} Section */
/** @typedef {import("./evaluation-vocabulary.mjs").LocalSteContext} LocalSteContext */
/** @typedef {import("./evaluation-questions.mjs").DecisionQuestion} DecisionQuestion */
/** @typedef {import("./evaluation-questions.mjs").RuleQuestion} RuleQuestion */
/** @typedef {{ document: Document, page: string, path: string, scope: RuleScope, section: Section | null, ste: LocalSteContext }} EvaluationTarget */
/** @typedef {import("./mechanical.mjs").MechanicalCheck} MechanicalCheck */
/** @typedef {{ check: MechanicalCheck, criteria?: undefined, instructions?: undefined, ruleId: string, type?: undefined }} MechanicalQuestion */
/** @typedef {DecisionQuestion & { check?: undefined, ruleId: string }} PreparedDecisionQuestion */
/** @typedef {MechanicalQuestion | PreparedDecisionQuestion} PreparedQuestion */
/** @typedef {{ candidates: import("./mechanical.mjs").LexicalCandidate[], completeness: string, issue: number, source: string } | { issue: number, unavailable: string } | null} DictionaryEvidence */
/** @typedef {ReturnType<typeof nounGroupCounts<import("./ste.mjs").DeclaredNounGroup>> | Array<{ reason: string, status: "insufficient_context" }>} NounEvidence */
/** @typedef {EvaluationTarget & { dictionaryEvidence?: undefined, engine: "mechanical", nounEvidence?: undefined, questions: Record<string, MechanicalQuestion>, unavailable: boolean }} MechanicalWork */
/** @typedef {EvaluationTarget & { dictionaryCoverageComplete: boolean, dictionaryEvidence: DictionaryEvidence, engine: "decision", nounCoverageComplete: boolean, nounEvidence: NounEvidence, questionMap: Record<string, string>, questions: Record<string, PreparedDecisionQuestion>, requestQuestions: Record<string, DecisionQuestion>, unavailable: boolean, unavailableReason: string | undefined }} DecisionWork */
/** @typedef {MechanicalWork | DecisionWork} PreparedWork */

export { segmentMarkdown } from "./evaluation-sections.mjs";

const { dirname, isAbsolute, resolve } = nodePath;
const firstQuestionNumber = 0;
const questionNumberWidth = 6;

/**
 * @param {Manifest} manifest - The validated document and rule settings.
 * @param {string} manifestPath - The manifest's path for resolving local inputs.
 * @returns {Promise<PreparedWork[]>} The evaluations in report order.
 */
export const buildWork = async (manifest, manifestPath) => {
  const base = dirname(resolve(manifestPath));
  /** @type {PreparedWork[]} */
  const work = [];
  const localContext = vocabularyLoader(base);
  let questionNumber = firstQuestionNumber;
  const nextQuestionId = () => `q-${String(++questionNumber).padStart(questionNumberWidth, "0")}`;
  /** @type {(target: EvaluationTarget) => void} */
  const addItem = ({ document, page, path, scope, section, ste }) => {
    const mechanical = manifest.rules
      .filter((rule) => rule.engine === "mechanical")
      .filter((rule) => rule.scope === scope && document.ruleIds.includes(rule.id));
    if (mechanical.length) {
      const questions = Object.fromEntries(
        mechanical.map((rule) => [nextQuestionId(), { ruleId: rule.id, check: rule.check }]),
      );
      work.push({
        document,
        path,
        scope,
        section,
        page,
        questions,
        engine: "mechanical",
        ste,
        unavailable: section?.unavailable ?? false,
      });
    }
    const entries = questionEntriesFor(document, manifest.rules, scope);
    if (!entries.length) {
      return;
    }
    const target = section?.sourceRange ?? sourceRange(page, 0, page.length);
    const dictionaryAnswer = ste.vocabulary
      ? {
          ...runMechanical({ kind: "ste-dictionary-membership" }, page, target, ste),
          source: ste.vocabulary.source,
        }
      : null;
    const dictionaryEvidence = dictionaryAnswer
      ? {
          issue: 9,
          source: dictionaryAnswer.source,
          completeness:
            "Selected literal matches only, not a closed dictionary or a contextual compliance decision.",
          candidates: dictionaryAnswer.lexicalCandidates,
        }
      : null;
    const boundedDictionaryEvidence =
      dictionaryEvidence &&
      Buffer.byteLength(JSON.stringify(dictionaryEvidence)) <= MAX_EVIDENCE_BYTES;
    const hasDictionaryMatches =
      boundedDictionaryEvidence &&
      dictionaryAnswer.lexicalCandidates.some(
        (candidate) => candidate.records.length || candidate.technicalRecords.length,
      );
    /** @type {(entry: RuleQuestion) => boolean | undefined} */
    const requiresDictionary = (entry) =>
      manifest.rules.find((rule) => rule.id === entry.ruleId)?.requiresDictionaryEntries;
    const nounEvidence = nounGroupCounts(page, target, ste?.nounGroups);
    const boundedNounEvidence =
      Buffer.byteLength(JSON.stringify(nounEvidence)) <= MAX_EVIDENCE_BYTES;
    const hasNounCounts =
      boundedNounEvidence && nounEvidence.some((entry) => entry.status === "counted");
    /** @type {(entry: RuleQuestion) => boolean | undefined} */
    const requiresNouns = (entry) =>
      manifest.rules.find((rule) => rule.id === entry.ruleId)?.requiresNounGroupCounts;
    /** @param {RuleQuestion} entry - A rule catalog question. */
    const isBlocked = (entry) =>
      (requiresDictionary(entry) && !hasDictionaryMatches) ||
      (requiresNouns(entry) && !hasNounCounts);
    const eligible = entries.filter((entry) => !isBlocked(entry));
    const blocked = entries.filter(isBlocked);
    for (const group of [eligible, blocked]) {
      if (!group.length) {
        continue;
      }
      /** @type {Record<string, DecisionQuestion & { ruleId: string }>} */
      const questions = {};
      /** @type {Record<string, DecisionQuestion>} */
      const requestQuestions = {};
      /** @type {Record<string, string>} */
      const questionMap = {};
      let localNumber = firstQuestionNumber;
      Iterator.from(group).forEach(({ ruleId, question }) => {
        // Report identities keep the run-wide numbering that existing consumers
        // Rely on. Requests use deterministic, request-local numbering so that
        // Equivalent work from duplicate documents/rules fingerprints identically.
        const originalId = nextQuestionId();
        const requestId = `q-${String(++localNumber).padStart(questionNumberWidth, "0")}`;
        questions[originalId] = { ...question, ruleId };
        requestQuestions[requestId] = question;
        questionMap[requestId] = originalId;
      });
      work.push({
        document,
        path,
        scope,
        section,
        page,
        questions,
        requestQuestions,
        questionMap,
        engine: "decision",
        ste,
        nounEvidence: boundedNounEvidence
          ? nounEvidence
          : [
              {
                status: "insufficient_context",
                reason: "Selected noun-group counts exceed the evidence limit.",
              },
            ],
        nounCoverageComplete:
          hasNounCounts && nounEvidence.every((entry) => entry.status === "counted"),
        dictionaryEvidence: boundedDictionaryEvidence
          ? dictionaryEvidence
          : dictionaryEvidence
            ? {
                issue: 9,
                unavailable:
                  "Selected local dictionary evidence exceeds the bounded evidence limit. Abstain on dictionary-dependent judgments.",
              }
            : null,
        dictionaryCoverageComplete: Boolean(
          boundedDictionaryEvidence &&
          dictionaryAnswer.lexicalCandidates.length &&
          dictionaryAnswer.lexicalCandidates.every(
            (candidate) => candidate.records.length || candidate.technicalRecords.length,
          ) &&
          dictionaryAnswer.coverage.parserWarnings.every((entry) =>
            entry.reason.startsWith("Literal dictionary/inflection membership"),
          ),
        ),
        unavailable: (section?.unavailable ?? false) || group === blocked,
        unavailableReason:
          group === blocked
            ? group.some((entry) => requiresNouns(entry) && !hasNounCounts)
              ? "Required noun-group counts are not available for this local target. No model request is made and model counting is not a substitute."
              : "Required dictionary entries are not available for this local target. No model request is made and model memory is not a substitute."
            : undefined,
      });
    }
  };
  for (const original of manifest.documents) {
    if (manifest.englishOnly && !/^en(?:-|$)/iu.test(original.sourceLanguage ?? "")) {
      continue;
    }
    const document = {
      ...original,
      templateConstraints: [...manifest.templateConstraints, ...original.templateConstraints],
    };
    const path = isAbsolute(document.path) ? document.path : resolve(base, document.path);
    const page = bounded(await readFile(path, "utf8"), `document ${document.id}`);
    const sections = document.sections
      ? explicitSections(document.sections, page)
      : segmentMarkdown(page);
    for (const section of sections) {
      addItem({
        document,
        page,
        path,
        scope: "section",
        section,
        ste: await localContext({ ...document.ste, ...section.ste }),
      });
    }
    const hasParagraphRules = manifest.rules.some(
      (rule) => rule.scope === "paragraph" && document.ruleIds.includes(rule.id),
    );
    /** @type {Section[]} */
    const paragraphs = hasParagraphRules ? paragraphUnits(page, sections) : [];
    if (!paragraphs.length && hasParagraphRules) {
      paragraphs.push({
        id: "paragraph-unavailable",
        headingPath: [],
        text: "",
        sourceRange: sourceRange(page, 0, page.length),
        unavailable: true,
      });
    }
    for (const paragraph of paragraphs) {
      addItem({
        document,
        page,
        path,
        scope: "paragraph",
        section: paragraph,
        ste: await localContext({ ...document.ste, ...paragraph.ste }),
      });
    }
    const pageContext = { ...document.ste };
    if (
      sections.some(
        (section) =>
          section.ste?.writingMode && section.ste.writingMode !== document.ste?.writingMode,
      )
    ) {
      delete pageContext.writingMode;
    }
    addItem({
      document,
      page,
      path,
      scope: "page",
      section: null,
      ste: await localContext(pageContext),
    });
  }
  return work;
};
