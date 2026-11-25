// oxlint-disable-next-line rules/no-node-imports -- Test the distributed script with a native Node subprocess.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Create and remove temporary CLI fixtures and read their reports.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Place subprocess fixtures in the system temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the paths used by the native evaluator CLI.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Find the distributed program relative to this fixture.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await Node's native Promise overload for execFile.
import { promisify } from "node:util";
import { assert } from "vitest";
import { object } from "./evaluation-validation.mjs";
import { matchesUndefined } from "./native-predicates.mjs";

/** @typedef {{ endLine: number, headingPath?: string[], id?: string, startLine: number }} FixtureRange */
/** @typedef {{ audience: string, id: string, path: string, purpose: string, ruleIds?: string[], sections?: FixtureRange[], sourceLanguage?: string, ste?: Record<string, unknown> }} FixtureDocument */
/** @typedef {{ documents: FixtureDocument[], rules?: Record<string, unknown>[], rulesFile?: string }} FixtureManifest */
/** @typedef {{ secondAudience?: string, secondRuleIds?: string[], model?: string }} DuplicateOptions */
/** @typedef {{ approved: boolean, forms: string[], meaning: string, partOfSpeech: string, word: string }} VocabularyEntry */
/** @typedef {{ entries: VocabularyEntry[], issue: number, source: string, technicalTerms?: { category: number, kind: string, source: string, text: string }[] }} FixtureVocabulary */

// oxlint-disable-next-line typescript/strict-void-return -- Node provides a native custom Promise for execFile.
const execute = promisify(execFile);
const script = fileURLToPath(new URL("evaluate.mjs", import.meta.url));

/** @type {(args: string[], options?: import("node:child_process").ExecFileOptions) => Promise<Awaited<ReturnType<typeof execute>>>} */
export const runEvaluationCli = async (args, options) =>
  execute(process.execPath, [script, ...args], options);

const FIRST_FIXTURE = 0;

/** @type {string[]} */
const temporaryDirectories = [];

/** @type {(file: string) => Promise<FixtureManifest>} */
export const readFixtureManifest = async (file) => {
  const manifest = object(JSON.parse(await readFile(file, "utf8")), "fixture manifest");
  assert(Array.isArray(manifest.documents), "Fixture manifest needs its document list.");
  /* oxlint-disable typescript/no-unsafe-type-assertion -- The runner reads and mutates the manifest created by its fixture writers. */
  return (
    /** @type {FixtureManifest} */
    (manifest)
  );
  /* oxlint-enable typescript/no-unsafe-type-assertion */
};

export const fixture = async function fixture({ model = "clef-flash" } = {}) {
  const directory = await mkdtemp(path.resolve(tmpdir(), "audit-english-docs-test-"));
  temporaryDirectories.push(directory);
  await writeFile(
    path.resolve(directory, "guide.md"),
    "# Start\n\nUse the tool.\n\n## Details\n\n```md\n# Not a heading\n```\n\nMore detail.\n",
  );
  const manifest = {
    documents: [
      {
        audience: "A new user.",
        expected: { direct: "pass" },
        id: "guide",
        path: "guide.md",
        purpose: "Teach setup.",
        ruleIds: ["direct", "flow"],
      },
    ],
    model,
    rules: [
      {
        expected: "pass",
        fail: "Indirect.",
        id: "direct",
        instructions: "Evaluate directness.",
        pass: "Direct.",
        scope: "section",
      },
      {
        fail: "Fragmented.",
        id: "flow",
        instructions: "Evaluate flow.",
        pass: "Coherent.",
        scope: "page",
      },
    ],
    threshold: 0.8,
  };
  const manifestPath = path.resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { directory, manifestPath, outputPath: path.resolve(directory, "report.json") };
};

/** @type {(word: string, meaning: string) => VocabularyEntry} */
const entry = (word, meaning) => ({
  approved: true,
  forms: [],
  meaning,
  partOfSpeech: "synthetic",
  word,
});

