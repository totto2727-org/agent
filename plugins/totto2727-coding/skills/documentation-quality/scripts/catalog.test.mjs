import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildWork, validateManifest } from "./evaluate.mjs";

const catalogPath = fileURLToPath(new URL("../references/rules.json", import.meta.url));
const principlesPath = fileURLToPath(
  new URL("../../documentation-principles/SKILL.md", import.meta.url),
);
const sectionCounts = [14, 2, 7, 5, 5, 6, 3, 7, 4];
const numberedRules = sectionCounts.flatMap((count, section) =>
  Array.from({ length: count }, (_, index) => `${section + 1}.${index + 1}`),
);
const loadCatalog = async () => JSON.parse(await readFile(catalogPath, "utf8"));

// This inventory protects the maintained map. Source interpretation requires
// independent reading of the actual standard, not merely this inventory test.
describe("Issue 9 executable rule catalog", () => {
  it("maps all 53 numbered rules, including explicit counting dependencies", async () => {
    const rules = await loadCatalog();
    const mapped = rules
      .flatMap((rule) => [rule.source?.rule, ...(rule.source?.requiredRules ?? [])])
      .filter((rule) => typeof rule === "string" && /^\d+\.\d+$/.test(rule));
    expect([...new Set(mapped)].sort()).toEqual([...numberedRules].sort());
    expect(numberedRules).toHaveLength(53);
  });

  it("keeps rule identities unique and all executable scopes local", async () => {
    const rules = await loadCatalog();
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
    for (const rule of rules) {
      expect(["page", "section", "paragraph"]).toContain(rule.scope);
      expect(["mechanical", "decision"]).toContain(rule.engine);
      expect(rule.source).toBeDefined();
    }
    expect(rules.some((rule) => rule.id.startsWith("ste-faq-"))).toBe(false);
  });

  it("does not delegate exact counting methods to a Decision Model", async () => {
    const rules = await loadCatalog();
    for (const number of ["5.1", "6.3", "6.6", "8.1"]) {
      const checks = rules.filter((rule) => rule.source?.rule === number);
      expect(checks.length, number).toBeGreaterThan(0);
      expect(
        checks.every((rule) => rule.engine === "mechanical"),
        number,
      ).toBe(true);
      if (["5.1", "6.3"].includes(number)) {
        expect(
          checks.every((rule) => rule.scope === "paragraph"),
          number,
        ).toBe(true);
      }
    }
    const counting = rules.filter((rule) => ["5.1", "6.3"].includes(rule.source?.rule));
    for (const rule of counting) {
      expect(rule.source.requiredRules).toEqual(
        expect.arrayContaining(["8.4", "8.5", "8.6", "8.7"]),
      );
    }
  });

  it("requires local dictionary evidence for dictionary-dependent judgments", async () => {
    const rules = await loadCatalog();
    for (const number of ["1.1", "1.2", "1.3", "1.4", "3.1", "9.2", "9.3"]) {
      const checks = rules.filter(
        (rule) => rule.source?.rule === number && rule.engine === "decision",
      );
      expect(checks.length, number).toBeGreaterThan(0);
      expect(
        checks.every((rule) => rule.requiresDictionaryEntries === true),
        number,
      ).toBe(true);
    }
  });

  it("requires computed local noun counts instead of model arithmetic", async () => {
    const rules = await loadCatalog();
    for (const number of ["1.9", "2.1", "2.2"]) {
      const checks = rules.filter((rule) => rule.source?.rule === number);
      expect(checks.length, number).toBeGreaterThan(0);
      expect(
        checks.every((rule) => rule.requiresNounGroupCounts === true),
        number,
      ).toBe(true);
    }
  });

  it("builds every executable rule against the real principles skill", async () => {
    const rules = await loadCatalog();
    const manifest = validateManifest({
      model: "clef-flash",
      englishOnly: true,
      rules,
      documents: [
        {
          id: "real-principles",
          path: principlesPath,
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
    expect([...new Set(planned)].sort()).toEqual(rules.map((rule) => rule.id).sort());
    expect(work.every((item) => item.path === principlesPath)).toBe(true);
    // Planning real input verifies integration, not semantic acceptance.
  });
});
