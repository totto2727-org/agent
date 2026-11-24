// oxlint-disable-next-line rules/no-node-imports -- Read the installed rule catalog fixture with the existing Vitest runner.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Find the packaged catalog fixture relative to this test module.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { buildWork, validateManifest } from "./evaluate.mjs";

const catalogPath = fileURLToPath(new URL("../references/rules.json", import.meta.url));
const sourcePath = fileURLToPath(new URL("../SKILL.md", import.meta.url));
const sectionCounts = [14, 2, 7, 5, 5, 6, 3, 7, 4];
const numberedRules = sectionCounts.flatMap((count, section) =>
  Array.from({ length: count }, (_unused, index) => `${section + 1}.${index + 1}`),
);
const loadCatalog = async () => JSON.parse(await readFile(catalogPath, "utf8"));
const mappedNumbers = (rules) =>
  rules
    .flatMap((rule) => [rule.source?.rule, ...(rule.source?.requiredRules ?? [])])
    .filter((rule) => typeof rule === "string" && /^\d+\.\d+$/u.test(rule));
const bySourceNumber = (rules, number) => rules.filter((rule) => rule.source?.rule === number);

// This inventory protects the maintained map. Source interpretation requires
// Independent reading of the actual standard, not merely this inventory test.
describe("executable rule catalog for Issue 9", () => {
  test("maps all 53 numbered rules, including explicit counting dependencies", async () => {
    const rules = await loadCatalog();
    expect([...new Set(mappedNumbers(rules))].sort()).toStrictEqual([...numberedRules].sort());
    expect(numberedRules).toHaveLength(53);
  });

  test("keeps rule identities unique and all executable scopes local", async () => {
    const rules = await loadCatalog();
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
    Iterator.from(rules).forEach((rule) => {
      expect(["page", "section", "paragraph"]).toContain(rule.scope);
      expect(["mechanical", "decision"]).toContain(rule.engine);
      expect(rule.source).toBeDefined();
    });
    expect(rules.some((rule) => rule.id.startsWith("ste-faq-"))).toBe(false);
  });

  test.each(["5.1", "6.3", "6.6", "8.1"])("keeps source rule %s mechanical", async (number) => {
    const checks = bySourceNumber(await loadCatalog(), number);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((rule) => rule.engine === "mechanical")).toBe(true);
  });

  test.each(["5.1", "6.3"])(
    "uses paragraph evidence and the counting dependencies for rule %s",
    async (number) => {
      const checks = bySourceNumber(await loadCatalog(), number);
      expect(checks.length).toBeGreaterThan(0);
      Iterator.from(checks).forEach((rule) => {
        expect(rule.scope).toBe("paragraph");
        expect(rule.source.requiredRules).toStrictEqual(
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
      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every((rule) => rule.requiresDictionaryEntries === true)).toBe(true);
    },
  );

  test.each(["1.9", "2.1", "2.2"])(
    "requires computed local noun counts for rule %s",
    async (number) => {
      const checks = bySourceNumber(await loadCatalog(), number);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every((rule) => rule.requiresNounGroupCounts === true)).toBe(true);
    },
  );

  test("builds every executable rule against the shipped audit guide", async () => {
    const rules = await loadCatalog();
    const manifest = validateManifest({
      model: "clef-flash",
      englishOnly: true,
      rules,
      documents: [
        {
          id: "audit-guide",
          path: sourcePath,
          sourceLanguage: "en",
          purpose: "Write and maintain English developer documentation.",
          audience: "Authors of the subject's documentation.",
          templateConstraints: ["Preserve the required skill frontmatter and headings."],
        },
      ],
    });
    const work = await buildWork(manifest, catalogPath);
    const planned = work.flatMap((item) =>
      Object.values(item.questions).map((question) => question.ruleId),
    );
    expect([...new Set(planned)].sort()).toStrictEqual(rules.map((rule) => rule.id).sort());
    expect(work.every((item) => item.path === sourcePath)).toBe(true);
    // Planning real input verifies integration, not semantic acceptance.
  });
});
