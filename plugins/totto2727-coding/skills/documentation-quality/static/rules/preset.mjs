import { readFileSync } from "node:fs";
import { createMechanicalRule } from "./mechanical-rule.mjs";

const catalog = JSON.parse(
  readFileSync(new URL("../../references/rules.json", import.meta.url), "utf8"),
);
export const mechanicalCatalog = catalog.filter((entry) => entry.engine === "mechanical");

export default {
  rules: Object.fromEntries(
    mechanicalCatalog.map((entry) => [entry.id, createMechanicalRule(entry.check)]),
  ),
  rulesConfig: Object.fromEntries(mechanicalCatalog.map((entry) => [entry.id, true])),
};
