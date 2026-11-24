// oxlint-disable-next-line rules/no-node-imports -- Test the distributed script as a native Node.js subprocess.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Create and inspect filesystem fixtures for the subprocess.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Place subprocess fixtures in the system temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve test fixture paths for the subprocess.
import { resolve } from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Find the distributed entry point relative to this test module.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await the native subprocess and preserve its exit status in these tests.
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("evaluate.mjs", import.meta.url));
const directories = [];
const sentence = (count) => `Check ${"the ".repeat(count - 2)}panel.`;
const checkFor = (mode = "procedural") => ({ kind: "ste-sentence-length", writingMode: mode });

const cli = async function (
  markdown,
  {
    check = checkFor(),
    ste = { writingMode: "procedural" },
    scope = "page",
    sections,
    vocabulary,
    rules,
    dryRun = false,
    mechanicalOnly = true,
    model,
  } = {},
) {
  const directory = await mkdtemp(resolve(tmpdir(), "ste-public-cli-"));
  directories.push(directory);
  await writeFile(resolve(directory, "guide.md"), markdown);
  if (vocabulary) {
    await writeFile(resolve(directory, "vocabulary.json"), JSON.stringify(vocabulary));
  }
  const manifest = {
    ...(model ? { model } : {}),
    rules: rules ?? [{ id: "ste", engine: "mechanical", scope, check }],
    documents: [
      {
        id: "guide",
        path: "guide.md",
        purpose: "Original test example.",
        audience: "Technician.",
        sourceLanguage: "en",
        ste,
        ...(sections ? { sections } : {}),
      },
    ],
  };
  const manifestPath = resolve(directory, "manifest.json");
  const outputPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  let exitCode = 0;
  let stderr = "";
  try {
    await execute(
      process.execPath,
      [
        script,
        "--manifest",
        manifestPath,
        "--output",
        outputPath,
        ...(mechanicalOnly ? ["--mechanical-only"] : []),
        ...(dryRun ? ["--dry-run"] : []),
      ],
      {
        env: { PATH: process.env.PATH },
      },
    );
  } catch (error) {
    exitCode = error.code;
    stderr = error.stderr;
  }
  if (exitCode === 2) {
    return { exitCode, stderr };
  }
  const report = JSON.parse(await readFile(outputPath, "utf8"));
  expect(report.requestCount).toBe(0);
  return { exitCode, report, answers: report.evaluations.flatMap((entry) => entry.answers) };
};

const cleanupFixtures = async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
};

