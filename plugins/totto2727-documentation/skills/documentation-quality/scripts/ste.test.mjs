import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("./evaluate.mjs", import.meta.url));
const directories = [];
const sentence = (count) => `Check ${"the ".repeat(count - 2)}panel.`;
const checkFor = (mode = "procedural") => ({ kind: "ste-sentence-length", writingMode: mode });

async function cli(
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
  if (vocabulary)
    await writeFile(resolve(directory, "vocabulary.json"), JSON.stringify(vocabulary));
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
  if (exitCode === 2) return { exitCode, stderr };
  const report = JSON.parse(await readFile(outputPath, "utf8"));
  expect(report.requestCount).toBe(0);
  return { exitCode, report, answers: report.evaluations.flatMap((entry) => entry.answers) };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Issue 9 mechanical checks through the real public CLI", () => {
  const nounRule = {
    id: "noun-count",
    engine: "decision",
    scope: "paragraph",
    requiresNounGroupCounts: true,
    instructions: "Interpret the supplied local machine noun counts and source-declared role.",
    pass: "Supported role and numeric limit.",
    fail: "Supported role violates its numeric limit.",
  };
  it("defers missing noun-group evidence with zero requests even outside mechanical-only mode", async () => {
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

  it.each([
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

  it("never collapses an official multiword noun into one arbitrary sentence-level title token", async () => {
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
      wordCount: 4,
      hyphenComponentCounts: [1, 1, 1, 1],
      status: "counted",
    });
  });

  it("defers unsupported declared noun syntax without a model request", async () => {
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

  it("rejects caller-supplied noun count totals as invalid executable evidence", async () => {
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

  it.each([
    ["procedural", 20, "pass"],
    ["procedural", 21, "fail"],
    ["descriptive", 25, "pass"],
    ["descriptive", 26, "fail"],
  ])("enforces the source %s boundary at %i words", async (writingMode, count, choice) => {
    const result = await cli(sentence(count), {
      check: checkFor(writingMode),
      ste: { writingMode },
    });
    expect(result.answers[0]).toMatchObject({
      choice,
      reviewRequired: false,
      counts: [{ wordCount: count, limit: writingMode === "procedural" ? 20 : 25 }],
    });
    expect(result.exitCode).toBe(choice === "pass" ? 0 : 1);
  });

  it("requires declared mode and never infers it from prose or a heading", async () => {
    const missing = await cli("# Procedure\n\nCheck the panel.\n", { ste: {} });
    expect(missing.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("does not apply procedural limits to a declared descriptive target", async () => {
    const result = await cli(sentence(24), { ste: { writingMode: "descriptive" } });
    expect(result.answers[0].choice).toBe("not_applicable");
  });

  it.each([
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

  it("counts hyphens, decimal measurement groups, quotes, and parenthetical identifiers without naive whitespace counts", async () => {
    const result = await cli(
      'Check the quick-release panel (42) at 12.5 kg with the "Maintenance setup" label.',
    );
    expect(result.answers[0]).toMatchObject({ choice: "pass", counts: [{ wordCount: 11 }] });
  });

  it("checks parenthetical prose as a separate word-count unit as well as one outer word", async () => {
    const result = await cli(`Check the panel (${sentence(21).toLowerCase().slice(0, -1)}).`);
    expect(result.answers[0]).toMatchObject({ choice: "fail", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toEqual([4, 21]);
    expect(result.answers[0].findings[0].parenthetical).toBe(true);
  });

  it("does not claim parenthetical prose paragraph boundaries from the word-count rule", async () => {
    const result = await cli("The panel is closed (the latch is locked).", {
      check: { kind: "ste-paragraph-length" },
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("uses colon and each simple vertical-list item as separate word-count units", async () => {
    const result = await cli(
      "Inspect these areas:\n- the upper panel\n- the lower quick-release panel.\n",
    );
    expect(result.answers[0]).toMatchObject({ choice: "pass", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toEqual([3, 3, 4]);
  });

  it("does not mistake vertical-list fragments for paragraph sentences", async () => {
    const result = await cli("The assembly has these parts:\n- the panel\n- the latch.\n", {
      check: { kind: "ste-paragraph-length" },
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("excludes numbered work-step markers from the word count", async () => {
    const result = await cli("1. Check the panel.\n2. Close the latch.\n");
    expect(result.answers[0]).toMatchObject({ choice: "pass", reviewRequired: false });
    expect(result.answers[0].counts.map((entry) => entry.wordCount)).toEqual([3, 3]);
  });

  it("accepts explicit section 8 semantic groups and additional literal measurement units", async () => {
    const result = await cli("Send the panel to North River Works at 4 furlongs.", {
      ste: {
        writingMode: "procedural",
        wordGroups: [{ text: "North River Works", category: "proper-noun" }],
        measurementUnits: ["furlongs"],
      },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 7 }],
    });
    expect(result.answers[0].coverage.declaredWordGroups).toEqual([
      { text: "North River Works", category: "proper-noun" },
    ]);
  });

  it("handles source-illustrated composite identifiers and time abbreviations as one word", async () => {
    const result = await cli("Check the No. 2 panel at 11 a.m. today.");
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 7 }],
    });
  });

  it.each([
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
      reviewRequired: true,
      findings: [],
    });
    expect(result.answers[0].coverage.parserWarnings.length).toBeGreaterThan(0);
  });

  it("keeps prose semicolons distinct from excluded code and unchangeable quotations", async () => {
    const result = await cli(
      'Check the panel; close it. Read "Stop; wait".\n\n```js\nrun();\n```\n',
      { check: { kind: "ste-punctuation" } },
    );
    expect(result.answers[0]).toMatchObject({ choice: "fail", reviewRequired: false });
    expect(result.answers[0].findings).toHaveLength(1);
    expect(result.answers[0].findings[0].sourceRange).toMatchObject({
      startLine: 1,
      endLine: 1,
      startByte: 15,
      endByte: 16,
    });
  });

  it("never substitutes another section for the local counting target", async () => {
    const result = await cli(`# First\n\n${sentence(20)}\n\n# Second\n\n${sentence(21)}\n`, {
      scope: "section",
    });
    expect(result.answers.map((entry) => entry.choice)).toEqual(["pass", "fail"]);
    expect(result.answers[1].findings[0].sourceRange.startLine).toBe(7);
  });

  it("propagates explicit section mode to paragraph targets without leaking across sections", async () => {
    const result = await cli(`${sentence(21)}\n\n${sentence(21)}\n`, {
      scope: "paragraph",
      sections: [
        { startLine: 1, endLine: 1, ste: { writingMode: "descriptive" } },
        { startLine: 3, endLine: 3 },
      ],
    });
    expect(result.answers.map((entry) => entry.choice)).toEqual(["not_applicable", "fail"]);
  });

  it("abstains on page-level mixed writing modes rather than applying a global limit", async () => {
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

  it("does not count a partial paragraph selected by an explicit section", async () => {
    const result = await cli("Check the panel\nand close the latch.\n", {
      scope: "section",
      sections: [{ startLine: 1, endLine: 1 }],
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("keeps missing dictionary evidence unavailable", async () => {
    const result = await cli("Check the panel.", { check: { kind: "ste-dictionary-membership" } });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      lexicalCandidates: [],
      findings: [],
    });
  });

  it("performs literal local vocabulary and inflection lookup without a false contextual compliance decision", async () => {
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
      reviewRequired: true,
      findings: [],
    });
    expect(
      result.answers[0].lexicalCandidates.map((entry) => [entry.term, entry.membership]),
    ).toEqual([
      ["Checked", "approved-form"],
      ["panels", "not-approved-entry"],
      ["remain", "unlisted"],
      ["unknown", "unlisted"],
    ]);
  });

  it("supports exact multiword entries and their declared forms without generating inflections", async () => {
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
      reviewRequired: true,
      findings: [],
    });
    const candidates = result.answers[0].lexicalCandidates;
    expect(candidates[0]).toMatchObject({ term: "Put on", membership: "approved-form" });
    expect(candidates.find((entry) => entry.term === "Puts on").membership).toBe("approved-form");
    expect(candidates.find((entry) => entry.term === "Put-on").membership).toBe("unlisted");
  });

  it("does not treat ordinary descriptive mentions of warnings as a safety instruction", async () => {
    const result = await cli("The warning shows the state.", {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 5 }],
    });
  });

  it("excludes explicit safety labels from a declared procedural count", async () => {
    const result = await cli(`CAUTION: ${sentence(21)}`);
    expect(result.answers[0]).toMatchObject({
      choice: "fail",
      reviewRequired: false,
      counts: [{ wordCount: 21, limit: 20 }],
    });
  });

  it("applies descriptive 25 to an explicitly classified note without counting its label", async () => {
    const result = await cli(`NOTE: ${sentence(25)}`, {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 25, limit: 25 }],
    });
  });

  it("excludes parenthetical work-step numbering and keeps terminal time abbreviation boundaries", async () => {
    const numbered = await cli("(3) Check the panel.");
    expect(numbered.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 3 }],
    });
    const time = await cli("Check the panel at 11 p.m.");
    expect(time.answers[0]).toMatchObject({
      choice: "pass",
      reviewRequired: false,
      counts: [{ wordCount: 5 }],
    });
  });

  it("retains declared technical noun records as candidates rather than dictionary violations", async () => {
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
      reviewRequired: true,
      findings: [],
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

  it("treats an unavailable private vocabulary path as missing evidence, not a pass", async () => {
    const result = await cli("Check the panel.", {
      check: { kind: "ste-dictionary-membership" },
      ste: { vocabularyFile: "missing-private.json" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      findings: [],
    });
  });

  it("defers incorrectly classified safety labels rather than applying descriptive 25", async () => {
    const result = await cli("CAUTION: Keep the panel closed.", {
      check: checkFor("descriptive"),
      ste: { writingMode: "descriptive" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("defers procedural notes instead of treating them as procedural 20", async () => {
    const result = await cli("NOTE: The panel is closed.");
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      counts: [],
    });
  });

  it("does not flag HTML entity terminators as prose semicolons", async () => {
    const result = await cli("Check the panel &amp; latch.", {
      check: { kind: "ste-punctuation" },
    });
    expect(result.answers[0]).toMatchObject({
      choice: "insufficient_context",
      reviewRequired: true,
      findings: [],
    });
  });

  it.each([
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
