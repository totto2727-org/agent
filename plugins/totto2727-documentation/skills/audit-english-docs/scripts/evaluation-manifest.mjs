// oxlint-disable-next-line rules/no-node-imports -- The installed skill reads its configuration from disk.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve manifest references against the manifest path.
import { dirname, isAbsolute, resolve } from "node:path";

import { bounded, EvaluationError, object, text } from "./evaluation-validation.mjs";
import { validateMechanicalCheck } from "./mechanical.mjs";
import {
  hasObjectType,
  matchesBoolean,
  matchesNull,
  matchesNumber,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";
import { validateSteContext } from "./ste.mjs";

export const MODELS = ["clef-flash", "clef", "typesafe/jev"];

/** @typedef {"--concurrency" | "--manifest" | "--output"} ValueFlag */
/** @typedef {{ concurrency: number | string, dryRun: boolean, manifest?: string, mechanicalOnly: boolean, output?: string }} CLIOptions */
/** @typedef {"page" | "paragraph" | "section"} RuleScope */
/** @typedef {{ id: string, requiresDictionaryEntries?: boolean, requiresNounGroupCounts?: boolean, scope: RuleScope, source: Record<string, unknown> | undefined }} RuleDetails */
/** @typedef {RuleDetails & { engine: "decision", fail: string, instructions: string, pass: string }} DecisionRule */
/** @typedef {RuleDetails & { check: import("./mechanical.mjs").MechanicalCheck, engine: "mechanical" }} MechanicalRule */
/** @typedef {DecisionRule | MechanicalRule} Rule */

/** @typedef {Record<string, unknown> & { audience: string, id: string, path: string, purpose: string, ruleIds: string[], sections?: unknown[], sourceLanguage?: string, ste: import("./ste.mjs").SteContext | undefined, templateConstraints: string[] }} Document */
/** @typedef {{ documentIds: Set<string>, needsLanguage: boolean, ruleIds: ReadonlySet<string>, rules: Rule[] }} DocumentValidation */
/** @typedef {{ documents: Document[], englishOnly: boolean, model: string | undefined, rules: Rule[], templateConstraints: string[], threshold: number | null }} Manifest */
/** @typedef {{ mechanicalOnly?: boolean }} ManifestOptions */

const defaultConcurrency = 4;
const minimumConcurrency = 1;
const maximumConcurrency = 32;

/** @type {(options: CLIOptions, flag: ValueFlag, value: string) => void} */
const setArgumentValue = (options, flag, value) => {
  if (!value) {
    throw new EvaluationError(`Missing value for ${flag}`);
  }
  if (flag === "--manifest") {
    options.manifest = value;
  } else if (flag === "--output") {
    options.output = value;
  } else {
    options.concurrency = value;
  }
};

/** @type {(argv: string[]) => CLIOptions & { concurrency: number, manifest: string, output: string }} */
export const parseArguments = (argv) => {
  /** @type {CLIOptions} */
  const options = { concurrency: defaultConcurrency, dryRun: false, mechanicalOnly: false };
  /** @type {{ pending?: ValueFlag }} */
  const state = {};
  Array.from(argv).forEach((argument) => {
    const { pending } = state;
    if (!matchesUndefined(pending)) {
      setArgumentValue(options, pending, argument);
      delete state.pending;
      return;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--mechanical-only") {
      options.mechanicalOnly = true;
    } else if (
      argument === "--manifest" ||
      argument === "--output" ||
      argument === "--concurrency"
    ) {
      state.pending = argument;
    } else {
      throw new EvaluationError(`Unknown argument: ${argument}`);
    }
  });
  const { pending } = state;
  if (!matchesUndefined(pending)) {
    throw new EvaluationError(`Missing value for ${pending}`);
  }
  const manifest = options.manifest ?? "";
  const output = options.output ?? "";
  if (!manifest || !output) {
    throw new EvaluationError("--manifest and --output are required");
  }
  const concurrency = Number(options.concurrency);
  if (
    !Number.isInteger(concurrency) ||
    concurrency < minimumConcurrency ||
    concurrency > maximumConcurrency
  ) {
    throw new EvaluationError("--concurrency must be an integer from 1 through 32");
  }
  return { ...options, concurrency, manifest, output };
};

/** @type {(value: unknown, label: string) => string[]} */
const constraints = (value, label) => {
  if (matchesUndefined(value)) {
    return [];
  }
  const message = `${label} must be an array of non-empty strings`;
  if (!Array.isArray(value)) {
    throw new EvaluationError(message);
  }
  /** @type {unknown[]} */
  const entries = value;
  if (!entries.every(matchesString) || entries.some((entry) => !entry.trim())) {
    throw new EvaluationError(message);
  }
  bounded(JSON.stringify(value), label);
  return entries;
};

const maximumMetadataDepth = 8;
const rootMetadataDepth = 0;

/** @type {(value: unknown, label: string) => Record<string, unknown> | undefined} */
const provenance = (value, label) => {
  if (matchesUndefined(value)) {
    return undefined;
  }
  const record = object(value, label);
  /** @type {(entry: unknown, depth: number) => void} */
  const visit = (entry, depth) => {
    if (depth > maximumMetadataDepth) {
      throw new EvaluationError(`${label} metadata is too deeply nested`);
    }
    if (matchesNull(entry) || matchesString(entry) || matchesBoolean(entry)) {
      return;
    }
    if (Number.isFinite(entry)) {
      return;
    }
    if (!hasObjectType(entry)) {
      throw new EvaluationError(`${label} must be plain JSON metadata`);
    }
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype) {
      throw new EvaluationError(`${label} must be plain JSON metadata`);
    }
    Object.values(entry).forEach((child) => {
      visit(child, depth + 1);
    });
  };
  visit(record, rootMetadataDepth);
  bounded(JSON.stringify(record), label);
  return record;
};

