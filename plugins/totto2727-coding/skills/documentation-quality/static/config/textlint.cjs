const { resolve } = require("node:path");
const { mechanicalCatalog } = require("../rules/preset.mjs");

// Absolute module paths make an installed skill independent of the lint target's
// dependencies. The preset- prefix is textlint's public preset-key convention.
module.exports = function createTextlintConfig({
  language = "en",
  ste = {},
  sections = [],
  ruleOptions = {},
} = {}) {
  if (!["en", "ja", false].includes(language))
    throw new Error("language must be en, ja, or false.");
  const knownRules = new Set(mechanicalCatalog.map((entry) => entry.id));
  for (const [id, options] of Object.entries(ruleOptions)) {
    if (!knownRules.has(id)) throw new Error(`Unknown mechanical catalog rule: ${id}`);
    if (options !== false && (!options || typeof options !== "object" || Array.isArray(options)))
      throw new Error(`Rule options for ${id} must be an object or false.`);
  }
  const rules = {};
  if (language)
    rules[
      `preset-${require.resolve(language === "en" ? "slopless" : "textlint-rule-preset-ja-technical-writing")}`
    ] = true;
  rules[`preset-${resolve(__dirname, "../rules/preset.mjs")}`] = Object.fromEntries(
    mechanicalCatalog.map((entry) => [
      entry.id,
      // STE evaluates English. Explicit per-rule options can opt in to review
      // declared English sections of an otherwise Japanese document.
      ruleOptions[entry.id] === false ||
      (language === "ja" &&
        entry.check.kind.startsWith("ste-") &&
        ruleOptions[entry.id] === undefined)
        ? false
        : { ste, sections, ...ruleOptions[entry.id] },
    ]),
  );
  return { rules };
};
