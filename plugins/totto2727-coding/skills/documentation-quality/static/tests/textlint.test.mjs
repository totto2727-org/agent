import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { TextlintKernelDescriptor } from "@textlint/kernel";
import markdownPluginModule from "@textlint/textlint-plugin-markdown";
import { createLinter, loadTextlintrc } from "textlint";
import { afterEach, describe, expect, it } from "vitest";
import { runMechanical, sourceRange } from "../../scripts/mechanical.mjs";
import { createMechanicalRule } from "../rules/mechanical-rule.mjs";
import preset, { mechanicalCatalog } from "../rules/preset.mjs";

const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const staticDirectory = fileURLToPath(new URL("../", import.meta.url));
const cli = require.resolve("textlint/bin/textlint.js");
const configPath = join(staticDirectory, "config/textlint.cjs");
const directories = [];
const sentence = (words) => `Check ${"the ".repeat(words - 2)}panel.`;
const markdownPlugin = markdownPluginModule.default ?? markdownPluginModule;

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function directory() {
  const path = await mkdtemp(join(tmpdir(), "documentation-quality-textlint-"));
  directories.push(path);
  return path;
}

// Test-only config variants model editing declarations in the one shipped file.
// They are not part of the skill's execution workflow.
async function configFixture(path, options = {}) {
  let source = await readFile(configPath, "utf8");
  for (const [key, value] of Object.entries(options)) {
    source = source.replace(
      new RegExp(`const ${key} = [^\\n]+;`),
      `const ${key} = ${JSON.stringify(value)};`,
    );
  }
  const module = { exports: {} };
  runInNewContext(source, {
    module,
    require: createRequire(configPath),
    __dirname: dirname(configPath),
  });
  const output = join(path, "config.json");
  await writeFile(output, JSON.stringify(module.exports));
  return output;
}

async function lint(check, source, options = {}) {
  const linter = createLinter({
    descriptor: new TextlintKernelDescriptor({
      rules: [{ ruleId: "mechanical", rule: createMechanicalRule(check), options }],
      plugins: [{ pluginId: "markdown", plugin: markdownPlugin }],
      filterRules: [],
    }),
  });
  return (await linter.lintText(source, "guide.md")).messages;
}

