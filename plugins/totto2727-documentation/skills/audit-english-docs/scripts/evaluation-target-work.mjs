import { dictionaryEvidenceFor, nounEvidenceFor } from "./evaluation-evidence.mjs";
import { questionEntriesFor } from "./evaluation-questions.mjs";
import { sourceRange } from "./mechanical.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Rule} Rule */
/** @typedef {import("./evaluation-work.mjs").EvaluationTarget} EvaluationTarget */
/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {import("./evaluation-work.mjs").MechanicalWork} MechanicalWork */
/** @typedef {import("./evaluation-work.mjs").DecisionWork} DecisionWork */
/** @typedef {import("./evaluation-questions.mjs").DecisionQuestion} DecisionQuestion */
/** @typedef {import("./evaluation-questions.mjs").RuleQuestion} RuleQuestion */
/** @typedef {import("./evaluation-evidence.mjs").DictionaryState} DictionaryState */
/** @typedef {import("./evaluation-evidence.mjs").NounState} NounState */
/** @typedef {{ dictionary: DictionaryState, noun: NounState }} DecisionEvidence */

const FIRST_QUESTION = 1;
const QUESTION_ID_WIDTH = 6;
const EMPTY_LENGTH = 0;
const DOCUMENT_START = 0;
const NO_MECHANICAL_WORK = undefined;

/** @type {(index: number) => string} */
const questionId = (index) => `q-${String(index).padStart(QUESTION_ID_WIDTH, "0")}`;

/** @type {(target: EvaluationTarget) => Omit<EvaluationTarget, "ste">} */
const sourceKeys = ({ document, page, path, scope, section }) =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep source fields in their existing report order.
  ({ document, path, scope, section, page });

/** @type {(target: EvaluationTarget, rules: Rule[], nextQuestionId: () => string) => MechanicalWork | undefined} */
const mechanicalWorkFor = (target, rules, nextQuestionId) => {
  const { document, scope, section, ste } = target;
  const mechanical = rules
    .filter((rule) => rule.engine === "mechanical")
    .filter((rule) => rule.scope === scope && document.ruleIds.includes(rule.id));
  if (!mechanical.length) {
    return NO_MECHANICAL_WORK;
  }
  const questions = Object.fromEntries(
    // oxlint-disable-next-line eslint/sort-keys -- Keep ruleId before the check information in report questions.
    mechanical.map((rule) => [nextQuestionId(), { ruleId: rule.id, check: rule.check }]),
  );
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the case and property order of existing mechanical work records.
  return {
    ...sourceKeys(target),
    questions,
    engine: "mechanical",
    ste,
    unavailable: section?.unavailable ?? false,
  };
};

/** @type {(entries: RuleQuestion[], nextQuestionId: () => string) => Pick<DecisionWork, "questionMap" | "questions" | "requestQuestions">} */
const numberedQuestions = (entries, nextQuestionId) => {
  /** @type {Record<string, DecisionQuestion & { ruleId: string }>} */
  const questions = {};
  /** @type {Record<string, DecisionQuestion>} */
  const requestQuestions = {};
  /** @type {Record<string, string>} */
  const questionMap = {};
  entries.forEach(({ ruleId, question }, index) => {
    // Reports keep run-wide numbering. Requests use local IDs so equivalent work shares its cache.
    const originalId = nextQuestionId();
    const requestId = questionId(index + FIRST_QUESTION);
    questions[originalId] = { ...question, ruleId };
    requestQuestions[requestId] = question;
    questionMap[requestId] = originalId;
  });
  // oxlint-disable-next-line eslint/sort-keys -- Consumers serialize the three maps in report order.
  return { questions, requestQuestions, questionMap };
};

/** @type {(target: EvaluationTarget, decision: { evidence: DecisionEvidence, numbered: ReturnType<typeof numberedQuestions> }, blockReason?: string) => DecisionWork} */
const decisionWork = (target, { evidence: { dictionary, noun }, numbered }, blockReason) =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep decision work field order in report JSON and cache inputs.
  ({
    ...sourceKeys(target),
    ...numbered,
    engine: "decision",
    ste: target.ste,
    nounEvidence: noun.evidence,
    nounCoverageComplete: noun.complete,
    dictionaryEvidence: dictionary.evidence,
    dictionaryCoverageComplete: dictionary.complete,
    unavailable: (target.section?.unavailable ?? false) || Boolean(blockReason),
    unavailableReason: blockReason,
  });

/** @type {(entries: RuleQuestion[], rules: Rule[], evidence: DecisionEvidence) => { blocked: RuleQuestion[], eligible: RuleQuestion[], reason: string }} */
const filterByEvidence = (entries, rules, { dictionary, noun }) => {
  /** @type {(entry: RuleQuestion) => boolean} */
  const needsNouns = (entry) =>
    (rules.find((rule) => rule.id === entry.ruleId)?.requiresNounGroupCounts ?? false) &&
    !noun.hasMatches;
  /** @type {(entry: RuleQuestion) => boolean} */
  const isBlocked = (entry) =>
    ((rules.find((rule) => rule.id === entry.ruleId)?.requiresDictionaryEntries ?? false) &&
      !dictionary.hasMatches) ||
    needsNouns(entry);
  const eligible = entries.filter((entry) => !isBlocked(entry));
  const blocked = entries.filter((entry) => isBlocked(entry));
  const reason = blocked.some((entry) => needsNouns(entry))
    ? "Required noun-group counts are not available for this local target. No model request is made and model counting is not a substitute."
    : "Required dictionary entries are not available for this local target. No model request is made and model memory is not a substitute.";
  return { blocked, eligible, reason };
};

/** @type {(target: EvaluationTarget, rules: Rule[], nextQuestionId: () => string) => DecisionWork[]} */
const decisionWorkFor = (target, rules, nextQuestionId) => {
  const { document, page, scope, section, ste } = target;
  const entries = questionEntriesFor(document, rules, scope);
  if (entries.length === EMPTY_LENGTH) {
    return [];
  }
  const range = section?.sourceRange ?? sourceRange(page, DOCUMENT_START, page.length);
  const evidence = {
    dictionary: dictionaryEvidenceFor(page, range, ste),
    noun: nounEvidenceFor(page, range, ste),
  };
  const { blocked, eligible, reason } = filterByEvidence(entries, rules, evidence);
  const groups = [{ entries: eligible }, { blockReason: reason, entries: blocked }];
  return groups.flatMap(({ blockReason, entries: selected }) =>
    selected.length > EMPTY_LENGTH
      ? [
          decisionWork(
            target,
            { evidence, numbered: numberedQuestions(selected, nextQuestionId) },
            blockReason,
          ),
        ]
      : [],
  );
};

/** @type {(rules: Rule[], work: PreparedWork[]) => (target: EvaluationTarget) => void} */
export const workCollector = (rules, work) => {
  const sequence = { next: FIRST_QUESTION };
  const nextQuestionId = () => {
    const id = questionId(sequence.next);
    sequence.next += FIRST_QUESTION;
    return id;
  };
  return (target) => {
    const mechanical = mechanicalWorkFor(target, rules, nextQuestionId);
    if (mechanical) {
      work.push(mechanical);
    }
    work.push(...decisionWorkFor(target, rules, nextQuestionId));
  };
};
