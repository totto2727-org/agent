// oxlint-disable-next-line rules/no-node-imports -- Write and clean the temporary plain-TLC and compiler fixtures.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Isolate each generated case in a native temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the native fixture and its independent TLC directories.
import path from "node:path";
import { hostEnvironment } from "#statechart/host-env.ts";
import { matchesNull, matchesUndefined, visitItems } from "#statechart/ir.ts";
import { runChild } from "#statechart/run.ts";
import { configOf } from "./differential-case.ts";
import type { Case } from "./differential-case.ts";
import { forEachTlcCase } from "./tlc.ts";

interface Claim { breaks: boolean; steps?: number }
interface Fixture { fixture: Case; folder: string }
interface PlainRun { checks: string[]; name: string }
interface RuleRun extends PlainRun {
  breaks: number[];
  rule: string;
  traced: boolean;
}

const SUCCESS = 0;
const FOUND_VIOLATION = 1;
const SKIPPED_CHART = 2;
const TLC_DEADLOCK = 11;
const TLC_SAFETY = 12;
const TLC_LIVENESS = 13;
const FIRST_STATE = 1;
const NEXT_LINE = 1;
const EMPTY_TEXT = 0;
const DISABLE_DEADLOCK = "CHECK_DEADLOCK FALSE";
const entry = path.join(import.meta.dirname, "../statechart.ts");

type Run = Awaited<ReturnType<typeof runChild>>;
interface Summary { rules: Map<string, Claim>; states: number | string; status: number | null }

const run = async (command: string, args: string[], cwd: string): Promise<Run> => {
  const result = await runChild(command, args, {
    cwd, env: { ...hostEnvironment(), LC_ALL: "C.UTF-8" }, maxBuffer: Number.POSITIVE_INFINITY, windowsHide: false,
  });
  if (result.error) {
    // oxlint-disable-next-line typescript/only-throw-error -- Re-throw the existing native subprocess error without replacing its code or message.
    throw result.error;
  }
  return result;
};

const plainTlc = async ({ fixture, folder }: Fixture, { checks, name }: PlainRun): Promise<Run> => {
  const config = `${name}.cfg`;
  await writeFile(path.join(folder, config), `${[...fixture.base, ...checks].join("\n")}\n`);
  const scratch = path.join(folder, `tmp-${name}`);
  await mkdir(scratch);
  const { JAVA: java, TLA2TOOLS: jar } = hostEnvironment();
  const command = matchesUndefined(java) || java.length === EMPTY_TEXT ? "java" : java;
  return run(command, [
    `-Djava.io.tmpdir=${scratch}`, "-cp", String(jar), "tlc2.TLC", "-tool",
    "-workers", "1", "-config", config, "-metadir", path.join(folder, `meta-${name}`), fixture.module,
  ], folder);
};

const plainFailure = ({ status, stderr, stdout }: Run): Error =>
  // oxlint-disable-next-line rules/require-tagged-error -- Include the real TLC output in the native fixture failure.
  new Error(`plain TLC exited ${status}:\n${stdout}${stderr}`);

const claimOf = (result: Run, { breaks, traced }: RuleRun): Claim => {
  if (result.status === SUCCESS) {return { breaks: false };}
  if (matchesNull(result.status) || !breaks.includes(result.status)) {throw plainFailure(result);}
  if (!traced) {return { breaks: true };}
  const states = result.stdout.split("@!@!@STARTMSG 2217:").length - FIRST_STATE;
  return { breaks: true, steps: Math.max(states, FIRST_STATE) - FIRST_STATE };
};

