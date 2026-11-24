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
  matchesString,
  matchesUndefined,
} from "./native-predicates.mjs";
import { validateSteContext } from "./ste.mjs";

export const MODELS = ["clef-flash", "clef", "typesafe/jev"];

/** @typedef {"--concurrency" | "--manifest" | "--output"} ValueFlag */
/** @typedef {{ concurrency: number | string, dryRun: boolean, manifest?: string, mechanicalOnly: boolean, output?: string }} CLIOptions */

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
  if (!Array.isArray(value) || value.some((entry) => !matchesString(entry) || !entry.trim())) {
    throw new EvaluationError(`${label} must be an array of non-empty strings`);
  }
  bounded(JSON.stringify(value), label);
  return /** @type {string[]} */ (value);
};

const provenance = function (value, label) {
  if (matchesUndefined(value)) {
    return undefined;
  }
  object(value, label);
  const visit = (entry, depth) => {
    if (depth > 8) {
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
  visit(value, 0);
  bounded(JSON.stringify(value), label);
  return value;
};

export function validateManifest(raw, { mechanicalOnly = false } = {}) {
  const manifest = object(raw, "manifest");
  if (!matchesUndefined(manifest.model) && !MODELS.includes(manifest.model)) {
    throw new EvaluationError(`manifest.model must be one of: ${MODELS.join(", ")}`);
  }
  if (!Array.isArray(manifest.rules) || !manifest.rules.length) {
    throw new EvaluationError("manifest.rules must be a non-empty array");
  }
  if (!Array.isArray(manifest.documents) || !manifest.documents.length) {
    throw new EvaluationError("manifest.documents must be a non-empty array");
  }
  const threshold = manifest.threshold ?? null;
  if (!matchesNull(threshold) && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)) {
    throw new EvaluationError("manifest.threshold must be between 0 and 1");
  }
  const ruleIds = new Set();
  const rules = manifest.rules.map((rawRule, index) => {
    const rule = object(rawRule, `rules[${index}]`);
    const id = text(rule.id, `rules[${index}].id`);
    if (ruleIds.has(id)) {
      throw new EvaluationError(`Duplicate rule id: ${id}`);
    }
    ruleIds.add(id);
    const scope = rule.scope ?? "section";
    if (!["section", "page", "paragraph"].includes(scope)) {
      throw new EvaluationError(`rules[${index}].scope must be section, page, or paragraph`);
    }
    const engine = rule.engine ?? "decision";
    if (!["decision", "mechanical"].includes(engine)) {
      throw new EvaluationError(`rules[${index}].engine must be decision or mechanical`);
    }
    if (engine === "decision" && !matchesUndefined(rule.check)) {
      throw new EvaluationError(`rules[${index}].check requires the mechanical engine`);
    }
    if (
      !matchesUndefined(rule.requiresDictionaryEntries) &&
      (engine !== "decision" || !matchesBoolean(rule.requiresDictionaryEntries))
    ) {
      throw new EvaluationError(
        `rules[${index}].requiresDictionaryEntries requires a boolean on a decision rule`,
      );
    }
    if (
      !matchesUndefined(rule.requiresNounGroupCounts) &&
      (engine !== "decision" || !matchesBoolean(rule.requiresNounGroupCounts))
    ) {
      throw new EvaluationError(
        `rules[${index}].requiresNounGroupCounts requires a boolean on a decision rule`,
      );
    }
    return {
      id,
      scope,
      engine,
      ...(matchesUndefined(rule.requiresNounGroupCounts)
        ? {}
        : { requiresNounGroupCounts: rule.requiresNounGroupCounts }),
      ...(matchesUndefined(rule.requiresDictionaryEntries)
        ? {}
        : { requiresDictionaryEntries: rule.requiresDictionaryEntries }),
      source: provenance(rule.source, `rules[${index}].source`),
      ...(engine === "mechanical"
        ? {
            check: validateMechanicalCheck(rule.check, `rules[${index}].check`, EvaluationError),
          }
        : {
            instructions: text(rule.instructions, `rules[${index}].instructions`),
            pass: text(rule.pass, `rules[${index}].pass`),
            fail: text(rule.fail, `rules[${index}].fail`),
          }),
    };
  });
  const documentIds = new Set();
  const documents = manifest.documents.map((rawDocument, index) => {
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
    if (manifest.englishOnly && matchesUndefined(document.sourceLanguage)) {
      throw new EvaluationError(`documents[${index}].sourceLanguage is required with englishOnly`);
    }
    const selected = document.ruleIds ?? rules.map((rule) => rule.id);
    if (!Array.isArray(selected) || !selected.length || selected.some((id) => !ruleIds.has(id))) {
      throw new EvaluationError(`documents[${index}].ruleIds contains an unknown rule`);
    }
    if (!matchesUndefined(document.sections) && !Array.isArray(document.sections)) {
      throw new EvaluationError(`documents[${index}].sections must be an array`);
    }
    const ste = validateSteContext(document.ste, `documents[${index}].ste`, EvaluationError);
    if (ste) {
      bounded(JSON.stringify(ste), `documents[${index}].ste`);
    }
    return {
      ...document,
      ste,
      templateConstraints: constraints(
        document.templateConstraints,
        `documents[${index}].templateConstraints`,
      ),
      ruleIds: selected,
    };
  });
  if (!matchesUndefined(manifest.englishOnly) && !matchesBoolean(manifest.englishOnly)) {
    throw new EvaluationError("manifest.englishOnly must be boolean");
  }
  const selectedSemanticWork = documents.some(
    (document) =>
      (!manifest.englishOnly || /^en(?:-|$)/i.test(document.sourceLanguage)) &&
      rules.some((rule) => rule.engine === "decision" && document.ruleIds.includes(rule.id)),
  );
  if (!mechanicalOnly && selectedSemanticWork) {
    text(manifest.model, "manifest.model");
  }
  return {
    model: manifest.model,
    threshold,
    rules,
    documents,
    englishOnly: manifest.englishOnly ?? false,
    templateConstraints: constraints(manifest.templateConstraints, "manifest.templateConstraints"),
  };
}

export async function loadManifest(manifestPath, options) {
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
    const rules = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(rules)) {
      throw new EvaluationError("manifest.rulesFile must contain a JSON array");
    }
    raw.rules = rules;
  }
  return validateManifest(raw, options);
}
