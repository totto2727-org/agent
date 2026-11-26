// oxlint-disable-next-line rules/no-node-imports -- Read the installed rule catalog fixture with the existing Vitest runner.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Find the packaged catalog fixture relative to this test module.
import { fileURLToPath } from "node:url";
import { assert, describe, expect, test } from "vitest";

import { buildWork, validateManifest } from "./evaluate.mjs";
import { object, text } from "./evaluation-validation.mjs";
import { matchesNull, matchesString, matchesUndefined } from "./native-predicates.mjs";

const catalogPath = fileURLToPath(new URL("../references/rules.json", import.meta.url));
const sourcePath = fileURLToPath(new URL("../SKILL.md", import.meta.url));
const sectionCounts = [14, 2, 7, 5, 5, 6, 3, 7, 4];
const FIRST_RULE_NUMBER = 1;
const NUMBERED_RULE_COUNT = 53;
const EMPTY = 0;
const numberedRules = sectionCounts.flatMap((count, section) =>
  Array.from(
    { length: count },
    (_unused, index) => `${section + FIRST_RULE_NUMBER}.${index + FIRST_RULE_NUMBER}`,
  ),
);

/** @typedef {{ engine?: unknown, id: string, requiresDictionaryEntries?: unknown, requiresNounGroupCounts?: unknown, scope?: unknown, source?: { requiredRules?: unknown[], rule?: unknown } | null }} CatalogRule */

/** @type {(value: unknown) => CatalogRule} */
const catalogRule = (value) => {
  const rule = object(value, "catalog rule");
  assert(matchesString(rule.id), "Catalog rule must have a string ID.");
  const { source } = rule;
  if (!matchesUndefined(source) && !matchesNull(source)) {
    const metadata = object(source, "catalog rule source");
    assert(
      matchesUndefined(metadata.requiredRules) || Array.isArray(metadata.requiredRules),
      "Rule dependencies must be a list.",
    );
  }
  /* oxlint-disable typescript/no-unsafe-type-assertion -- Keep the original rule after checking the fields read by this test. */
  return (
    /** @type {CatalogRule} */
    (rule)
  );
  /* oxlint-enable typescript/no-unsafe-type-assertion */
};

/** @type {() => Promise<CatalogRule[]>} */
const loadCatalog = async () => {
  /** @type {unknown} */
  const parsed = JSON.parse(await readFile(catalogPath, "utf8"));
  assert(Array.isArray(parsed), "The shipped catalog must be an array.");
  /** @type {unknown[]} */
  const entries = parsed;
  return entries.map((entry) => catalogRule(entry));
};

/** @type {(rules: CatalogRule[]) => string[]} */
const mappedNumbers = (rules) =>
  rules
    .flatMap((rule) => [rule.source?.rule, ...(rule.source?.requiredRules ?? [])])
    .flatMap((number) => (matchesString(number) && /^\d+\.\d+$/u.test(number) ? [number] : []));

/** @type {(rules: CatalogRule[], number: string) => CatalogRule[]} */
const bySourceNumber = (rules, number) => rules.filter((rule) => rule.source?.rule === number);

const planShippedRules = async () => {
  const rules = await loadCatalog();
  const manifest = validateManifest({
    documents: [
      {
        audience: "Authors of the subject's documentation.",
        id: "audit-guide",
        path: sourcePath,
        purpose: "Write and maintain English developer documentation.",
        sourceLanguage: "en",
        templateConstraints: ["Preserve the required skill frontmatter and headings."],
      },
    ],
    englishOnly: true,
    model: "clef-flash",
    rules,
  });
  const work = await buildWork(manifest, catalogPath);
  const planned = work.flatMap((item) => {
    const questions = object(item.questions, "planned questions");
    return Object.values(questions).map((question) =>
      text(object(question, "planned question").ruleId, "planned rule ID"),
    );
  });
  return { planned, rules, work };
};

const registerSourceRuleTests = () => {
  test.each(["5.1", "6.3", "6.6", "8.1"])("keeps source rule %s mechanical", async (number) => {
    const checks = bySourceNumber(await loadCatalog(), number);
    expect(checks.length).toBeGreaterThan(EMPTY);
    expect(checks.every((rule) => rule.engine === "mechanical")).toBe(true);
  });

  test.each(["5.1", "6.3"])(
    "uses paragraph evidence and the counting dependencies for rule %s",
    async (number) => {
      expect.hasAssertions();
      const checks = bySourceNumber(await loadCatalog(), number);
      expect(checks.length).toBeGreaterThan(EMPTY);
      Iterator.from(checks).forEach((rule) => {
        expect(rule.scope).toBe("paragraph");
        expect(rule.source?.requiredRules).toStrictEqual(
          expect.arrayContaining(["8.4", "8.5", "8.6", "8.7"]),
        );
      });
    },
  );

  test.each(["1.1", "1.2", "1.3", "1.4", "3.1", "9.2", "9.3"])(
    "requires local dictionary evidence for decisions under rule %s",
    async (number) => {
      const checks = bySourceNumber(await loadCatalog(), number).filter(
        (rule) => rule.engine === "decision",
      );
      expect(checks.length).toBeGreaterThan(EMPTY);
      expect(checks.every((rule) => rule.requiresDictionaryEntries === true)).toBe(true);
    },
  );

  test.each(["1.9", "2.1", "2.2"])(
    "requires computed local noun counts for rule %s",
    async (number) => {
      const checks = bySourceNumber(await loadCatalog(), number);
      expect(checks.length).toBeGreaterThan(EMPTY);
      expect(checks.every((rule) => rule.requiresNounGroupCounts === true)).toBe(true);
    },
  );
};

// This inventory protects the maintained map. Source interpretation requires
// Independent reading of the actual standard, not merely this inventory test.
describe("executable rule catalog for Issue 9", () => {
  test("maps all 53 numbered rules, including explicit counting dependencies", async () => {
    const rules = await loadCatalog();
    expect([...new Set(mappedNumbers(rules))].toSorted()).toStrictEqual(
      [...numberedRules].toSorted(),
    );
    expect(numberedRules).toHaveLength(NUMBERED_RULE_COUNT);
  });

  test("keeps rule identities unique and all executable scopes local", async () => {
    expect.hasAssertions();
    const rules = await loadCatalog();
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
    Iterator.from(rules).forEach((rule) => {
      expect(["page", "section", "paragraph"]).toContain(rule.scope);
      expect(["mechanical", "decision"]).toContain(rule.engine);
      expect(rule.source).toBeDefined();
    });
    expect(rules.some((rule) => rule.id.startsWith("ste-faq-"))).toBe(false);
  });

  // oxlint-disable-next-line rules/require-vitest-hooks -- Register parameterized tests during collection in this suite.
  registerSourceRuleTests();

  test("builds every executable rule against the shipped audit guide", async () => {
    const { planned, rules, work } = await planShippedRules();
    expect([...new Set(planned)].toSorted()).toStrictEqual(rules.map((rule) => rule.id).toSorted());
    expect(work.every((item) => item.path === sourcePath)).toBe(true);
  });
});
