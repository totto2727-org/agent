const { resolve } = require("node:path");
const { mechanicalCatalog } = require("../rules/preset.mjs");

// Edit these ordinary config options for the document being reviewed.
// Use "ja" for Japanese or false to run only the mechanical rules.
const language = "en";
const ste = {};
const sections = [];
const ruleOptions = {};

if (!["en", "ja", false].includes(language)) throw new Error("language must be en, ja, or false.");
const knownRules = new Set(mechanicalCatalog.map((entry) => entry.id));
for (const [id, options] of Object.entries(ruleOptions)) {
  if (!knownRules.has(id)) throw new Error(`Unknown mechanical catalog rule: ${id}`);
  if (options !== false && (!options || typeof options !== "object" || Array.isArray(options)))
    throw new Error(`Rule options for ${id} must be an object or false.`);
}

// Absolute module paths resolve rules from the installed skill, not the target.
// The preset- prefix is textlint's public preset-key convention.
const rules = {};
if (language)
  rules[
    `preset-${require.resolve(language === "en" ? "slopless" : "textlint-rule-preset-ja-technical-writing")}`
  ] = true;
rules[`preset-${resolve(__dirname, "../rules/preset.mjs")}`] = Object.fromEntries(
  mechanicalCatalog.map((entry) => [
    entry.id,
    // STE evaluates English. Per-rule options can opt into declared English
    // sections of a Japanese document without applying STE to all Japanese text.
    ruleOptions[entry.id] === false ||
    (language === "ja" &&
      entry.check.kind.startsWith("ste-") &&
      ruleOptions[entry.id] === undefined)
      ? false
      : { ste, sections, ...ruleOptions[entry.id] },
  ]),
);

module.exports = { rules };