describe("mechanical checks for Issue 9 through the real public CLI", () => {
  afterEach(cleanupFixtures);

  const nounRule = {
    id: "noun-count",
    engine: "decision",
    scope: "paragraph",
    requiresNounGroupCounts: true,
    instructions: "Interpret the supplied local machine noun counts and source-declared role.",
    pass: "Supported role and numeric limit.",
    fail: "Supported role violates its numeric limit.",
  };

  test("defers missing noun-group evidence with zero requests even outside mechanical-only mode", async () => {
    const result = await cli("Check the status panel.", {
      rules: [nounRule],
      mechanicalOnly: false,
      model: "clef-flash",
      ste: {},
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
    });
    expect(result.report.evaluations[0]).toMatchObject({ status: "deferred" });
    expect(result.report.evaluations[0].reason).toContain("Required noun-group counts");
  });

  test.each([
    ["upper status panel", 3, [1, 1, 1]],
    ["upper control status panel", 4, [1, 1, 1, 1]],
    ["upper-status control panel", 3, [2, 1, 1]],
    ["upper-control-status-panel", 1, [4]],
  ])(
    "computes declared noun group %j rather than accepting model or caller counts",
    async (text, wordCount, hyphenComponentCounts) => {
      const result = await cli(`Check the ${text}.`, {
        rules: [nounRule],
        mechanicalOnly: false,
        dryRun: true,
        model: "clef-flash",
        ste: {
          nounGroups: [
            { text, kind: "multi-word", source: "Original local role claim." },
            { text: "unmatched private group", kind: "official", source: "UNMATCHED-GROUP-SOURCE" },
          ],
        },
      });
      const selected = result.report.evaluations[0].state.evidence.local.nounGroupCounts;
      expect(selected).toHaveLength(1);
      expect(selected[0]).toMatchObject({
        text,
        status: "counted",
        wordCount,
        hyphenComponentCounts,
        kind: "multi-word",
        source: "Original local role claim.",
      });
      expect(JSON.stringify(selected)).not.toContain("UNMATCHED-GROUP-SOURCE");
      expect(result.report.evaluations[0].questions[0].instructions).toContain(
        "never count words yourself",
      );
    },
  );

  test("never collapses an official multiword noun into one arbitrary sentence-level title token", async () => {
    const text = "Upper Control Status Panel";
    const result = await cli(`Inspect the ${text}.`, {
      rules: [nounRule],
      mechanicalOnly: false,
      dryRun: true,
      model: "clef-flash",
      ste: {
        nounGroups: [{ text, kind: "official", source: "Original official-name claim." }],
        wordGroups: [{ text, category: "title" }],
      },
    });
    expect(result.report.evaluations[0].state.evidence.local.nounGroupCounts[0]).toMatchObject({
      hyphenComponentCounts: [1, 1, 1, 1],
      status: "counted",
      wordCount: 4,
    });
  });

  test("defers unsupported declared noun syntax without a model request", async () => {
    const text = "panel (upper) assembly";
    const result = await cli(`Check the ${text}.`, {
      rules: [nounRule],
      mechanicalOnly: false,
      model: "clef-flash",
      ste: {
        nounGroups: [
          { text, kind: "new-technical", source: "Original role claim requiring review." },
        ],
      },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
    });
    expect(result.report.evaluations[0].status).toBe("deferred");
  });

  test("rejects caller-supplied noun count totals as invalid executable evidence", async () => {
    const result = await cli("Check the upper status panel.", {
      ste: {
        nounGroups: [
          {
            text: "upper status panel",
            kind: "multi-word",
            source: "Original local role claim.",
            wordCount: 1,
          },
        ],
      },
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("never submitted counts");
  });

  test.each([
    ["procedural", 20, 20, "pass", 0],
    ["procedural", 21, 20, "fail", 1],
    ["descriptive", 25, 25, "pass", 0],
    ["descriptive", 26, 25, "fail", 1],
  ])(
    "enforces the source %s boundary at %i words",
    async (writingMode, count, limit, exitCodeChoice, exitCode) => {
      const result = await cli(sentence(count), {
        check: checkFor(writingMode),
        ste: { writingMode },
      });
      expect(result.answers[0]).toMatchObject({
        choice: exitCodeChoice,
        reviewRequired: false,
        counts: [{ wordCount: count, limit }],
      });
      expect(result.exitCode).toBe(exitCode);
    },
  );

  test("requires declared mode and never infers it from prose or a heading", async () => {
    const missing = await cli("# Procedure\n\nCheck the panel.\n", { ste: {} });
    expect(missing.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("does not apply procedural limits to a declared descriptive target", async () => {
    const result = await cli(sentence(24), { ste: { writingMode: "descriptive" } });
    expect(result.answers[0].choice).toBe("not_applicable");
  });

  test.each([
    [6, "pass"],
    [7, "fail"],
  ])("counts %i actual sentences in a descriptive paragraph", async (count, choice) => {
    const result = await cli(Array(count).fill("The panel is closed.").join(" "), {
      check: { kind: "ste-paragraph-length" },
      ste: { writingMode: "descriptive" },
      scope: "paragraph",
    });
    expect(result.answers[0]).toMatchObject({
      choice,
      reviewRequired: false,
      counts: [{ sentenceCount: count, limit: 6 }],
    });
  });

  test("counts hyphens, decimal measurement groups, quotes, and parenthetical identifiers without naive whitespace counts", async () => {
    const result = await cli(
      'Check the quick-release panel (42) at 12.5 kg with the "Maintenance setup" label.',
    );
    expect(result.answers[0]).toMatchObject({ choice: "pass", counts: [{ wordCount: 11 }] });
  });

  test("checks parenthetical prose as a separate word-count unit as well as one outer word", async () => {
    const result = await cli(`Check the panel (${sentence(21).toLowerCase().slice(0, -1)}).`);
    expect(result.answers[0]).toMatchObject({ choice: "fail", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toStrictEqual([4, 21]);
    expect(result.answers[0].findings[0].parenthetical).toBe(true);
  });

  test("does not claim parenthetical prose paragraph boundaries from the word-count rule", async () => {
    const result = await cli("The panel is closed (the latch is locked).", {
      check: { kind: "ste-paragraph-length" },
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("uses colon and each simple vertical-list item as separate word-count units", async () => {
    const result = await cli(
      "Inspect these areas:\n- the upper panel\n- the lower quick-release panel.\n",
    );
    expect(result.answers[0]).toMatchObject({ choice: "pass", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toStrictEqual([3, 3, 4]);
  });

  test("does not mistake vertical-list fragments for paragraph sentences", async () => {
    const result = await cli("The assembly has these parts:\n- the panel\n- the latch.\n", {
      check: { kind: "ste-paragraph-length" },
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("excludes numbered work-step markers from the word count", async () => {
    const result = await cli("1. Check the panel.\n2. Close the latch.\n");
    expect(result.answers[0]).toMatchObject({ choice: "pass", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toStrictEqual([3, 3]);
  });

  test("accepts explicit section 8 semantic groups and additional literal measurement units", async () => {
    const result = await cli("Send the panel to North River Works at 4 furlongs.", {
      ste: {
        writingMode: "procedural",
        wordGroups: [{ text: "North River Works", category: "proper-noun" }],
        measurementUnits: ["furlongs"],
      },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ wordCount: 7 }],
      reviewRequired: false,
    });
    expect(result.answers[0].coverage.declaredWordGroups).toStrictEqual([
      { category: "proper-noun", text: "North River Works" },
    ]);
  });

  test("handles source-illustrated composite identifiers and time abbreviations as one word", async () => {
    const result = await cli("Check the No. 2 panel at 11 a.m. today.");
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ wordCount: 7 }],
      reviewRequired: false,
    });
  });

  test.each([
    "Check North River Works.",
    "CHECK THE PANEL.",
    "Check e.g. the panel.",
    "Check the panel: close the latch.",
    "Check the panel...",
    "Check the panel(s).",
    "Check the panel (the latch (2) is locked).",
    "Check the panel",
    "Check the `panel`.",
    "Check the [panel](https://example.test).",
    "> Check the panel.\n",
    "| Panel | State |\n| --- | --- |\n| upper | closed |\n",
    "Check the panel.\n\n- ```\n  nested code\n  ```\n",
    "Check 4 unknownunits.",
  ])("abstains on ambiguous prose rather than partially passing: %j", async (markdown) => {
    const result = await cli(markdown);
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
    expect(result.answers[0].coverage.parserWarnings.length).toBeGreaterThan(0);
  });

  test("keeps prose semicolons distinct from excluded code and unchangeable quotations", async () => {
    const result = await cli(
      'Check the panel; close it. Read "Stop; wait".\n\n```js\nrun();\n```\n',
      { check: { kind: "ste-punctuation" } },
    );
    expect(result.answers[0]).toMatchObject({ choice: "fail", reviewRequired: false });
    expect(result.answers[0].findings).toHaveLength(1);
    expect(result.answers[0].findings[0].sourceRange).toMatchObject({
      endByte: 16,
      endLine: 1,
      startByte: 15,
      startLine: 1,
    });
  });

  test("never substitutes another section for the local counting target", async () => {
    const result = await cli(`# First\n\n${sentence(20)}\n\n# Second\n\n${sentence(21)}\n`, {
      scope: "section",
    });
    expect(result.answers.map((entry) => entry.choice)).toStrictEqual(["pass", "fail"]);
    expect(result.answers[1].findings[0].sourceRange.startLine).toBe(7);
  });

  test("propagates explicit section mode to paragraph targets without leaking across sections", async () => {
    const result = await cli(`${sentence(21)}\n\n${sentence(21)}\n`, {
      scope: "paragraph",
      sections: [
        { startLine: 1, endLine: 1, ste: { writingMode: "descriptive" } },
        { startLine: 3, endLine: 3 },
      ],
    });
    expect(result.answers.map((entry) => entry.choice)).toStrictEqual(["not_applicable", "fail"]);
  });

  test("abstains on page-level mixed writing modes rather than applying a global limit", async () => {
    const result = await cli(`${sentence(21)}\n\n${sentence(21)}\n`, {
      sections: [
        { startLine: 1, endLine: 1, ste: { writingMode: "descriptive" } },
        { startLine: 3, endLine: 3 },
      ],
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
    });
  });

  test("does not count a partial paragraph selected by an explicit section", async () => {
    const result = await cli("Check the panel\nand close the latch.\n", {
      scope: "section",
      sections: [{ startLine: 1, endLine: 1 }],
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("keeps missing dictionary evidence unavailable", async () => {
    const result = await cli("Check the panel.", { check: { kind: "ste-dictionary-membership" } });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      lexicalCandidates: [],
      reviewRequired: true,
    });
  });

  test("performs literal local vocabulary and inflection lookup without a false contextual compliance decision", async () => {
    const vocabulary = {
      issue: 9,
      source: "Original synthetic test vocabulary, not the STE dictionary.",
      entries: [
        {
          word: "check",
          forms: ["checks", "checked"],
          approved: true,
          partOfSpeech: "verb",
          meaning: "Synthetic test meaning.",
        },
        {
          word: "panel",
          forms: ["panels"],
          approved: false,
          partOfSpeech: "noun",
          meaning: "Synthetic candidate meaning.",
        },
      ],
      technicalTerms: ["panel"],
    };
    const result = await cli("Checked panels remain unknown.", {
      check: { kind: "ste-dictionary-membership" },
      ste: { vocabularyFile: "vocabulary.json" },
      vocabulary,
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
    expect(
      result.answers[0].lexicalCandidates.map((entry) => [entry.term, entry.membership]),
    ).toStrictEqual([
      ["Checked", "approved-form"],
      ["panels", "not-approved-entry"],
      ["remain", "unlisted"],
      ["unknown", "unlisted"],
    ]);
  });

  test("supports exact multiword entries and their declared forms without generating inflections", async () => {
    const vocabulary = {
      issue: 9,
      source: "Original synthetic phrase records for schema testing.",
      entries: [
        {
          word: "put",
          approved: true,
          partOfSpeech: "verb",
          meaning: "Synthetic single-word record.",
        },
        {
          word: "put on",
          forms: ["puts on", "putting on"],
          approved: true,
          partOfSpeech: "verb",
          meaning: "Synthetic multiword record.",
        },
      ],
    };
    const result = await cli("Put on the coat. Puts on the coat. Put-on is a separate token.", {
      check: { kind: "ste-dictionary-membership" },
      ste: { vocabularyFile: "vocabulary.json" },
      vocabulary,
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
    const candidates = result.answers[0].lexicalCandidates;
    expect(candidates[0]).toMatchObject({ membership: "approved-form", term: "Put on" });
    expect(candidates.find((entry) => entry.term === "Puts on").membership).toBe("approved-form");
    expect(candidates.find((entry) => entry.term === "Put-on").membership).toBe("unlisted");
  });

  test("does not treat ordinary descriptive mentions of warnings as a safety instruction", async () => {
    const result = await cli("The warning shows the state.", {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ wordCount: 5 }],
      reviewRequired: false,
    });
  });

  test("excludes explicit safety labels from a declared procedural count", async () => {
    const result = await cli(`CAUTION: ${sentence(21)}`);
    expect(result.answers[0]).toMatchObject({
      choice: "fail",
      counts: [{ limit: 20, wordCount: 21 }],
      reviewRequired: false,
    });
  });

  test("applies descriptive 25 to an explicitly classified note without counting its label", async () => {
    const result = await cli(`NOTE: ${sentence(25)}`, {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ limit: 25, wordCount: 25 }],
      reviewRequired: false,
    });
  });

  test("excludes parenthetical work-step numbering and keeps terminal time abbreviation boundaries", async () => {
    const numbered = await cli("(3) Check the panel.");
    expect(numbered.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ wordCount: 3 }],
      reviewRequired: false,
    });
    const time = await cli("Check the panel at 11 p.m.");
    expect(time.answers[0]).toMatchObject({
      choice: "pass",
      counts: [{ wordCount: 5 }],
      reviewRequired: false,
    });
  });

  test("retains declared technical noun records as candidates rather than dictionary violations", async () => {
    const vocabulary = {
      issue: 9,
      source: "Original source declarations for tests.",
      entries: [
        { word: "check", approved: true, partOfSpeech: "verb", meaning: "Synthetic meaning." },
      ],
      technicalTerms: [
        { text: "status panel", kind: "noun", category: 19, source: "Synthetic company glossary." },
      ],
    };
    const result = await cli("Check the status panel.", {
      check: { kind: "ste-dictionary-membership" },
      ste: { vocabularyFile: "vocabulary.json" },
      vocabulary,
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
    expect(
      result.answers[0].lexicalCandidates.find((entry) => entry.term === "status panel"),
    ).toMatchObject({
      membership: "unlisted",
      technicalTermCandidate: true,
      technicalRecords: vocabulary.technicalTerms,
      records: [],
    });
  });

  test("treats an unavailable private vocabulary path as missing evidence, not a pass", async () => {
    const result = await cli("Check the panel.", {
      check: { kind: "ste-dictionary-membership" },
      ste: { vocabularyFile: "missing-private.json" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
  });

  test("defers incorrectly classified safety labels rather than applying descriptive 25", async () => {
    const result = await cli("CAUTION: Keep the panel closed.", {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("defers procedural notes instead of treating them as procedural 20", async () => {
    const result = await cli("NOTE: The panel is closed.");
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      counts: [],
      reviewRequired: true,
    });
  });

  test("does not flag HTML entity terminators as prose semicolons", async () => {
    const result = await cli("Check the panel &amp; latch.", {
      check: { kind: "ste-punctuation" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      findings: [],
      reviewRequired: true,
    });
  });

  test.each([
    { writingMode: "safety" },
    { writingMode: "procedural", wordGroups: [{ text: "a", category: "regex" }] },
    { measurementUnits: ["(a+)+"] },
    { vocabularyFile: "" },
    { executable: "echo unsafe" },
  ])("rejects invalid local context without executing arbitrary parameters: %j", async (ste) => {
    const result = await cli("Check the panel.", { ste });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(".ste");
  });
});
