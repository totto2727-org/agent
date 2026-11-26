// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { fileExists } from "#statechart/run.ts";
import { forEachTlcCase } from "./tlc.ts";
import { INDEX_STEP, RULE_BROKEN, TLC_PASSED, copyCase, corpus, read, replayStatus, run } from "./cli-fixtures.ts";

const named = (report: string): string[] => {
  const files: string[] = [];
  visitItems(report.matchAll(/\btlc-\w+\.out\b/gu), ([file]) => {if (!files.includes(file)) {files.push(file);}});
  return files;
};

const assertGoldenOutput = async (directory: string, result: Awaited<ReturnType<typeof run>>, label?: string): Promise<void> => {
  assert.equal(result.report, await read(path.join(directory, "report.md")), label);
  assert.equal(await read(path.join(result.out, "chart.mmd")), await read(path.join(directory, "chart.mmd")), label);
};

const recordedStatus = async (directory: string): Promise<number> => {
  const verdict = path.join(directory, "verdict-1.exit");
  const status = (await fileExists(verdict)) ? Number(await readFile(verdict, "utf8")) : TLC_PASSED;
  return replayStatus(status);
};

const corpusNames = await readdir(corpus);

visitItems(corpusNames, (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output`, async () => {
    const dir = path.join(corpus, name);
    const result = await run(dir);
    assert.equal(result.stderr, "");
    assert.equal(result.status, await recordedStatus(dir));
    await assertGoldenOutput(dir, result);
    assert.deepEqual(result.files, ["chart.mmd", "report.md", "tlc.out", ...named(result.report)].toSorted());
    await forEachTlcCase(result.files, async (currentFile) => {assert.doesNotMatch(await read(path.join(result.out, currentFile)), /@!@!@/u, currentFile);});
    assert.match(result.configs.ChartRun, /^INVARIANT ChartMark$/mu);
    assert.match(result.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  });
});

const asTlcPrintsOnWindows = function (text: string): string {
  const lines = text.split("\n");
  const lastIndex = lines.length - INDEX_STEP;
  const noOpenMessages = 0;
  const oneMessage = 1;
  const frames = { depth: noOpenMessages };
  return lines.map((line, index) => {
    if (index === lastIndex) {return line;}
    if (/@!@!@STARTMSG \d+:\d+ @!@!@$/u.test(line)) {
      frames.depth += oneMessage;
    } else if (/^@!@!@ENDMSG \d+ @!@!@$/u.test(line)) {
      frames.depth -= oneMessage;
    }
    return frames.depth === noOpenMessages ? `${line}\r` : line;
  }).join("\n");
};

visitItems(corpusNames, (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output with Windows line ends`, async () => {
    const dir = await copyCase(name, async (folder) => {
      const files = await readdir(folder);
      await forEachTlcCase(files, async (file) => {
        if (!file.endsWith(".out")) {return;}
        const output = path.join(folder, file);
        const text = await readFile(output, "utf8");
        await writeFile(output, asTlcPrintsOnWindows(text));
      });
    });
    const result = await run(dir);
    assert.equal(result.stderr, "");
    assert.equal(result.status, await recordedStatus(dir));
    await assertGoldenOutput(path.join(corpus, name), result);
    await forEachTlcCase(result.files, async (currentFile) => {assert.doesNotMatch(await read(path.join(result.out, currentFile)), /\r|@!@!@/u, currentFile);});
  });
});

