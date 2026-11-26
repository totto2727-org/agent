// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Await each host filesystem operation used to set up and remove the real TLC fixture.
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
import { fileExists, PINNED_FLAGS, runChild } from "#statechart/run.ts";
import { matchesNull, matchesUndefined, visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const here = import.meta.dirname;
const jar = hostEnvironment().TLA2TOOLS;
const hasJar = Boolean(jar);
export const skip = !hasJar && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";

const FIXTURE_OUTPUT_LIMIT = 1_048_576;
export const FIXTURE_PROCESS_OPTIONS = { maxBuffer: FIXTURE_OUTPUT_LIMIT, windowsHide: false };

export const forEachTlcCase = async <Case>(
  cases: Iterable<Case>,
  check: (fixture: Case) => Promise<void>,
): Promise<void> => {
  // oxlint-disable-next-line rules/no-for-loops -- Iterate fixture cases in order and close their iterator on failure.
  for (const fixture of cases) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each command uses the files left by the previous fixture operation.
    await check(fixture);
  }
};

const RULES = /^(?:INVARIANTS?|PROPERTY|PROPERTIES|CHECK_DEADLOCK)$/u;
const DONE = 0;
const MODEL_VIOLATION = 1;
const NO_VERDICT = 2;
const TLC_DEADLOCK = 11;
const TLC_SAFETY = 12;
const TLC_LIVENESS = 13;
const NO_STEPS = 0;
const START_FRAME = 1;
const SINGLE_PROPERTY = 1;
const NO_WORD = "";
const TLC_VIOLATIONS = new Set([TLC_DEADLOCK, TLC_SAFETY, TLC_LIVENESS]);

export const exitClass = (status: number | null): number => {
  if (status === DONE) {return DONE;}
  if (!matchesNull(status) && TLC_VIOLATIONS.has(status)) {return MODEL_VIOLATION;}
  return NO_VERDICT;
};

const stepsIn = (text: string): number =>
  Math.max((text.match(/^State \d+: (?!Stuttering$)/gmu)?.length ?? NO_STEPS) - START_FRAME, NO_STEPS) +
  (text.match(/^Back to state \d+: </gmu)?.length ?? NO_STEPS);

const sectionLines = (cfg: string, use: (line: string, section: string) => void): void => {
  const state = { section: "" };
  visitItems(cfg.split("\n"), (line) => {
    state.section = /^[A-Z_]+/u.exec(line)?.[0] ?? state.section;
    use(line, state.section);
  });
};

const properties = function (cfg: string): string[] {
  const names: string[] = [];
  sectionLines(cfg, (line, section) => {
    if (/^PROPERT(?:Y|IES)$/u.test(section)) {
      visitItems(line.trim().split(/\s+/u), (word) => {
        if (word !== NO_WORD && word !== section) {names.push(word);}
      });
    }
  });
  return names;
};

const brokenRule = (out: string, cfg: string): string | undefined => {
  const rule = /^Error: (?:Invariant|Action property|Property) (?<rule>\S+) is violated/mu.exec(out)?.groups?.rule;
  if (!matchesUndefined(rule)) {return rule;}
  if (/^Error: Deadlock reached\./mu.test(out)) {return "NoDeadlock";}
  const temporal = properties(cfg);
  if (/^Error: Temporal properties were violated\./mu.test(out) && temporal.length === SINGLE_PROPERTY) {return temporal[0];}
  return undefined;
};

interface PlainResult {
  broke: string | undefined;
  out: string;
  status: number | null;
  steps: number;
}

const preparePlainRun = async (dir: string, cfg: string): Promise<{ file: string; run: string; tmp: string }> => {
  const files = await readdir(dir);
  const run = `alone-${files.length}`;
  const file = path.join(dir, `${run}.cfg`);
  await writeFile(file, cfg);
  const tmp = path.join(dir, `${run}-tmp`);
  await mkdir(tmp);
  return { file, run, tmp };
};

const tlc = async function (dir: string, module: string, cfg: string): Promise<PlainResult> {
  const { file, run, tmp } = await preparePlainRun(dir, cfg);
  const commandResult = await runChild(
    hostEnvironment().JAVA ?? "java",
    [
      `-Djava.io.tmpdir=${tmp}`,
      "-cp",
      jar ?? "",
      "tlc2.TLC",
      ...PINNED_FLAGS,
      "-config",
      file,
      "-metadir",
      path.join(dir, `${run}-meta`),
      module,
    ],
    { ...FIXTURE_PROCESS_OPTIONS, cwd: dir },
  );
  const out = commandResult.stdout + commandResult.stderr;
  return { broke: brokenRule(out, cfg), out, status: commandResult.status, steps: stepsIn(out) };
};

const alone = function (cfg: string, rule: string): string {
  const lines: string[] = [];
  sectionLines(cfg, (line, section) => {
    if (!RULES.test(section)) {lines.push(line);}
  });
  if (rule !== "NoDeadlock") {
    lines.push(
      `${properties(cfg).includes(rule) ? "PROPERTY" : "INVARIANT"} ${rule}`,
      "CHECK_DEADLOCK FALSE",
    );
  }
  return `${lines.join("\n")}\n`;
};

export interface Verdict {
  status: number | null;
  breaks: Map<string, number>;
  holds: string[];
  unchecked: string[];
  chart: string;
  report: string;
}

interface Fixture {
  cfg: string;
  dir: string;
  module: string;
}