const plainRules = ({ deadlock, invariants, property }: Case): RuleRun[] => {
  const runs = invariants.map((rule) => ({
    breaks: [TLC_SAFETY], checks: [`INVARIANT ${rule}`, DISABLE_DEADLOCK], name: `inv-${rule}`, rule, traced: true,
  }));
  if (deadlock) {
    runs.push({ breaks: [TLC_DEADLOCK], checks: [], name: "deadlock", rule: "NoDeadlock", traced: true });
  }
  if (!matchesUndefined(property) && property.length > EMPTY_TEXT) {
    runs.push({
      breaks: [TLC_SAFETY, TLC_LIVENESS], checks: [`PROPERTY ${property}`, DISABLE_DEADLOCK],
      name: "property", rule: property, traced: false,
    });
  }
  return runs;
};

const plainAnswers = async (location: Fixture): Promise<Summary> => {
  const rules = new Map<string, Claim>();
  await forEachTlcCase(plainRules(location.fixture), async (rule) => {
    const result = await plainTlc(location, rule);
    rules.set(rule.rule, claimOf(result, rule));
  });
  const result = await plainTlc(location, { checks: [DISABLE_DEADLOCK], name: "states" });
  const distinct = /(?<count>[\d,]+) distinct states found/u.exec(result.stdout)?.groups?.count;
  if (result.status !== SUCCESS || matchesUndefined(distinct)) {throw plainFailure(result);}
  const states = Number(distinct.replaceAll(",", ""));
  const broke = Iterator.from(rules.values()).some((rule) => rule.breaks);
  return { rules, states, status: broke ? FOUND_VIOLATION : SUCCESS };
};

const compilerRules = (lines: string[], fixture: Case): Map<string, Claim> => {
  const rules = new Map<string, Claim>();
  visitItems(lines.entries(), ([index, line]) => {
    const broken = /^## (?<rule>\S+) breaks$/u.exec(line)?.groups?.rule;
    const next = lines[index + NEXT_LINE];
    if (!matchesUndefined(broken)) {
      const shortest = /^The shortest path has (?<steps>\d+) steps?:$/u.exec(next)?.groups?.steps;
      rules.set(broken, broken === fixture.property ? { breaks: true } : { breaks: true, steps: Number(shortest) });
    }
    if (line === "## Rules that hold") {
      visitItems(next.split(", "), (name) => {rules.set(name, { breaks: false });});
    }
  });
  return rules;
};

const compilerAnswers = (result: Run, fixture: Case): Summary => {
  const states = /^TLC reached (?<states>\d+) states/mu.exec(result.stdout)?.groups?.states;
  return {
    rules: compilerRules(result.stdout.split("\n"), fixture),
    states: matchesUndefined(states) ? result.stderr : Number(states),
    status: result.status,
  };
};

const compile = async ({ fixture, folder }: Fixture, view: string[]): Promise<Run> =>
  run(process.execPath, [entry, `${fixture.module}.tla`, ...view, "--out", "out"], folder);

const writeFixture = async ({ fixture, folder }: Fixture): Promise<void> => {
  await writeFile(path.join(folder, `${fixture.module}.tla`), fixture.tla);
  await writeFile(path.join(folder, `${fixture.module}.cfg`), configOf(fixture));
  if (!matchesUndefined(fixture.view)) {await writeFile(path.join(folder, "view.mjs"), fixture.view);}
};

const compare = async (location: Fixture): Promise<{ stdout: string; compiled: Summary; plain: Summary }> => {
  const { fixture } = location;
  const hasView = !matchesUndefined(fixture.view);
  const viewed = await compile(location, hasView ? ["--view", "view.mjs"] : []);
  const plain = await plainAnswers(location);
  const refused = hasView && viewed.status === SKIPPED_CHART && /^(?:The view's |The chart draws the step )/u.test(viewed.stderr);
  const compiled = refused ? await compile(location, []) : viewed;
  return { compiled: compilerAnswers(compiled, fixture), plain, stdout: compiled.stdout };
};

export const compareFixture = async (fixture: Case): Promise<Awaited<ReturnType<typeof compare>>> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "statechart-differential-"));
  const location = { fixture, folder };
  try {
    await writeFixture(location);
    return await compare(location);
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
};
