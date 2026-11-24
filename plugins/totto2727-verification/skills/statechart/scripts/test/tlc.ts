// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Await each host filesystem operation used to set up and remove the real TLC fixture.
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { fileURLToPath } from "node:url";
import { PINNED_FLAGS, runChild } from "#statechart/run.ts";
import { visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const jar = hostEnvironment().TLA2TOOLS;
export const skip = !jar && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";

const FIXTURE_OUTPUT_LIMIT = 1_048_576;
const NATIVE_WINDOW_OPTIONS = { maxBuffer: FIXTURE_OUTPUT_LIMIT, windowsHide: false };

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

export const fixtureExists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

const RULES = /^(INVARIANTS?|PROPERTY|PROPERTIES|CHECK_DEADLOCK)$/u;

const exitClass = (status: number | null) =>
  status === 0 ? 0 : (status === 11 || status === 12 || status === 13 ? 1 : 2);

const stepsIn = (text: string): number =>
  Math.max((text.match(/^State \d+: (?!Stuttering$)/gm)?.length ?? 0) - 1, 0) +
  (text.match(/^Back to state \d+: </gmu)?.length ?? 0);

const properties = function (cfg: string): string[] {
  const names: string[] = [];
  let section = "";
  visitItems(cfg.split("\n"), (line) => {
    section = (/^[A-Z_]+/u.exec(line))?.[0] ?? section;
    if (/^PROPERT(?:Y|IES)$/u.test(section))
      {visitItems(line.trim().split(/\s+/u), (word) => {if (word && word !== section) {names.push(word);}});}
  });
  return names;
};

const tlc = async function (dir: string, module: string, cfg: string) {
  const run = `alone-${(await readdir(dir)).length}`;
  const file = path.join(dir, `${run}.cfg`);
  await writeFile(file, cfg);
  const tmp = path.join(dir, `${run}-tmp`);
  await mkdir(tmp);
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
    { ...NATIVE_WINDOW_OPTIONS, cwd: dir },
  );
  const out = commandResult.stdout + commandResult.stderr;
  const temporal = properties(cfg);
  const broke =
    (/^Error: (?:Invariant|Action property|Property) (\S+) is violated/m.exec(out))?.[1] ??
    (/^Error: Deadlock reached\./mu.test(out) ? "NoDeadlock" : undefined) ??
    (/^Error: Temporal properties were violated\./mu.test(out) && temporal.length === 1
      ? temporal[0]
      : undefined);
  return { status: commandResult.status, out, broke, steps: stepsIn(out) };
};

const alone = function (cfg: string, rule: string): string {
  const lines: string[] = [];
  let section = "";
  visitItems(cfg.split("\n"), (line) => {
    section = (/^[A-Z_]+/u.exec(line))?.[0] ?? section;
    if (!RULES.test(section)) {lines.push(line);}
  });
  if (rule !== "NoDeadlock")
    {lines.push(
      `${properties(cfg).includes(rule) ? "PROPERTY" : "INVARIANT"} ${rule}`,
      "CHECK_DEADLOCK FALSE",
    );}
  return `${lines.join("\n")}\n`;
};

export type Verdict = {
  status: number | null;
  breaks: Map<string, number>;
  holds: string[];
  unchecked: string[];
  chart: string;
  report: string;
};

export const agrees = async function agrees(module: string, files: Record<string, string[]>, cfg: string): Promise<Verdict> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "statechart-plain-"));
  try {
    await forEachTlcCase(Object.entries(files), async ([name, lines]) => {
      await writeFile(path.join(dir, `${name}.tla`), `${lines.join("\n")}\n`);
    });
    await writeFile(path.join(dir, `${module}.cfg`), cfg);
    const out = path.join(dir, "out");
    const cli = await runChild(
      process.execPath,
      [path.join(here, "../statechart.ts"), path.join(dir, `${module}.tla`), "--out", out],
      NATIVE_WINDOW_OPTIONS,
    );
    const plain = await tlc(dir, module, cfg);
    const report = (await fixtureExists(out)) ? await readFile(path.join(out, "report.md"), "utf8") : "";
    const shown = `${cli.stderr}${report}`;
    assert.equal(
      cli.status,
      exitClass(plain.status),
      `TLC says:\n${plain.out}\nThe command says:\n${shown}`,
    );
    assert.doesNotMatch(shown, /Chart\w*Mark/u);
    if (cli.status !== 2) {assert.equal(cli.stderr, "");}
    if (!report) {assert.match(cli.stderr, /TLC could not check/u);}
    if (cli.status === 2) {
      const error = (/^Error: .*$/m.exec(plain.out))?.[0];
      assert.ok(
        error && shown.includes(error),
        `TLC says:\n${plain.out}\nThe command says:\n${shown}`,
      );
    }

    const breaks = new Map<string, number>();
    const bounded = new Set<string>();
    await forEachTlcCase(report.matchAll(/^## (\S+) breaks\n(.*)$/gm), async ([, rule, body]) => {
      const said = (/has (\d+) steps?:/u.exec(body))?.[1];
      const file = (/ is in (tlc-\S+\.out)\./.exec(body))?.[1];
      if (!file) {
        breaks.set(rule, Number(said));
        return;
      }
      const text = await readFile(path.join(out, file), "utf8");
      if (said) {assert.equal(Number(said), stepsIn(text), rule);}
      if (/^Semantic processing of module ChartBound$/mu.test(text)) {bounded.add(rule);}
      breaks.set(rule, stepsIn(text));
    });
    const list = (title: string): string[] =>
      (new RegExp(`^## ${title}\\n(.*)$`, "m").exec(report))?.[1]
        .split(", ")
        .sort() ?? [];
    const holds = list("Rules that hold");
    const unchecked = list("Rules not checked");
    const chartFile = path.join(out, "chart.mmd");
    const chart = (await fixtureExists(chartFile)) ? await readFile(chartFile, "utf8") : "";
    if (plain.broke) {assert.equal(breaks.get(plain.broke), plain.steps, shown);}
    await forEachTlcCase(holds, async (rule) => {
      const r = await tlc(dir, module, alone(cfg, rule));
      assert.equal(r.status, 0, `${rule} holds in the report, but TLC says:\n${r.out}`);
    });
    await forEachTlcCase(breaks, async ([rule, steps]) => {
      const r = await tlc(dir, module, alone(cfg, rule));
      assert.equal(r.broke, rule, `${rule} breaks in the report, but TLC says:\n${r.out}`);
      if (!bounded.has(rule)) {assert.equal(steps, r.steps, rule);}
    });
    return { status: cli.status, breaks, holds, unchecked, chart, report };
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