const optionalText = async (file: string): Promise<string> =>
  (await fileExists(file)) ? readFile(file, "utf8") : "";

type ProcessOutput = Awaited<ReturnType<typeof runChild>>;

const checkFailedRun = (plain: string, shown: string, failure: string): void => {
  const error = /^Error: .*$/mu.exec(plain)?.[0];
  assert.ok(!matchesUndefined(error) && shown.includes(error), failure);
};

const checkExit = (cli: ProcessOutput, plain: PlainResult, report: string): void => {
  const shown = `${cli.stderr}${report}`;
  const failure = `TLC says:\n${plain.out}\nThe command says:\n${shown}`;
  assert.equal(cli.status, exitClass(plain.status), failure);
  assert.doesNotMatch(shown, /Chart\w*Mark/u);
  if (cli.status !== NO_VERDICT) {assert.equal(cli.stderr, "");}
  if (report === NO_WORD) {assert.match(cli.stderr, /TLC could not check/u);}
  if (cli.status === NO_VERDICT) {checkFailedRun(plain.out, shown, failure);}
};

interface Artifacts {
  report: string;
  root: string;
}

const observe = async ({ cfg, dir, module }: Fixture): Promise<{ artifacts: Artifacts; cli: ProcessOutput; plain: PlainResult }> => {
  const root = path.join(dir, "out");
  const cli = await runChild(
    process.execPath,
    [path.join(here, "../statechart.ts"), path.join(dir, `${module}.tla`), "--out", root],
    FIXTURE_PROCESS_OPTIONS,
  );
  const plain = await tlc(dir, module, cfg);
  const report = (await fileExists(root)) ? await readFile(path.join(root, "report.md"), "utf8") : "";
  checkExit(cli, plain, report);
  return { artifacts: { report, root }, cli, plain };
};

interface RuleOutcomes {
  bounded: Set<string>;
  breaks: Map<string, number>;
  holds: string[];
  unchecked: string[];
}

const listedRules = (report: string, title: string): string[] =>
  new RegExp(`^## ${title}\\n(?<names>.*)$`, "mu").exec(report)?.groups?.names
    .split(", ").toSorted() ?? [];

interface ReportedBreak {
  file: string | undefined;
  rule: string;
  said: string | undefined;
}

const breakReference = (rule: string, body: string): ReportedBreak => ({
  file: / is in (?<file>tlc-\S+\.out)\./u.exec(body)?.groups?.file,
  rule,
  said: /has (?<steps>\d+) steps?:/u.exec(body)?.groups?.steps,
});

const breakLength = async (root: string, { file, rule, said }: ReportedBreak, bounded: Set<string>): Promise<number> => {
  if (matchesUndefined(file)) {return Number(said);}
  const text = await readFile(path.join(root, file), "utf8");
  const steps = stepsIn(text);
  if (!matchesUndefined(said)) {assert.equal(Number(said), steps, rule);}
  if (/^Semantic processing of module ChartBound$/mu.test(text)) {bounded.add(rule);}
  return steps;
};

const inspectReport = async ({ report, root }: Artifacts): Promise<RuleOutcomes> => {
  const outcomes: RuleOutcomes = { bounded: new Set(), breaks: new Map(), holds: [], unchecked: [] };
  await forEachTlcCase(report.matchAll(/^## (?<rule>\S+) breaks\n(?<body>.*)$/gmu), async ([, rule, body]) => {
    outcomes.breaks.set(rule, await breakLength(root, breakReference(rule, body), outcomes.bounded));
  });
  outcomes.holds = listedRules(report, "Rules that hold");
  outcomes.unchecked = listedRules(report, "Rules not checked");
  return outcomes;
};

const confirmRules = async ({ cfg, dir, module }: Fixture, { bounded, breaks, holds }: RuleOutcomes): Promise<void> => {
  await forEachTlcCase(holds, async (rule) => {
    const read = await tlc(dir, module, alone(cfg, rule));
    assert.equal(read.status, DONE, `${rule} holds in the report, but TLC says:\n${read.out}`);
  });
  await forEachTlcCase(breaks, async ([rule, steps]) => {
    const read = await tlc(dir, module, alone(cfg, rule));
    assert.equal(read.broke, rule, `${rule} breaks in the report, but TLC says:\n${read.out}`);
    if (!bounded.has(rule)) {assert.equal(steps, read.steps, rule);}
  });
};

const compare = async (fixture: Fixture): Promise<Verdict> => {
  const { artifacts, cli, plain } = await observe(fixture);
  const outcomes = await inspectReport(artifacts);
  const { breaks, holds, unchecked } = outcomes;
  const { report } = artifacts;
  const chart = await optionalText(path.join(artifacts.root, "chart.mmd"));
  if (!matchesUndefined(plain.broke)) {assert.equal(breaks.get(plain.broke), plain.steps, `${cli.stderr}${report}`);}
  await confirmRules(fixture, outcomes);
  return { breaks, chart, holds, report, status: cli.status, unchecked };
};

export const agrees = async function agrees(module: string, files: Record<string, string[]>, cfg: string): Promise<Verdict> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "statechart-plain-"));
  try {
    await forEachTlcCase(Object.entries(files), async ([name, lines]) => {
      await writeFile(path.join(dir, `${name}.tla`), `${lines.join("\n")}\n`);
    });
    await writeFile(path.join(dir, `${module}.cfg`), cfg);
    return await compare({ cfg, dir, module });
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
