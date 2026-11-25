// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from "#statechart/ir.ts";
import { forEachTlcCase } from "./tlc.ts";
import { CHECK_PASSED, COMMAND_ERROR, RULE_BROKEN, copyCase, corpus, read, run } from "./cli-fixtures.ts";

const overBudget = async (file: string): Promise<void> => {
  const text = await readFile(file, "utf8");
  await fs.promises.writeFile(file, text.replaceAll(/\b\d+(?<counted> distinct states found)/gu, "1234$<counted>"));
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a check above the chart budget skips the drawing run and draws only the bug paths", async () => {
  const dir = await copyCase("FirstRule", async (folder) => {
    const files = await readdir(folder);
    await forEachTlcCase(files.filter((file) => /^verdict-\d+\.out$/u.test(file)), async (file) => {
      await overBudget(path.join(folder, file));
    });
  });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.configs.ChartRun, undefined);
  assert.ok(result.files.includes("chart.mmd"));
  assert.match(
    result.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
  visitItems(["NotOne", "NotOneOrThree", "AlsoNotOne", "NoDeadlock"], (rule) => {assert.match(result.report, new RegExp(`^## ${rule} breaks$`, "mu"));});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a passing check above the chart budget writes no chart.mmd and gives the state count", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "verdict-1.out")); });
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.configs.ChartRun, undefined);
  assert.deepEqual(result.files, ["report.md", "tlc.out"]);
  assert.match(
    result.report,
    /^TLC reached 1,234 states, more than the chart budget of 500, so the command wrote no chart\.mmd\.$/mu,
  );
  assert.match(result.report, /^## Rules that hold\nTypeOK, NoDeadlock$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that INSTANCE actions break above the chart budget draws their qualified names and the loop", async () => {
  const dir = await copyCase("CounterInstance", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "verdict-1.out")); });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.configs.ChartRun, undefined);
  assert.match(
    result.report,
    /^1\. C!Up: 1\n2\. C!Up: 2\n3\. C!Back: 1\nThe run loops through "1" and "2" forever\.$/mu,
  );
  assert.match(await read(path.join(result.out, "chart.mmd")), /^ {2}s\d+ --> s\d+: C!Back$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that counts more states than the chart budget gives only the bug paths", async () => {
  const dir = await copyCase("FirstRule", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "ChartRun.out")); });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.match(result.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  assert.match(
    result.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property with no temporal operator says TLC checked it only in the initial states", async () => {
  const result = await run(path.join(corpus, "Counter"));
  assert.equal(result.status, CHECK_PASSED);
  assert.match(result.report, /^## Rules that hold\nLow, StaysSmall\n/mu);
  assert.match(
    result.report,
    /^TLC checked Low only in the initial states, because it has no \[\], <>, or ~>\. List it as an INVARIANT to check every state\.$/mu,
  );
  assert.doesNotMatch(result.report, /TLC checked StaysSmall/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that the config replaces with a state predicate gets the initial-states note", async () => {
  const dir = await copyCase("Counter", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "Counter.cfg"),
      "SPECIFICATION Spec\nCONSTANT StaysSmall <- Low\nPROPERTY StaysSmall\nCHECK_DEADLOCK FALSE\n",
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.match(result.report, /^TLC checked StaysSmall only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that an extended module also defines as LOCAL takes the root definition's level", async () => {
  const result = await run(path.join(corpus, "Shadow"));
  assert.equal(result.status, CHECK_PASSED);
  assert.doesNotMatch(result.report, /TLC checked Shadow/u);
  assert.match(result.report, /^TLC checked Shade only in the initial states, /mu);
  assert.match(result.report, /^TLC checked Hold only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property from an extended module gets the initial-states note too", async () => {
  const dir = await copyCase("MediaPlayerProps", async (copiedDirectory) => {
    await fs.promises.appendFile(path.join(copiedDirectory, "MediaPlayerProps.cfg"), "\nPROPERTY TypeOK\n");
    await fs.promises.copyFile(path.join(copiedDirectory, "verdict-6.out"), path.join(copiedDirectory, "verdict-7.out"));
  });
  const result = await run(dir);
  assert.match(result.report, /^TLC checked TypeOK only in the initial states, /mu);
  assert.doesNotMatch(result.report, /TLC checked (?:EventuallyStops|StaysTyped)/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a spec that SANY cannot read stops the command with exit 2", async () => {
  const dir = await copyCase("MediaPlayer", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "sany.exit"), "150\n"); });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /SANY could not read .*MediaPlayer\.tla \(exit 150\)/u);
  assert.deepEqual(result.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a first verdict run that TLC cannot finish stops the command with exit 2", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "verdict-1.exit"), "150\n"); });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /TLC could not check .*Login\.tla \(exit 150\)/u);
  assert.deepEqual(result.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a later verdict run that TLC cannot finish keeps the exit and leaves its rules not checked", async () => {
  const dir = await copyCase("CounterJump", async (copiedDirectory) =>
    { await fs.promises.writeFile(path.join(copiedDirectory, "verdict-2.exit"), "150\n"); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.match(result.report, /^## NotThree breaks$/mu);
  assert.match(
    result.report,
    /^## Rules not checked\nNoDeadlock\nTLC stopped with exit 150 before it checked this rule:$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that TLC cannot finish stops the command with exit 2", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => {
    await fs.promises.rm(path.join(copiedDirectory, "graph.dot"));
    await fs.promises.writeFile(path.join(copiedDirectory, "ChartRun.exit"), "150\n");
  });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /TLC could not check .*Login\.tla \(exit 150\)/u);
});
