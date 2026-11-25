// oxlint-disable-next-line rules/no-node-imports -- The installed skill reads its configuration from disk.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve manifest references against the manifest path.
import path from "node:path";

import { constraints, registerId } from "./evaluation-manifest-fields.mjs";
import { validateRule } from "./evaluation-manifest-rules.mjs";

import { bounded, EvaluationError, object, text } from "./evaluation-validation.mjs";
import {
  matchesBoolean,
  matchesNull,
  matchesNumber,
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";
import { validateSteContext } from "./ste.mjs";

export { parseArguments } from "./evaluation-arguments.mjs";

export const MODELS = ["clef-flash", "clef", "typesafe/jev"];

/** @typedef {import("./evaluation-manifest-rules.mjs").RuleScope} RuleScope */
/** @typedef {import("./evaluation-manifest-rules.mjs").Rule} Rule */

/** @typedef {Record<string, unknown> & { audience: string, id: string, path: string, purpose: string, ruleIds: string[], sections?: unknown[], sourceLanguage?: string, ste: import("./ste.mjs").SteContext | undefined, templateConstraints: string[] }} Document */
/** @typedef {{ documentIds: Set<string>, needsLanguage: boolean, ruleIds: ReadonlySet<string>, rules: Rule[] }} DocumentValidation */
/** @typedef {{ documents: Document[], englishOnly: boolean, model: string | undefined, rules: Rule[], templateConstraints: string[], threshold: number | null }} Manifest */
/** @typedef {{ mechanicalOnly?: boolean }} ManifestOptions */

const noEntries = 0;
const minimumThreshold = 0;
const maximumThreshold = 1;

/** @type {(document: Record<string, unknown>, label: string, needsLanguage: boolean) => void} */
const validateDocumentMetadata = (document, label, needsLanguage) => {
  text(document.path, `${label}.path`);
  text(document.purpose, `${label}.purpose`);
  text(document.audience, `${label}.audience`);
  if (
    !matchesUndefined(document.context) &&
    !matchesNull(document.context) &&
    // oxlint-disable-next-line rules/force-string-empty -- The standalone skill accepts just the empty legacy string as absent.
    document.context !== ""
  ) {
    throw new EvaluationError(
      `${label}.context is no longer supported: remove legacy context and use purpose, audience, and templateConstraints for task metadata. Evaluation evidence must stay on the same page.`,
    );
  }
  if (!matchesUndefined(document.sourceLanguage)) {
    text(document.sourceLanguage, `${label}.sourceLanguage`);
  }
  if (needsLanguage && matchesUndefined(document.sourceLanguage)) {
    throw new EvaluationError(`${label}.sourceLanguage is required with englishOnly`);
  }
};

/** @type {(requested: unknown, label: string, ruleIds: ReadonlySet<string>) => string[]} */
const validateRequestedRules = (requested, label, ruleIds) => {
  const invalidRules = `${label}.ruleIds contains an unknown rule`;
  if (!Array.isArray(requested)) {
    throw new EvaluationError(invalidRules);
  }
  /** @type {unknown[]} */
  const selected = requested;
  if (
    selected.length === noEntries ||
    !selected.every((id) => matchesString(id)) ||
    selected.some((id) => !ruleIds.has(id))
  ) {
    throw new EvaluationError(invalidRules);
  }
  return selected;
};

/** @type {(document: Record<string, unknown>, label: string) => Document["ste"]} */
const documentSections = (document, label) => {
  if (!matchesUndefined(document.sections) && !Array.isArray(document.sections)) {
    throw new EvaluationError(`${label}.sections must be an array`);
  }
  const ste = validateSteContext(document.ste, `${label}.ste`, EvaluationError);
  if (ste) {
    bounded(JSON.stringify(ste), `${label}.ste`);
  }
  return ste;
};

/** @type {(rawDocument: unknown, index: number, context: DocumentValidation) => Document} */
const validateDocument = (rawDocument, index, { documentIds, needsLanguage, ruleIds, rules }) => {
  const label = `documents[${index}]`;
  const document = object(rawDocument, label);
  registerId(text(document.id, `${label}.id`), documentIds, "document");
  validateDocumentMetadata(document, label, needsLanguage);
  const selected = validateRequestedRules(
    document.ruleIds ?? rules.map((rule) => rule.id),
    label,
    ruleIds,
  );
  const ste = documentSections(document, label);
  // oxlint-disable-next-line eslint/sort-keys -- Keep the existing document field order, including appended defaults.
  const checked = {
    ...document,
    ste,
    templateConstraints: constraints(document.templateConstraints, `${label}.templateConstraints`),
    ruleIds: selected,
  };
  return (
    // oxlint-disable-next-line eslint/no-inline-comments, typescript/no-unsafe-type-assertion -- The JSDoc assertion follows field validation and preserves the manifest's original keys and values.
    /** @type {Document} */ (checked)
  );
};

/** @type {(model: unknown) => string | undefined} */
const validateModel = (model) => {
  if (!matchesUndefined(model) && (!matchesString(model) || !MODELS.includes(model))) {
    throw new EvaluationError(`manifest.model must be one of: ${MODELS.join(", ")}`);
  }
  return model;
};

/** @type {(value: unknown, label: string) => unknown[]} */
const requiredEntries = (value, label) => {
  if (!Array.isArray(value) || value.length === noEntries) {
    throw new EvaluationError(`manifest.${label} must be a non-empty array`);
  }
  return value;
};

// oxlint-disable-next-line unicorn/no-null -- The checked manifest uses JSON null for an unspecified threshold.
const UNSPECIFIED_THRESHOLD = null;

/** @type {(value: unknown) => Manifest["threshold"]} */
const validateThreshold = (value) => {
  const threshold = value ?? UNSPECIFIED_THRESHOLD;
  if (
    !matchesNull(threshold) &&
    (!matchesNumber(threshold) ||
      !Number.isFinite(threshold) ||
      threshold < minimumThreshold ||
      threshold > maximumThreshold)
  ) {
    throw new EvaluationError("manifest.threshold must be between 0 and 1");
  }
  return threshold;
};

/** @type {(inputRules: unknown[], inputDocuments: unknown[], value: unknown) => { documents: Document[], rules: Rule[] }} */
const validateContent = (inputRules, inputDocuments, value) => {
  /** @type {Set<string>} */
  const ruleIds = new Set();
  const rules = inputRules.map((rawRule, index) => validateRule(rawRule, index, ruleIds));
  /** @type {DocumentValidation} */
  const context = { documentIds: new Set(), needsLanguage: Boolean(value), ruleIds, rules };
  const documents = inputDocuments.map((document, index) =>
    validateDocument(document, index, context),
  );
  return { documents, rules };
};

/** @type {(value: unknown) => boolean} */
const validateLanguage = (value) => {
  if (!matchesUndefined(value) && !matchesBoolean(value)) {
    throw new EvaluationError("manifest.englishOnly must be boolean");
  }
  return value ?? false;
};

/** @type {(content: { documents: Document[], rules: Rule[] }, options: { englishOnly: boolean, mechanicalOnly: boolean }, model: string | undefined) => void} */
const validateSemanticModel = ({ documents, rules }, { englishOnly, mechanicalOnly }, model) => {
  const selectedSemanticWork = documents.some(
    (document) =>
      (!englishOnly || /^en(?:-|$)/iu.test(document.sourceLanguage ?? "")) &&
      rules.some((rule) => rule.engine === "decision" && document.ruleIds.includes(rule.id)),
  );
  if (!mechanicalOnly && selectedSemanticWork) {
    text(model, "manifest.model");
  }
};

/**
 * @param {unknown} raw - The manifest's JSON data.
 * @param {ManifestOptions} [options] - Whether only local mechanical checks are requested.
 * @returns {Manifest} The checked source, rules and output settings.
 */
export const validateManifest = (raw, { mechanicalOnly = false } = {}) => {
  const manifest = object(raw, "manifest");
  const model = validateModel(manifest.model);
  const inputRules = requiredEntries(manifest.rules, "rules");
  const inputDocuments = requiredEntries(manifest.documents, "documents");
  const threshold = validateThreshold(manifest.threshold);
  const content = validateContent(inputRules, inputDocuments, manifest.englishOnly);
  const englishOnly = validateLanguage(manifest.englishOnly);
  validateSemanticModel(content, { englishOnly, mechanicalOnly }, model);
  // oxlint-disable-next-line eslint/sort-keys -- Keep existing manifest serialization order.
  return {
    model,
    threshold,
    rules: content.rules,
    documents: content.documents,
    englishOnly,
    templateConstraints: constraints(manifest.templateConstraints, "manifest.templateConstraints"),
  };
};

/** @type {(rulesFile: unknown, manifestPath: string) => Promise<unknown[]>} */
const readRules = async (rulesFile, manifestPath) => {
  const filename = text(rulesFile, "manifest.rulesFile");
  const target = path.isAbsolute(filename)
    ? filename
    : path.resolve(path.dirname(path.resolve(manifestPath)), filename);
  /** @type {unknown} */
  const parsed = JSON.parse(await readFile(target, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new EvaluationError("manifest.rulesFile must contain a JSON array");
  }
  /** @type {unknown[]} */
  const rules = parsed;
  return rules;
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
    raw.rules = await readRules(raw.rulesFile, manifestPath);
  }
  return validateManifest(raw, options);
};
