// oxlint-disable-next-line rules/no-node-imports -- Node supplies the corpus integration test assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Read the native fixture directories and copy the locale test input.
import { cp, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve corpus and output paths with the host conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart registers these cases with the native Node test runner.
import { test } from "node:test";
import { hostEnvironment } from "#statechart/host-env.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { check, fileExists } from "#statechart/run.ts";
import { BROKEN_SPEC, CYCLE_SPEC, GRID_CASES, INVALID_CASES, LEXICAL_CASES, SLOW_LOOP_SPEC, wideSpec } from "./corpus-cases.ts";
import {
  corpus, plainTlc, read, recordedExit, recordTlc, runCli, scratchDirectory, updateCorpusFixture, writeSpec,
} from "./corpus-run.ts";
import { skip } from "./tlc.ts";

const SUCCESS = 0;
const MODEL_VIOLATION = 1;
const LOOP_STATES = 3;
const REPORT_HEADER = 2;
const CHECK_SPEC = "INIT Init\nNEXT Next\n";
const LIVENESS_SPEC = "SPECIFICATION Spec\nPROPERTY Prop\n";

const useTempDirectory = (directory: string): (() => void) => {
  const environment = hostEnvironment();
  const saved = environment.TMPDIR;
  environment.TMPDIR = directory;
  return () => {
    if (matchesUndefined(saved)) {Reflect.deleteProperty(environment, "TMPDIR");}
    else {environment.TMPDIR = saved;}
  };
};

type CliResult = Awaited<ReturnType<typeof runCli>>;

const runCorpusFixture = async (fixture: string, name: string): Promise<{ output: string; result: CliResult }> => {
  const directory = await scratchDirectory();
  const { environment, recordings } = await recordTlc(directory);
  const output = path.join(directory, "out");
  const view = path.join(fixture, "view.mjs");
  const result = await runCli({
    environment, output, spec: path.join(fixture, `${name}.tla`),
    ...(await fileExists(view) ? { view } : {}),
  });
  assert.equal(result.stderr, "");
  const update = Boolean(hostEnvironment().STATECHART_UPDATE);
  if (update) {await updateCorpusFixture(fixture, recordings, output);}
  return { output, result };
};

const runWrittenSpec = async (base: string): Promise<{ output: string; result: CliResult }> => {
  const output = path.join(path.dirname(base), "out");
  return { output, result: await runCli({ output, spec: `${base}.tla` }) };
};

visitItems(await readdir(corpus), (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} gives the committed chart and report when TLC runs`, { skip }, async () => {
    const dir = path.join(corpus, name);
    const { output, result } = await runCorpusFixture(dir, name);
    assert.equal(result.status, await recordedExit(dir));
    assert.equal(await read(path.join(output, "report.md")), await read(path.join(dir, "report.md")));
    assert.equal(await read(path.join(output, "chart.mmd")), await read(path.join(dir, "chart.mmd")));
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a spec in a folder whose name is not ASCII checks under the POSIX locale", { skip }, async () => {
  const scratch = await scratchDirectory();
  const dir = path.join(scratch, "spec-é");
  await cp(path.join(corpus, "Login"), dir, { recursive: true });
  const output = path.join(dir, "out");
  const result = await runCli({
    environment: { ...hostEnvironment(), LANG: "", LC_ALL: "POSIX", LC_CTYPE: "" },
    output,
    spec: path.join(dir, "Login.tla"),
    view: path.join(dir, "view.mjs"),
  });
  assert.equal(result.stderr, "");
  assert.equal(result.status, SUCCESS);
  assert.equal(await read(path.join(output, "chart.mmd")), await read(path.join(corpus, "Login", "chart.mmd")));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an invariant named NoDeadlock and a deadlock break as two rules", { skip }, async () => {
  const scratch = await scratchDirectory();
  const output = path.join(scratch, "out");
  const result = await runCli({ output, spec: path.join(corpus, "UserNoDeadlock", "UserNoDeadlock.tla") });
  assert.equal(result.stderr, "");
  assert.equal(result.status, MODEL_VIOLATION);
  const report = await read(path.join(output, "report.md"));
  assert.match(report, /^## NoDeadlock breaks\nThe shortest path has 1 step:\n0\. 0\n1\. Next: 1$/mu);
  assert.match(report, /^## CHECK_DEADLOCK breaks\nThe shortest path has 3 steps:\n(?:.*\n){3}3\. Next: 3$/mu);
});

const displayedPath = (report: string, rule: string | undefined): string[] => {
  const steps = new RegExp(
    `^## ${rule} breaks\\nThe shortest path has \\d+ steps?:\\n0\\. .*\\n(?<path>(?:\\d+\\. .*\\n?)*)`, "mu",
  ).exec(report)?.groups?.path;
  assert.ok(!matchesUndefined(steps), `the report has a path for ${rule}`);
  return [...steps.matchAll(/^\d+\. (?<step>\w+): /gmu)].map((match) => match.groups?.step ?? "");
};

