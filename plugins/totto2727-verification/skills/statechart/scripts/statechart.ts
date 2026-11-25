#!/usr/bin/env node
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to type the real subprocess status and streams.
import type { ChildProcess } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to parse the CLI's established switches with its native argument parser.
import { parseArgs } from "node:util";
import { killGroup } from "./kill.ts";
import { fileExists, messageOf } from "./run.ts";
import { matchesNull, matchesUndefined, visitItems } from "./ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const USAGE = `Usage: statechart SPEC.tla [--config FILE] [--view FILE] [--out DIR]

Checks SPEC.tla with TLC and draws its state graph as Mermaid. Above 500 states, the chart
draws only the paths to the rules that break, and with no rule broken there is no chart.mmd.
  --config FILE  TLC config. Default: SPEC.cfg beside the spec.
  --view FILE    A module that exports state(vars) and, if you want, step(action, from, to),
                 group(vars), colors, and title. state() returns a string for a flat chart, an
                 array for parent states, or an object for regions. Default: each state's values.
                 colors gives each group blue, orange, purple, yellow, teal, tan, or pink.
  --out DIR      Where to write report.md, chart.mmd, tlc.out, and tlc-RULE.out for each
                 property that breaks and each rule that breaks off the chart. The folder must
                 be new or empty. Default: SPEC-chart.