const renameDotStates = (dot: string): string[] => {
  const ids = new Map<string, string>();
  const firstReplacementId = 9000;
  const replacementStride = 17;
  const id = (originalId: string): string => {
    const existing = ids.get(originalId);
    if (!matchesUndefined(existing)) {return existing;}
    const replacement = String(firstReplacementId - ids.size * replacementStride);
    ids.set(originalId, replacement);
    return replacement;
  };
  const lines: string[] = [];
  visitItems(dot.split("\n"), (part) => {if (/^-?\d+ (?:\[|->)/u.test(part))
      {lines.push(
        part.replace(
          /^(?<fromId>-?\d+)(?: -> (?<toId>-?\d+))?/u,
          (_match: string, fromId: string, toId: string | undefined) => `${id(fromId)}${matchesUndefined(toId) ? "" : ` -> ${id(toId)}`}`,
        ),
      );}});
  return lines;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the order of TLC's dump and its state IDs do not change the chart or the report", async () => {
  const firstSeed = 7;
  const multiplier = 48_271;
  const modulus = 2_147_483_647;
  const generator = { seed: firstSeed };
  const random = (): number => {
    generator.seed = (generator.seed * multiplier) % modulus;
    return generator.seed / modulus;
  };
  await forEachTlcCase(["DieHard", "LoginParallel", "TwoPhase"], async (name) => {
    const dir = await copyCase(name, async (copiedDirectory) => {
      const file = path.join(copiedDirectory, "graph.dot");
      const dot = await read(file);
      const lines = renameDotStates(dot);
      const indices = Array.from({ length: lines.length }, (_line, index) => index);
      visitItems(indices.slice(INDEX_STEP).toReversed(), (shuffleIndex) => {
        const swapIndex = Math.floor(random() * (shuffleIndex + INDEX_STEP));
        [lines[shuffleIndex], lines[swapIndex]] = [lines[swapIndex], lines[shuffleIndex]];
      });
      await writeFile(file, ["strict digraph DiskGraph {", ...lines, "}"].join("\n"));
    });
    const result = await run(dir);
    await assertGoldenOutput(path.join(corpus, name), result, name);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a broken property is named in the report, and its TLC trace is in tlc-NAME.out", async () => {
  const dir = path.join(corpus, "MediaPlayerProps");
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  await forEachTlcCase(["EventuallyPlays", "QuietWhenStopped"], async (propertyName) => {
    assert.match(result.report, new RegExp(`^## ${propertyName} breaks\n.*tlc-${propertyName}\\.out`, "mu"));
    const out = await read(path.join(result.out, `tlc-${propertyName}.out`));
    const from: string[] = [];
    await forEachTlcCase(Object.keys(result.configs), async (name) => {
      if (!name.startsWith("verdict-")) {return;}
      const tool = await read(path.join(dir, `${name}.out`));
      if (tool && out === `${[...plainText(readMessages(tool))].join("")}\n`) {from.push(name);}
    });
    const expectedVerdictFiles = 1;
    assert.equal(from.length, expectedVerdictFiles, propertyName);
    assert.match(result.configs[from[0]], new RegExp(`^PROPERTY ${propertyName}$`, "mu"));
    assert.match(out, /^TLC2 Version /u);
    assert.doesNotMatch(out, /@!@!@/u);
  });
  assert.match(await read(path.join(result.out, "tlc-QuietWhenStopped.out")), /^State 2: <YouTurnItUp /mu);
  assert.match(result.report, /^## Rules that hold\n.*\bEventuallyStops\b.*\bStaysTyped\b/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC checks the rules and draws the chart with VIEW and SYMMETRY, and the report says an arrow can lead to a representative", async () => {
  const dir = await copyCase("MediaPlayer", async (copiedDirectory) =>
    { await appendFile(path.join(copiedDirectory, "MediaPlayer.cfg"), "\nVIEW vars\nSYMMETRY Perms\n"); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  const verdict = result.configs["verdict-1"];
  assert.match(verdict, /^PROPERTY EventuallyStops$/mu);
  visitItems([verdict, result.configs.ChartRun], (config) => {
    assert.match(config, /^VIEW vars$/mu);
    assert.match(config, /^SYMMETRY Perms$/mu);
  });
  assert.match(
    result.report,
    /^With VIEW and SYMMETRY, TLC keeps one representative for each group of states that it counts as the same\. An arrow can lead to the representative rather than to the state that the step reaches\.$/mu,
  );
  const { report } = await run(path.join(corpus, "MediaPlayer"));
  assert.doesNotMatch(report, /representative/u);
});
