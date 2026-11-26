// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Read the actual recorded files produced by the JVM and the standalone skill.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart uses the native host's filesystem path syntax.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { fileExists } from "#statechart/run.ts";
import { forEachTlcCase, skip } from "./tlc.ts";
import { corpus, readPlainAndTool } from "./tlc-out-run.ts";
import type { TwinFolders } from "./tlc-out-run.ts";

const CORPUS_CONCURRENCY = 4;

const maybe = async (file: string): Promise<string> => (await fileExists(file)) ? fs.readFile(file, "utf8") : "";
const plain = (text: string): string => [...plainText(readMessages(text))].join("");

const steady = (text: string): string =>
  text
    .replaceAll(/"chart-[0-9a-f]{32}"/gu, '"chart"')
    .replaceAll(/\bfp \d+ and seed -?\d+/gu, "fp _ and seed _")
    .replaceAll(/\[pid: \d+\]/gu, "[pid: _]")
    .replaceAll(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/gu, "_")
    .replaceAll(/ \([\d,]+ d?s\/min\)/gu, "")
    .replaceAll(/ in (?:\d+d \d\dh|\d\dh \d\dmin|\d\dmin \d\ds|\d\ds) at /gu, " in _ at ");

const compareRecordings = async ({ tool, twin }: TwinFolders, run: string): Promise<void> => {
  const exit = run.replace(/\.out$/u, ".exit");
  const recordedExit = await maybe(path.join(tool, exit));
  const plainExit = await maybe(path.join(twin, exit));
  assert.equal(recordedExit, plainExit, exit);
  const recorded = await fs.readFile(path.join(tool, run), "utf8");
  const terminal = await fs.readFile(path.join(twin, run), "utf8");
  assert.equal(steady(plain(recorded)), steady(terminal), run);
};

const compareVerdicts = async ({ out, twin }: TwinFolders, runs: string[]): Promise<void> => {
  const primary = await fs.readFile(path.join(out, "tlc.out"), "utf8");
  const direct = await fs.readFile(path.join(twin, "verdict-1.out"), "utf8");
  assert.equal(steady(primary), steady(`${direct}\n`));
  const verdicts = new Set<string>();
  await forEachTlcCase(runs, async (run) => {
    if (run.startsWith("verdict-")) {
      const text = await fs.readFile(path.join(twin, run), "utf8");
      verdicts.add(steady(`${text}\n`));
    }
  });
  const files = await fs.readdir(out);
  await forEachTlcCase(files, async (file) => {
    if (/^tlc-\w+\.out$/u.test(file)) {
      const text = await fs.readFile(path.join(out, file), "utf8");
      assert.ok(verdicts.has(steady(text)), file);
    }
  });
};

const compareTwin = async (name: string): Promise<void> => {
  const { folders, stderr } = await readPlainAndTool(name);
  assert.equal(stderr, "");
  const recorded = await fs.readdir(folders.twin);
  const runs = recorded.filter((file) => file.endsWith(".out"));
  assert.ok(runs.includes("ChartRun.out"), "the drawing run has a plain twin");
  await forEachTlcCase(runs, async (run) => {await compareRecordings(folders, run);});
  await compareVerdicts(folders, runs);
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "each corpus spec's TLC output reads as plain TLC prints it at -workers 1",
  { concurrency: CORPUS_CONCURRENCY, skip },
  async (testContext) => {
    const names = await fs.readdir(corpus);
    await Promise.all(names.map(async (name) => {
      await testContext.test(name, async () => {await compareTwin(name);});
    }));
  },
);