describe("existing mechanical behavior through the real Markdown processor", () => {
  it.each([
    [
      "procedural boundary",
      { kind: "ste-sentence-length", writingMode: "procedural" },
      sentence(20),
      { writingMode: "procedural" },
    ],
    [
      "procedural violation",
      { kind: "ste-sentence-length", writingMode: "procedural" },
      sentence(21),
      { writingMode: "procedural" },
    ],
    [
      "descriptive boundary",
      { kind: "ste-sentence-length", writingMode: "descriptive" },
      sentence(25),
      { writingMode: "descriptive" },
    ],
    [
      "descriptive violation",
      { kind: "ste-sentence-length", writingMode: "descriptive" },
      sentence(26),
      { writingMode: "descriptive" },
    ],
    [
      "six sentences",
      { kind: "ste-paragraph-length" },
      Array(6).fill("Check the panel.").join(" "),
      { writingMode: "descriptive" },
    ],
    [
      "seven sentences",
      { kind: "ste-paragraph-length" },
      Array(7).fill("Check the panel.").join(" "),
      { writingMode: "descriptive" },
    ],
    [
      "missing mode",
      { kind: "ste-sentence-length", writingMode: "procedural" },
      "Check the panel.",
      {},
    ],
    ["code fence language", { kind: "fenced-code-language" }, "```\ncode\n```\n", {}],
    ["unclosed code fence", { kind: "fenced-code-language" }, "```js\ncode\n", {}],
    ["punctuation", { kind: "ste-punctuation" }, "Check the panel; use the tool.", {}],
    [
      "private dictionary unavailable",
      { kind: "ste-dictionary-membership" },
      "Check the panel.",
      {},
    ],
    ["nested fence", { kind: "ste-punctuation" }, "> ```js\n> code;\n> ```\n", {}],
    [
      "inline code in count",
      { kind: "ste-sentence-length", writingMode: "procedural" },
      "Check `panel` now.",
      { writingMode: "procedural" },
    ],
    [
      "abbreviation without evidence",
      { kind: "ste-sentence-length", writingMode: "procedural" },
      "Check the No. 1 panel at 3.5 mm.",
      { writingMode: "procedural" },
    ],
  ])(
    "%s matches the legacy engine without replacing its counting",
    async (_name, check, source, ste) => {
      const result = runMechanical(check, source, sourceRange(source, 0, source.length), ste);
      const expected = [
        ...result.findings.map((finding) => ({
          line: finding.sourceRange.startLine,
          message: finding.message,
        })),
        ...result.coverage.parserWarnings.map((warning) => ({
          line: warning.sourceRange.startLine,
          message: `review-required: ${warning.reason}`,
        })),
      ];
      const actual = await lint(check, source, { ste });
      expect(actual.map(({ line, message }) => ({ line, message }))).toEqual(expected);
    },
  );

  it("exports every mechanical catalog rule, not decision/scale checks", () => {
    expect(Object.keys(preset.rules)).toEqual(mechanicalCatalog.map((entry) => entry.id));
    expect(Object.keys(preset.rules)).toEqual([
      "code-fence-language",
      "ste-dictionary-candidates",
      "ste-5-1",
      "ste-6-3",
      "ste-6-6",
      "ste-8-1",
    ]);
    expect(Object.values(preset.rulesConfig)).toEqual(Array(6).fill(true));
  });

  it("supports exact prohibited terms and the existing code/metadata/URL exclusions", async () => {
    const source =
      "---\ntitle: forbidden\n---\n\n`forbidden`\n\n```js\nforbidden\n```\n\nhttps://example.com/forbidden\n\nforbidden protected.\n";
    const messages = await lint(
      {
        kind: "prohibited-terms",
        terms: ["forbidden", "protected"],
        protectedTerms: ["protected"],
      },
      source,
    );
    expect(messages.map(({ line, message }) => ({ line, message }))).toEqual([
      { line: 13, message: "Explicitly prohibited project token: forbidden" },
    ]);
  });

  it("maps UTF-8 byte evidence to textlint UTF-16 positions with CRLF", async () => {
    const messages = await lint(
      { kind: "ste-punctuation" },
      "# 題名\r\n\r\nCheck α; continue.\r\n",
    );
    expect(messages.map(({ line, column, message }) => ({ line, column, message }))).toEqual([
      { line: 3, column: 8, message: "STE prose does not permit a semicolon." },
    ]);
  });

  it("preserves explicit word groups and measurement evidence", async () => {
    const check = { kind: "ste-sentence-length", writingMode: "procedural" };
    const source = "Check the No. 1 panel at 3.5 mm.";
    const messages = await lint(check, source, {
      ste: {
        writingMode: "procedural",
        wordGroups: [{ text: "No. 1", category: "identifier" }],
        measurementUnits: ["mm"],
        nounGroups: [{ text: "control panel", kind: "official", source: "Project glossary" }],
      },
    });
    expect(messages).toEqual([]);
  });

  it("section writing mode overrides the default without changing other paragraphs", async () => {
    const check = { kind: "ste-sentence-length", writingMode: "procedural" };
    const messages = await lint(check, `${sentence(21)}\n\n${sentence(21)}\n`, {
      ste: { writingMode: "procedural" },
      sections: [{ startLine: 3, endLine: 3, ste: { writingMode: "descriptive" } }],
    });
    expect(messages.map(({ line, message }) => ({ line, message }))).toEqual([
      {
        line: 1,
        message: "The procedural word-count unit has more than 20 words (section 8 counting).",
      },
    ]);
  });

  it("section overrides cannot make a split code fence disappear from the page check", async () => {
    const messages = await lint({ kind: "fenced-code-language" }, "```\nexample\n```\n", {
      sections: [{ startLine: 2, endLine: 2, ste: { writingMode: "descriptive" } }],
    });
    expect(messages.map(({ line, message }) => ({ line, message }))).toEqual([
      { line: 1, message: "Fenced code block has no language info string." },
    ]);
  });

  it("partial paragraph section boundaries remain review-required", async () => {
    const messages = await lint(
      { kind: "ste-sentence-length", writingMode: "procedural" },
      "Check the panel\nand use the tool.\n",
      {
        ste: { writingMode: "procedural" },
        sections: [{ startLine: 2, endLine: 2, ste: { writingMode: "descriptive" } }],
      },
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/^review-required:.*only part of a paragraph/);
  });

  it("a missing declared vocabulary file is review-required", async () => {
    const path = await directory();
    const messages = await lint({ kind: "ste-dictionary-membership" }, "Check the panel.", {
      ste: { vocabularyFile: join(path, "missing.json") },
    });
    expect(
      messages.some(
        ({ message }) =>
          message === "review-required: The declared private vocabulary file is unavailable.",
      ),
    ).toBe(true);
    expect(messages.every(({ message }) => message.startsWith("review-required:"))).toBe(true);
  });

  it("supplied dictionary membership never certifies contextual meaning", async () => {
    const path = await directory();
    const vocabularyFile = join(path, "vocabulary.json");
    await writeFile(
      vocabularyFile,
      JSON.stringify({
        issue: 9,
        source: "Synthetic fixture, not licensed dictionary data",
        entries: [
          { word: "check", approved: true, partOfSpeech: "verb", meaning: "Synthetic meaning" },
        ],
      }),
    );
    const messages = await lint({ kind: "ste-dictionary-membership" }, "Check the panel.", {
      ste: { vocabularyFile },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/^review-required: Literal dictionary/);
  });

  it.each([
    [{ ste: { writingMode: "guessed" } }, /writingMode/],
    [{ ste: { vocabularyFile: "relative.json" } }, /absolute/],
    [{ sections: [{ startLine: 0, endLine: 1 }] }, /positive/],
    [
      {
        sections: [
          { startLine: 1, endLine: 2 },
          { startLine: 2, endLine: 3 },
        ],
      },
      /non-overlapping/,
    ],
    [{ sections: [{ startLine: 1, endLine: 5 }] }, /exceeds/],
    [{ executable: "anything" }, /Unknown/],
  ])("rejects invalid contextual options %j", async (options, error) => {
    await expect(lint({ kind: "ste-punctuation" }, "Check the panel.", options)).rejects.toThrow(
      error,
    );
  });
});

describe("installed-skill configuration and textlint CLI", () => {
  it("exports one ordinary configuration object, not a factory", () => {
    expect(require(configPath)).toEqual({ rules: expect.any(Object) });
    expect(typeof require(configPath)).toBe("object");
  });

  it.each([
    [{ language: "unknown" }, /language must be/],
    [{ ruleOptions: { unknown: true } }, /Unknown mechanical catalog rule/],
    [{ ruleOptions: { "ste-5-1": true } }, /must be an object or false/],
  ])("rejects invalid declared config options %j", async (options, message) => {
    const path = await directory();
    await expect(configFixture(path, options)).rejects.toThrow(message);
  });

  it("the real CLI preserves metadata, inline/fenced code, and URL exclusions", async () => {
    const path = await directory();
    const customizedConfig = await configFixture(path, {
      language: false,
      ruleOptions: Object.fromEntries(
        mechanicalCatalog
          .filter((entry) => entry.id !== "ste-8-1")
          .map((entry) => [entry.id, false]),
      ),
    });
    const file = join(path, "guide.md");
    await writeFile(
      file,
      "---\ntitle: ignored; metadata\n---\n\n`ignored; inline`\n\n```js\nignored; code\n```\n\nhttps://example.com/ignored;url\n\nCheck the panel; use the tool.\n",
    );
    try {
      await execute(
        process.execPath,
        [cli, "--config", customizedConfig, "--format", "json", file],
        { cwd: staticDirectory },
      );
      throw new Error("Expected prose punctuation finding");
    } catch (error) {
      expect(error.code).toBe(1);
      const results = JSON.parse(error.stdout);
      expect(results[0].messages).toHaveLength(1);
      expect(results[0].messages[0]).toMatchObject({
        line: 13,
        message: "STE prose does not permit a semicolon.",
      });
    }
  });

  it.each([20, 21])(
    "the real CLI applies declared procedural STE counting to %i words",
    async (words) => {
      const path = await directory();
      const customizedConfig = await configFixture(path, {
        language: false,
        ste: { writingMode: "procedural" },
        ruleOptions: Object.fromEntries(
          mechanicalCatalog
            .filter((entry) => entry.id !== "ste-5-1")
            .map((entry) => [entry.id, false]),
        ),
      });
      await writeFile(join(path, "guide.md"), `${sentence(words)}\n`);
      const result = execute(
        process.execPath,
        [cli, "--config", customizedConfig, "--format", "json", "guide.md"],
        { cwd: path },
      );
      if (words === 20)
        await expect(result).resolves.toMatchObject({
          stdout: expect.not.stringContaining("more than 20 words"),
        });
      else
        await expect(result).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining("more than 20 words"),
        });
    },
  );

  it("Japanese CLI configuration does not apply English STE checks to Japanese prose", async () => {
    const path = await directory();
    await writeFile(join(path, "guide.md"), "# ガイド\n\nパネルを確認する。\n");
    await expect(
      execute(
        process.execPath,
        [
          cli,
          "--config",
          await configFixture(path, { language: "ja" }),
          "--format",
          "json",
          "guide.md",
        ],
        { cwd: path },
      ),
    ).resolves.toMatchObject({
      stdout: expect.not.stringContaining("review-required:"),
    });
  });

  it.each(["en", "ja"])(
    "retains every current mdts %s preset rule and option",
    async (language) => {
      const path = await directory();
      const configuredPath = await configFixture(path, { language });
      const descriptor = await loadTextlintrc({ configFilePath: configuredPath });
      const upstreamModule =
        language === "en"
          ? await import("slopless")
          : await import("textlint-rule-preset-ja-technical-writing");
      const upstream = upstreamModule.default.default ?? upstreamModule.default;
      const rules = descriptor.rule.allDescriptors.map((rule) => rule.toKernel());
      for (const id of Object.keys(upstream.rules)) {
        const actual = rules.find((rule) => rule.ruleId.endsWith(`/${id}`));
        expect(actual?.options).toEqual(upstream.rulesConfig[id] ?? true);
      }
      expect(
        rules.filter(
          (rule) => !mechanicalCatalog.some((entry) => rule.ruleId.endsWith(`/${entry.id}`)),
        ),
      ).toHaveLength(Object.keys(upstream.rules).length);
      for (const entry of mechanicalCatalog) {
        const actual = rules.find((rule) => rule.ruleId.endsWith(`/${entry.id}`));
        expect(actual).toBeDefined();
        expect(actual.options).toEqual(
          language === "ja" && entry.check.kind.startsWith("ste-")
            ? false
            : { ste: {}, sections: [] },
        );
      }
    },
  );

  it("runs the real CLI outside the skill and ignores the target repository config", async () => {
    const path = await directory();
    await writeFile(join(path, ".textlintrc.json"), '{"rules":{"missing-poison-rule":true}}');
    await writeFile(join(path, "guide.md"), "# Guide\n\nCheck the panel; use the tool.\n");
    await expect(
      execute(process.execPath, [cli, "--config", configPath, "--format", "json", "guide.md"], {
        cwd: path,
      }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("STE prose does not permit a semicolon."),
    });
  });

  it("the documented package command does not discover the target repository ignore file", async () => {
    const path = await directory();
    const file = join(path, "guide.md");
    await writeFile(join(path, ".textlintignore"), "*\n");
    await writeFile(join(path, ".textlintrc.json"), '{"rules":{"missing-poison-rule":true}}');
    await writeFile(file, "# Guide\n\nCheck the panel; use the tool.\n");
    await expect(
      execute(
        "vp",
        [
          "-C",
          staticDirectory,
          "exec",
          "textlint",
          "--config",
          configPath,
          "--format",
          "json",
          file,
        ],
        { cwd: path },
      ),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("STE prose does not permit a semicolon."),
    });
  });

  it("the real CLI reports missing writing mode rather than a counting pass", async () => {
    const path = await directory();
    await writeFile(join(path, "guide.md"), "# Guide\n\nCheck the panel.\n");
    await expect(
      execute(process.execPath, [cli, "--config", configPath, "--format", "json", "guide.md"], {
        cwd: path,
      }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("review-required: Declare document.ste.writingMode"),
    });
  });
});