/** @type {(raw: unknown, index: number, names: Set<string>) => Rule} */
const validateRule = (raw, index, names) => {
  const label = `rules[${index}]`;
  const rule = object(raw, label);
  const id = text(rule.id, `${label}.id`);
  if (names.has(id)) {
    throw new EvaluationError(`Duplicate rule id: ${id}`);
  }
  names.add(id);
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
  const { requiresDictionaryEntries, requiresNounGroupCounts } = rule;
  if (
    !matchesUndefined(requiresDictionaryEntries) &&
    (engine !== "decision" || !matchesBoolean(requiresDictionaryEntries))
  ) {
    throw new EvaluationError(
      `${label}.requiresDictionaryEntries requires a boolean on a decision rule`,
    );
  }
  if (
    !matchesUndefined(requiresNounGroupCounts) &&
    (engine !== "decision" || !matchesBoolean(requiresNounGroupCounts))
  ) {
    throw new EvaluationError(
      `${label}.requiresNounGroupCounts requires a boolean on a decision rule`,
    );
  }
  /** @type {RuleDetails & { engine: "decision" | "mechanical" }} */
  const details = {
    id,
    scope,
    engine,
    ...(matchesUndefined(requiresNounGroupCounts) ? {} : { requiresNounGroupCounts }),
    ...(matchesUndefined(requiresDictionaryEntries) ? {} : { requiresDictionaryEntries }),
    source: provenance(rule.source, `${label}.source`),
  };
  if (engine === "mechanical") {
    return {
      ...details,
      engine,
      check: validateMechanicalCheck(rule.check, `${label}.check`, EvaluationError),
    };
  }
  return {
    ...details,
    engine,
    instructions: text(rule.instructions, `${label}.instructions`),
    pass: text(rule.pass, `${label}.pass`),
    fail: text(rule.fail, `${label}.fail`),
  };
};

const noEntries = 0;
const minimumThreshold = 0;
const maximumThreshold = 1;