visitItems(LEXICAL_CASES, ([input, name, tla]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a spec with ${input} gives plain TLC's exit and path`, { skip }, async () => {
    const base = await writeSpec(name, tla, "SPECIFICATION Spec\nINVARIANT Low\n");
    const tlc = await plainTlc(base);
    assert.equal(tlc.rule, "Low");
    const { output, result } = await runWrittenSpec(base);
    assert.equal(result.stderr, "");
    assert.equal(result.status, tlc.exit);
    const report = await read(path.join(output, "report.md"));
    assert.deepEqual(displayedPath(report, tlc.rule), tlc.path);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that breaks on a loop draws the loop and reports it", { skip }, async () => {
  const base = await writeSpec("Cycle", CYCLE_SPEC, LIVENESS_SPEC);
  const { output, result } = await runWrittenSpec(base);
  assert.equal(result.stderr, "");
  assert.equal(result.status, MODEL_VIOLATION);
  const report = await read(path.join(output, "report.md"));
  assert.match(report, /^## Prop breaks\nTLC's counterexample is in tlc-Prop\.out\. It has 3 steps:\n0\. 0\n1\. Next: 1\n2\. Next: 2\n3\. Next: 0\nThe run loops through "0", "1" and "2" forever\.$/mu);
  const chart = await read(path.join(output, "chart.mmd"));
  assert.equal(chart.match(/^ {2}class s\d+ repeats$/gmu)?.length, LOOP_STATES);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property's loop comes from the whole state graph when TLC explores for over 3 seconds", { skip }, async () => {
  const base = await writeSpec("SlowLoop", SLOW_LOOP_SPEC, LIVENESS_SPEC);
  const { output, result } = await runWrittenSpec(base);
  assert.equal(result.stderr, "");
  assert.equal(result.status, MODEL_VIOLATION);
  const report = await read(path.join(output, "report.md"));
  assert.match(report, /^## Prop breaks\nTLC's counterexample is in tlc-Prop\.out\. It has 17 steps:\n0\. 0\n1\. Deep: 1\n(?:.*\n){14}16\. Turn: 16\n17\. Back: 15\nThe run loops through "15" and "16" forever\.$/mu);
});

visitItems(GRID_CASES, ({ chart, config, drawn, header, height, status, width }) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`TLC keeps the chart within its budget of 500 states on a ${width} by ${height} grid with ${config}`, { skip }, async () => {
    const base = await writeSpec("Wide", wideSpec(width, height), `INIT Init\nNEXT Next\n${config}\nCHECK_DEADLOCK FALSE\n`);
    const { environment, recordings } = await recordTlc(path.dirname(base));
    const output = path.join(path.dirname(base), "out");
    const result = await runCli({ environment, output, spec: `${base}.tla` });
    assert.equal(result.stderr, "");
    assert.equal(result.status, status);
    assert.equal(await fileExists(path.join(recordings, "ChartRun.out")), drawn);
    assert.equal(await fileExists(path.join(output, "chart.mmd")), chart);
    const report = await read(path.join(output, "report.md"));
    assert.equal(report.split("\n")[REPORT_HEADER], header);
  });
});

visitItems(INVALID_CASES, ([what, tla, where]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a spec with ${what} gets SANY's line and column, not a Java stack trace`, { skip }, async () => {
    const base = await writeSpec("Broken", tla, CHECK_SPEC);
    await assert.rejects(check(`${base}.tla`, `${base}.cfg`), (error: Error) => {
      assert.match(error.message, /^SANY could not read .*Broken\.tla \(exit 1\):\n/u);
      assert.match(error.message, where);
      assert.doesNotMatch(error.message, /^\s+at tla2sany\./mu);
      return true;
    });
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("check() leaves no statechart- folder in the temp dir when it returns and when it throws", { skip }, async () => {
  const login = path.join(corpus, "Login", "Login");
  const base = await writeSpec("Broken", BROKEN_SPEC, CHECK_SPEC);
  const scratch = await scratchDirectory();
  const restore = useTempDirectory(scratch);
  try {
    await check(`${login}.tla`, `${login}.cfg`);
    await assert.rejects(check(`${base}.tla`, `${base}.cfg`), /SANY could not read/u);
  } finally {
    restore();
  }
  assert.deepEqual(await readdir(scratch), []);
});
