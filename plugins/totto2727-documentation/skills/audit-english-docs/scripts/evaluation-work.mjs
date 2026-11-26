// oxlint-disable-next-line rules/no-node-imports -- The installed skill reads its manifest-selected local evidence with Node.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the manifest paths using the host filesystem conventions.
import nodePath from "node:path";

import { explicitSections, segmentMarkdown } from "./evaluation-sections.mjs";
import { workCollector } from "./evaluation-target-work.mjs";
import { bounded } from "./evaluation-validation.mjs";
import { vocabularyLoader } from "./evaluation-vocabulary.mjs";
import { paragraphUnits, sourceRange } from "./mechanical.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Document} Document */
/** @typedef {import("./evaluation-manifest.mjs").Manifest} Manifest */
/** @typedef {import("./evaluation-manifest.mjs").Rule} Rule */
/** @typedef {import("./evaluation-manifest.mjs").RuleScope} RuleScope */
/** @typedef {import("./evaluation-sections.mjs").Section} Section */
/** @typedef {import("./evaluation-vocabulary.mjs").LocalSteContext} LocalSteContext */
/** @typedef {import("./evaluation-questions.mjs").DecisionQuestion} DecisionQuestion */
/** @typedef {{ document: Document, page: string, path: string, scope: RuleScope, section: Section | null, ste: LocalSteContext }} EvaluationTarget */
/** @typedef {import("./mechanical.mjs").MechanicalCheck} MechanicalCheck */
/** @typedef {{ check: MechanicalCheck, criteria?: undefined, instructions?: undefined, ruleId: string, type?: undefined }} MechanicalQuestion */
/** @typedef {DecisionQuestion & { check?: undefined, ruleId: string }} PreparedDecisionQuestion */
/** @typedef {MechanicalQuestion | PreparedDecisionQuestion} PreparedQuestion */
/** @typedef {import("./evaluation-evidence.mjs").DictionaryEvidence} DictionaryEvidence */
/** @typedef {import("./evaluation-evidence.mjs").NounEvidence} NounEvidence */
/** @typedef {EvaluationTarget & { dictionaryEvidence?: undefined, engine: "mechanical", nounEvidence?: undefined, questions: Record<string, MechanicalQuestion>, unavailable: boolean }} MechanicalWork */
/** @typedef {EvaluationTarget & { dictionaryCoverageComplete: boolean, dictionaryEvidence: DictionaryEvidence, engine: "decision", nounCoverageComplete: boolean, nounEvidence: NounEvidence, questionMap: Record<string, string>, questions: Record<string, PreparedDecisionQuestion>, requestQuestions: Record<string, DecisionQuestion>, unavailable: boolean, unavailableReason: string | undefined }} DecisionWork */
/** @typedef {MechanicalWork | DecisionWork} PreparedWork */

export { segmentMarkdown } from "./evaluation-sections.mjs";

/** @typedef {import("./ste.mjs").SteContext} SteContext */
/** @typedef {Pick<EvaluationTarget, "document" | "page" | "path">} DocumentSource */
/** @typedef {{ addItem: (target: EvaluationTarget) => void, localContext: (context: SteContext) => Promise<LocalSteContext> }} WorkCollector */

const DOCUMENT_START = 0;
// oxlint-disable-next-line unicorn/no-null -- Existing page-scoped records use JSON null for the section.
const WHOLE_PAGE = null;

/** @type {(page: string, sections: Section[], hasParagraphRules: boolean) => Section[]} */
const paragraphsFor = (page, sections, hasParagraphRules) => {
  if (!hasParagraphRules) {
    return [];
  }
  const paragraphs = paragraphUnits(page, sections);
  if (paragraphs.length) {
    return paragraphs;
  }
  return [
    // oxlint-disable-next-line eslint/sort-keys -- Keep the unavailable paragraph record in report key order.
    {
      id: "paragraph-unavailable",
      headingPath: [],
      text: "",
      sourceRange: sourceRange(page, DOCUMENT_START, page.length),
      unavailable: true,
    },
  ];
};

/** @type {(document: Document, sections: Section[]) => SteContext} */
const pageSteContext = (document, sections) => {
  const context = { ...document.ste };
  if (
    sections.some(
      (section) =>
        Boolean(section.ste?.writingMode) && section.ste?.writingMode !== document.ste?.writingMode,
    )
  ) {
    delete context.writingMode;
  }
  return context;
};

/** @type {(source: DocumentSource, targets: { scope: "section" | "paragraph", sections: Section[] }, collector: WorkCollector) => Promise<void>} */
const addLocalTargets = async (source, { scope, sections }, { addItem, localContext }) => {
  // oxlint-disable-next-line rules/no-for-loops -- Load vocabulary and assign report IDs serially in document order.
  for (const section of sections) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep evidence errors and private vocabulary reads in the same order as report numbering.
    const ste = await localContext({ ...source.document.ste, ...section.ste });
    addItem({ ...source, scope, section, ste });
  }
};

/** @type {(source: DocumentSource, rules: Rule[], collector: WorkCollector) => Promise<void>} */
const addDocumentTargets = async (source, rules, collector) => {
  const { document, page } = source;
  const sections = document.sections
    ? explicitSections(document.sections, page)
    : segmentMarkdown(page);
  await addLocalTargets(source, { scope: "section", sections }, collector);
  const hasParagraphRules = rules.some(
    (rule) => rule.scope === "paragraph" && document.ruleIds.includes(rule.id),
  );
  const paragraphs = paragraphsFor(page, sections, hasParagraphRules);
  await addLocalTargets(source, { scope: "paragraph", sections: paragraphs }, collector);
  const ste = await collector.localContext(pageSteContext(document, sections));
  collector.addItem({ ...source, scope: "page", section: WHOLE_PAGE, ste });
};

/** @type {(base: string, original: Document, templateConstraints: string[]) => Promise<DocumentSource>} */
const readDocument = async (base, original, templateConstraints) => {
  const document = {
    ...original,
    templateConstraints: [...templateConstraints, ...original.templateConstraints],
  };
  const path = nodePath.isAbsolute(document.path)
    ? document.path
    : nodePath.resolve(base, document.path);
  const page = bounded(await readFile(path, "utf8"), `document ${document.id}`);
  return { document, page, path };
};

/**
 * @param {Manifest} manifest - The validated document and rule settings.
 * @param {string} manifestPath - The manifest's path for resolving local inputs.
 * @returns {Promise<PreparedWork[]>} The evaluations in report order.
 */
export const buildWork = async (manifest, manifestPath) => {
  const base = nodePath.dirname(nodePath.resolve(manifestPath));
  /** @type {PreparedWork[]} */
  const work = [];
  const collector = {
    addItem: workCollector(manifest.rules, work),
    localContext: vocabularyLoader(base),
  };
  // oxlint-disable-next-line rules/no-for-loops -- Prepare documents serially so the report and first failing input retain manifest order.
  for (const original of manifest.documents) {
    if (!manifest.englishOnly || /^en(?:-|$)/iu.test(original.sourceLanguage ?? "")) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read only the next document after the previous document succeeds.
      const source = await readDocument(base, original, manifest.templateConstraints);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Vocabulary reads and report IDs follow document, section, paragraph, then page order.
      await addDocumentTargets(source, manifest.rules, collector);
    }
  }
  return work;
};