/** @type {(rawDocument: unknown, index: number, context: DocumentValidation) => Document} */
const validateDocument = (rawDocument, index, { documentIds, needsLanguage, ruleIds, rules }) => {
  const document = object(rawDocument, `documents[${index}]`);
  const id = text(document.id, `documents[${index}].id`);
  if (documentIds.has(id)) {
    throw new EvaluationError(`Duplicate document id: ${id}`);
  }
  documentIds.add(id);
  text(document.path, `documents[${index}].path`);
  text(document.purpose, `documents[${index}].purpose`);
  text(document.audience, `documents[${index}].audience`);
  if (
    !matchesUndefined(document.context) &&
    !matchesNull(document.context) &&
    document.context !== ""
  ) {
    throw new EvaluationError(
      `documents[${index}].context is no longer supported: remove legacy context and use purpose, audience, and templateConstraints for task metadata. Evaluation evidence must stay on the same page.`,
    );
  }
  if (!matchesUndefined(document.sourceLanguage)) {
    text(document.sourceLanguage, `documents[${index}].sourceLanguage`);
  }
  if (needsLanguage && matchesUndefined(document.sourceLanguage)) {
    throw new EvaluationError(`documents[${index}].sourceLanguage is required with englishOnly`);
  }
  const requested = document.ruleIds ?? rules.map((rule) => rule.id);
  const invalidRules = `documents[${index}].ruleIds contains an unknown rule`;
  if (!Array.isArray(requested)) {
    throw new EvaluationError(invalidRules);
  }
  /** @type {unknown[]} */
  const selected = requested;
  if (
    selected.length === noEntries ||
    !selected.every(matchesString) ||
    selected.some((id) => !ruleIds.has(id))
  ) {
    throw new EvaluationError(invalidRules);
  }
  if (!matchesUndefined(document.sections) && !Array.isArray(document.sections)) {
    throw new EvaluationError(`documents[${index}].sections must be an array`);
  }
  const ste = validateSteContext(document.ste, `documents[${index}].ste`, EvaluationError);
  if (ste) {
    bounded(JSON.stringify(ste), `documents[${index}].ste`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fields above are validated before retaining the manifest’s original keys and values.
  return /** @type {Document} */ ({
    ...document,
    ste,
    templateConstraints: constraints(
      document.templateConstraints,
      `documents[${index}].templateConstraints`,
    ),
    ruleIds: selected,
  });
};

/**
 * @param {unknown} raw - The manifest's JSON data.
 * @param {ManifestOptions} [options] - Whether only local mechanical checks are requested.
 * @returns {Manifest} The checked source, rules and output settings.
 */
export const validateManifest = (raw, { mechanicalOnly = false } = {}) => {
  const manifest = object(raw, "manifest");
  const { model } = manifest;
  if (!matchesUndefined(model) && (!matchesString(model) || !MODELS.includes(model))) {
    throw new EvaluationError(`manifest.model must be one of: ${MODELS.join(", ")}`);
  }
  if (!Array.isArray(manifest.rules) || manifest.rules.length === noEntries) {
    throw new EvaluationError("manifest.rules must be a non-empty array");
  }
  if (!Array.isArray(manifest.documents) || manifest.documents.length === noEntries) {
    throw new EvaluationError("manifest.documents must be a non-empty array");
  }
  const threshold = manifest.threshold ?? null;
  if (
    !matchesNull(threshold) &&
    (!matchesNumber(threshold) ||
      !Number.isFinite(threshold) ||
      threshold < minimumThreshold ||
      threshold > maximumThreshold)
  ) {
    throw new EvaluationError("manifest.threshold must be between 0 and 1");
  }
  /** @type {Set<string>} */
  const ruleIds = new Set();
  /** @type {unknown[]} */
  const inputRules = manifest.rules;
  const rules = inputRules.map((rawRule, index) => validateRule(rawRule, index, ruleIds));
  /** @type {DocumentValidation} */
  const documentContext = {
    documentIds: new Set(),
    needsLanguage: Boolean(manifest.englishOnly),
    ruleIds,
    rules,
  };
  /** @type {unknown[]} */
  const inputDocuments = manifest.documents;
  const documents = inputDocuments.map((document, index) =>
    validateDocument(document, index, documentContext),
  );
  if (!matchesUndefined(manifest.englishOnly) && !matchesBoolean(manifest.englishOnly)) {
    throw new EvaluationError("manifest.englishOnly must be boolean");
  }
  const selectedSemanticWork = documents.some(
    (document) =>
      (!manifest.englishOnly || /^en(?:-|$)/iu.test(document.sourceLanguage ?? "")) &&
      rules.some((rule) => rule.engine === "decision" && document.ruleIds.includes(rule.id)),
  );
  if (!mechanicalOnly && selectedSemanticWork) {
    text(model, "manifest.model");
  }
  return {
    model,
    threshold,
    rules,
    documents,
    englishOnly: manifest.englishOnly ?? false,
    templateConstraints: constraints(manifest.templateConstraints, "manifest.templateConstraints"),
  };
};

/**
 * @param {string} manifestPath - The user-selected manifest path.
 * @param {ManifestOptions} [options] - Whether only local mechanical checks are requested.
 * @returns {Promise<Manifest>} The checked manifest and its referenced rules.
 */
export const loadManifest = async (manifestPath, options) => {
  const raw = object(JSON.parse(await readFile(manifestPath, "utf8")), "manifest");
  const hasRules = !matchesUndefined(raw.rules);
  const hasRulesFile = !matchesUndefined(raw.rulesFile);
  if (hasRules === hasRulesFile) {
    throw new EvaluationError("manifest must provide exactly one of rules or rulesFile");
  }
  if (hasRulesFile) {
    const rulesFile = text(raw.rulesFile, "manifest.rulesFile");
    const path = isAbsolute(rulesFile)
      ? rulesFile
      : resolve(dirname(resolve(manifestPath)), rulesFile);
    /** @type {unknown} */
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new EvaluationError("manifest.rulesFile must contain a JSON array");
    }
    /** @type {unknown[]} */
    const rules = parsed;
    raw.rules = rules;
  }
  return validateManifest(raw, options);
};