Exit code: TLC's own on the config as written: 0 when every rule holds, 1 when a rule breaks,
and 2 when TLC stops with an error, a signal kills the check, or the command cannot run. 130 or
143 when SIGINT or SIGTERM stops the check. Only exits 0 and 1 write output.`;

const CHECK_PASSED = 0;
const RULE_BROKEN = 1;
const COMMAND_ERROR = 2;
const SIGNAL_STATUS_OFFSET = 128;
const REQUIRED_POSITIONALS = 1;

const cliError = (message: string, options?: ErrorOptions): Error => (
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone CLI prints native errors across Node, Bun, and Deno.
  new Error(message, options)
);

const printError = (message: string): void => {
  // oxlint-disable-next-line eslint/no-console -- The command reports its native diagnostics on stderr.
  console.error(message);
};

const interruption: { name?: NodeJS.Signals } = {};
const { promise: stopped, resolve: stopWaiting }: PromiseWithResolvers<void> = Promise.withResolvers();
visitItems(["SIGINT", "SIGTERM"] as const, (name) => {
  process.on(name, () => {
    interruption.name ??= name;
    stopWaiting();
  });
});

interface Invocation {
  flags: { config?: string; out?: string; view?: string };
  specFile: string;
}

const invocation = (): Invocation => {
  try {
    const args = parseArgs({
      allowPositionals: true,
      options: { config: { type: "string" }, out: { type: "string" }, view: { type: "string" } },
    });
    if (args.positionals.length !== REQUIRED_POSITIONALS) {throw cliError("Give one SPEC.tla.");}
    const [specFile] = args.positionals;
    return { flags: args.values, specFile };
  } catch (error) {
    printError(`${messageOf(error)}\n\n${USAGE}`);
    return process.exit(COMMAND_ERROR);
  }
};

const { flags, specFile } = invocation();

const codeOf = (error: unknown): unknown =>
  // oxlint-disable-next-line rules/no-instanceof-error -- Inspect the native system errors from Node-compatible filesystem operations.
  error instanceof Error && "code" in error ? error.code : undefined;

const FIRST_ENTRY = 0;

const firstEntry = (entries: string[]): string => entries.toSorted()[FIRST_ENTRY];

const hasDirectoryEntry = async (out: string): Promise<boolean> => {
  try {
    await fs.lstat(out);
    return true;
  } catch (error) {
    if (codeOf(error) === "ENOENT") {return false;}
    throw error;
  }
};

const unresolvedOutput = async (out: string, error: unknown): Promise<string> => {
  if (codeOf(error) !== "ENOENT") {
    throw cliError(`${out} cannot be the output folder. ${messageOf(error)}. Pass --out with a new folder.`, { cause: error });
  }
  if (await hasDirectoryEntry(out)) {
    throw cliError(`${out} cannot be the output folder. It is a broken link. Pass --out with a new folder.`, { cause: error });
  }
  return path.resolve(out);
};

const outputPath = async (out: string): Promise<string> => {
  const observed: { dest?: string; entries: string[] } = { entries: [] };
  try {
    observed.entries = await fs.readdir(out);
    observed.dest = await fs.realpath(out);
  } catch (error) {
    observed.dest = await unresolvedOutput(out, error);
  }
  if (observed.entries.length) {
    throw cliError(`${out} is not empty. It has ${firstEntry(observed.entries)}. The command writes only to a new or empty folder. Pass --out with a new folder.`);
  }
  return observed.dest;
};

const stageFolder = async (dest: string): Promise<string> => {
  const nearest = { dir: path.dirname(dest) };
  // oxlint-disable-next-line eslint/no-await-in-loop -- Resolve the nearest existing ancestor before allocating the stage on the same filesystem.
  while (!(await fileExists(nearest.dir))) {nearest.dir = path.dirname(nearest.dir);}
  return fs.mkdtemp(path.join(nearest.dir, `.${path.basename(dest)}.statechart-`));
};

const runtimeArgs = (): string[] => (process.versions.deno ?? "")
  ? ["run", "--quiet", "--no-prompt", "--allow-read", "--allow-write", "--allow-run", "--allow-env"]
  : process.execArgv;

interface WorkerOptions {
  configFile: string;
  specFile: string;
  stage: string;
  tmp: string;
  view: string;
}

const launchWorker = (runtime: string[], { configFile, specFile: source, stage, tmp, view }: WorkerOptions): ChildProcess =>
  spawn(
    process.execPath,
    [...runtime, path.join(import.meta.dirname, "worker.ts"), stage, source, configFile, ...(view ? [view] : [])],
    {
      detached: true,
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the environment overlay's order when passing it to the worker.
      env: { ...hostEnvironment(), TMPDIR: tmp, TEMP: tmp, TMP: tmp },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

const launchCheck = (options: WorkerOptions): { janitor: ChildProcess; toJanitor: NonNullable<ChildProcess["stdin"]>; worker: ChildProcess } => {
  const runtime = runtimeArgs();
  const worker = launchWorker(runtime, options);
  const janitor = spawn(process.execPath,
    [...runtime, path.join(import.meta.dirname, "janitor.ts"), String(worker.pid), options.stage, options.tmp],
    { detached: true, stdio: ["pipe", "ignore", "ignore"] },
  );
  return { janitor, toJanitor: janitor.stdin, worker };
};

const observeWorker = async (worker: ChildProcess, toJanitor: NonNullable<ChildProcess["stdin"]>): Promise<number> => {
  // oxlint-disable-next-line eslint/no-empty-function -- The janitor can close this pipe during shutdown; attach the native error listener for that race.
  toJanitor.on("error", () => {});
  const { promise: exited, resolve: workerExited } = Promise.withResolvers<number>();
  worker.on("exit", (code) => {
    toJanitor.write("exited\n");
    workerExited(code ?? COMMAND_ERROR);
  });
  await Promise.race([stopped, exited]);
  const running = matchesNull(worker.exitCode) && matchesNull(worker.signalCode);
  const groupOutlivesWorker = process.platform !== "win32";
  if (!matchesUndefined(worker.pid) && (running || groupOutlivesWorker)) {await killGroup(worker.pid);}
  return exited;
};

interface Output {
  dest: string;
  out: string;
  stage: string;
}

const publish = async (completed: string, { dest, out }: Output): Promise<void> => {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.rename(completed, dest);
  } catch (error) {
    if (codeOf(error) !== "ENOTEMPTY" && codeOf(error) !== "EEXIST") {throw error;}
    const appeared = firstEntry(await fs.readdir(dest));
    throw cliError(`${path.join(out, appeared)} appeared while the check ran, so the command wrote nothing. Pass --out with a new folder.`, { cause: error });
  }
  process.stdout.write(await fs.readFile(path.join(dest, "report.md")));
  // oxlint-disable-next-line eslint/no-console -- The command prints the completed output directory on stdout.
  console.log(`\nWrote ${out}`);
};

const interruptedStatus = (workerSignal: NodeJS.Signals | null): number | undefined => {
  const { name: stop } = interruption;
  if (!matchesUndefined(stop)) {
    printError(`${stop} stopped the check, so the command wrote nothing.`);
    return SIGNAL_STATUS_OFFSET + os.constants.signals[stop];
  }
  if (!matchesNull(workerSignal)) {
    printError(`${workerSignal} killed the check, so the command wrote nothing.`);
    return COMMAND_ERROR;
  }
  return undefined;
};

const finishCheck = async (verdict: number, workerSignal: NodeJS.Signals | null, output: Output): Promise<number> => {
  const signalStatus = interruptedStatus(workerSignal);
  if (!matchesUndefined(signalStatus)) {return signalStatus;}
  const completed = path.join(output.stage, "done");
  if ((verdict === CHECK_PASSED || verdict === RULE_BROKEN) && (await fileExists(completed))) {
    await publish(completed, output);
    return verdict;
  }
  return COMMAND_ERROR;
};

interface Cleanup {
  janitor?: ChildProcess;
  tmp?: string;
}

const removeStage = async (stage: string, { janitor, tmp }: Cleanup): Promise<void> => {
  await fs.rm(stage, { force: true, recursive: true });
  if (!matchesUndefined(tmp)) {await fs.rm(tmp, { force: true, recursive: true });}
  janitor?.kill("SIGKILL");
};

const check = async (input: Invocation, configFile: string, output: Output): Promise<number> => {
  const cleanup: Cleanup = {};
  const { stage } = output;
  try {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "statechart-"));
    cleanup.tmp = tmp;
    const { janitor, toJanitor, worker } = launchCheck({ configFile, specFile: input.specFile, stage, tmp, view: input.flags.view ?? "" });
    cleanup.janitor = janitor;
    const verdict = await observeWorker(worker, toJanitor);
    return await finishCheck(verdict, worker.signalCode, output);
  } finally {
    await removeStage(stage, cleanup);
  }
};

try {
  const configFile = flags.config ?? specFile.replace(/\.tla$/u, ".cfg");
  if (!(await fileExists(configFile))) {
    throw cliError(`Cannot find the TLC config ${configFile}. Pass --config FILE.`);
  }
  const out = flags.out ?? specFile.replace(/\.tla$/u, "-chart");
  const dest = await outputPath(out);
  const stage = await stageFolder(dest);
  process.exit(await check({ flags, specFile }, configFile, { dest, out, stage }));
} catch (error) {
  printError(messageOf(error));
  process.exit(COMMAND_ERROR);
}