/** @type {(complete: boolean) => FixtureVocabulary} */
const vocabularyData = (complete) => ({
  entries: [
    entry("check", "Selected local meaning."),
    entry("unrelated", "UNMATCHED-PRIVATE-MEANING"),
    ...(complete
      ? [entry("the", "Synthetic determiner."), entry("panel", "Synthetic object.")]
      : []),
  ],
  issue: 9,
  source: "Original bounded source declaration for tests, not STE dictionary data.",
});

/** @type {(file: string, vocabulary: boolean) => Promise<FixtureManifest>} */
const dictionaryManifest = async (file, vocabulary) => {
  const manifest = await readFixtureManifest(file);
  manifest.rules = [
    {
      fail: "A supplied entry demonstrates a contextual violation.",
      id: "dictionary-context",
      instructions: "Evaluate the listed meaning and part of speech in this target.",
      pass: "All target uses obey supplied entries.",
      requiresDictionaryEntries: true,
      scope: "paragraph",
    },
  ];
  manifest.documents[0].ruleIds = ["dictionary-context"];
  manifest.documents[0].sections = [{ endLine: 1, startLine: 1 }];
  manifest.documents[0].ste = vocabulary ? { vocabularyFile: "private-vocabulary.json" } : {};
  return manifest;
};

export const dictionaryFixture = async function ({ complete = false, vocabulary = true } = {}) {
  const paths = await fixture();
  await writeFile(
    path.resolve(paths.directory, "guide.md"),
    "Check the panel.\n\n# Elsewhere\n\nUnrelated evidence.\n",
  );
  const manifest = await dictionaryManifest(paths.manifestPath, vocabulary);
  const data = vocabularyData(complete);
  if (vocabulary) {
    await writeFile(path.resolve(paths.directory, "private-vocabulary.json"), JSON.stringify(data));
  }
  await writeFile(paths.manifestPath, JSON.stringify(manifest));
  return { ...paths, data };
};

/** @type {(id: string, overrides?: Partial<FixtureDocument>) => FixtureDocument} */
const document = (id, overrides = {}) => ({
  audience: "A new user.",
  id,
  path: "guide.md",
  purpose: "Teach setup.",
  ruleIds: ["direct", "flow"],
  ...overrides,
});

/**
 * @param {DuplicateOptions} options - Overrides for the second copy of the fixture.
 * @returns {object} The two-document manifest.
 */
const duplicateManifest = ({ model = "clef-flash", secondAudience, secondRuleIds }) => ({
  documents: [
    document("guide-a"),
    document("guide-b", {
      ...(matchesUndefined(secondAudience) ? {} : { audience: secondAudience }),
      ...(matchesUndefined(secondRuleIds) ? {} : { ruleIds: secondRuleIds }),
    }),
  ],
  model,
  rules: [
    {
      fail: "Indirect.",
      id: "direct",
      instructions: "Evaluate directness.",
      pass: "Direct.",
      scope: "section",
    },
    {
      fail: "Loose.",
      id: "strict",
      instructions: "Evaluate strictness.",
      pass: "Strict.",
      scope: "section",
    },
    {
      fail: "Fragmented.",
      id: "flow",
      instructions: "Evaluate flow.",
      pass: "Coherent.",
      scope: "page",
    },
  ],
  threshold: 0.8,
});

/** @type {(options?: DuplicateOptions) => Promise<{ directory: string, manifestPath: string, outputPath: string }>} */
export const duplicateFixture = async (options = {}) => {
  const directory = await mkdtemp(path.resolve(tmpdir(), "audit-english-docs-test-"));
  temporaryDirectories.push(directory);
  await writeFile(
    path.resolve(directory, "guide.md"),
    "# Start\n\nUse the tool.\n\n## Details\n\nMore detail.\n",
  );
  const manifest = duplicateManifest(options);
  const manifestPath = path.resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { directory, manifestPath, outputPath: path.resolve(directory, "report.json") };
};

export const cleanupFixtures = async () => {
  await Promise.all(
    temporaryDirectories
      .splice(FIRST_FIXTURE)
      .map(async (directory) => rm(directory, { force: true, recursive: true })),
  );
};
