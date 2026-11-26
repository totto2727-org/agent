import { provenance, registerId } from "./evaluation-manifest-fields.mjs";
import { EvaluationError, object, text } from "./evaluation-validation.mjs";
import { validateMechanicalCheck } from "./mechanical.mjs";
import { matchesBoolean, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {"page" | "paragraph" | "section"} RuleScope */
/** @typedef {{ id: string, requiresDictionaryEntries?: boolean, requiresNounGroupCounts?: boolean, scope: RuleScope, source: Record<string, unknown> | undefined }} RuleDetails */
/** @typedef {RuleDetails & { engine: "decision", fail: string, instructions: string, pass: string }} DecisionRule */
/** @typedef {RuleDetails & { check: import("./mechanical.mjs").MechanicalCheck, engine: "mechanical" }} MechanicalRule */
/** @typedef {DecisionRule | MechanicalRule} Rule */

/** @type {(rule: Record<string, unknown>, label: string) => { engine: Rule["engine"], scope: RuleScope }} */
const ruleMode = (rule, label) => {
  const scope = rule.scope ?? "section";
  if (scope !== "section" && scope !== "page" && scope !== "paragraph") {
    throw new EvaluationError(`${label}.scope must be section, page, or paragraph`);
  }
  const engine = rule.engine ?? "decision";
  if (engine !== "decision" && engine !== "mechanical") {
    throw new EvaluationError(`${label}.engine must be decision or mechanical`);
  }
  if (engine === "decision" && !matchesUndefined(rule.check)) {
    throw new EvaluationError(`${label}.check requires the mechanical engine`);
  }
  return { engine, scope };
};

/** @type {(value: unknown, field: string, engine: Rule["engine"]) => boolean | undefined} */
const ruleOption = (value, field, engine) => {
  if (!matchesUndefined(value) && (engine !== "decision" || !matchesBoolean(value))) {
    throw new EvaluationError(`${field} requires a boolean on a decision rule`);
  }
  return value;
};

/** @type {(rule: Record<string, unknown>, mode: { engine: Rule["engine"], id: string, scope: RuleScope }, label: string) => RuleDetails & { engine: Rule["engine"] }} */
const ruleDetails = (rule, { engine, id, scope }, label) => {
  const { requiresDictionaryEntries, requiresNounGroupCounts } = rule;
  const dictionary = ruleOption(
    requiresDictionaryEntries,
    `${label}.requiresDictionaryEntries`,
    engine,
  );
  const nouns = ruleOption(requiresNounGroupCounts, `${label}.requiresNounGroupCounts`, engine);
  // oxlint-disable-next-line eslint/sort-keys -- Keep the existing rule serialization order for report consumers.
  return {
    id,
    scope,
    engine,
    ...(matchesUndefined(nouns) ? {} : { requiresNounGroupCounts: nouns }),
    ...(matchesUndefined(dictionary) ? {} : { requiresDictionaryEntries: dictionary }),
    source: provenance(rule.source, `${label}.source`),
  };
};

/** @type {(raw: unknown, index: number, names: Set<string>) => Rule} */
export const validateRule = (raw, index, names) => {
  const label = `rules[${index}]`;
  const rule = object(raw, label);
  const id = text(rule.id, `${label}.id`);
  registerId(id, names, "rule");
  const mode = ruleMode(rule, label);
  const details = ruleDetails(rule, { ...mode, id }, label);
  const { engine } = mode;
  if (engine === "mechanical") {
    // oxlint-disable-next-line eslint/sort-keys -- Keep check after the common rule fields in serialized reports.
    return {
      ...details,
      engine,
      check: validateMechanicalCheck(rule.check, `${label}.check`, EvaluationError),
    };
  }
  // oxlint-disable-next-line eslint/sort-keys -- Validate and serialize the pass description before the fail description.
  return {
    ...details,
    engine,
    instructions: text(rule.instructions, `${label}.instructions`),
    pass: text(rule.pass, `${label}.pass`),
    fail: text(rule.fail, `${label}.fail`),
  };
};
