#!/usr/bin/env node
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to type the real subprocess status and streams.
import type { ChildProcess } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to parse the CLI's established switches with its native argument parser.
import { parseArgs } from "node:util";
import { killGroup } from "./kill.ts";
import { messageOf } from "./run.ts";
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

try {
  const configFile = flags.config ?? specFile.replace(/\.tla$/u, ".cfg");
  if (!fs.existsSync(configFile))
    {throw cliError(`Cannot find the TLC config ${configFile}. Pass --config FILE.`);}
  const out = flags.out ?? specFile.replace(/\.tla$/u, "-chart");
  let entries: string[] = [];
  let dest: string;
  try {
    entries = fs.readdirSync(out);
    dest = fs.realpathSync(out);
  } catch (error) {
    if (codeOf(error) !== "ENOENT")
      {throw cliError(
        `${out} cannot be the output folder. ${messageOf(error)}. Pass --out with a new folder.`,
        { cause: error },
      );}
    if (fs.lstatSync(out, { throwIfNoEntry: false }))
      {throw cliError(
        `${out} cannot be the output folder. It is a broken link. Pass --out with a new folder.`,
        { cause: error },
      );}
    dest = path.resolve(out);
  }
  if (entries.length)
    {throw cliError(
      `${out} is not empty. It has ${entries.sort()[0]}. The command writes only to a new or empty folder. Pass --out with a new folder.`,
    );}

  let base = path.dirname(dest);
  while (!fs.existsSync(base)) {base = path.dirname(base);}
  const stage = fs.mkdtempSync(path.join(base, `.${path.basename(dest)}.statechart-`));
  const done = path.join(stage, "done");
  const cleanup: { janitor?: ChildProcess; tmp?: string } = {};
  let exitCode: number;
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-"));
    cleanup.tmp = tmp;
    const view = flags.view ?? "";
    const runtime = process.versions.deno
      ? [
          "run",
          "--quiet",
          "--no-prompt",
          "--allow-read",
          "--allow-write",
          "--allow-run",
          "--allow-env",
        ]
      : process.execArgv;
    const worker = spawn(
      process.execPath,
      [
        ...runtime,
        path.join(import.meta.dirname, "worker.ts"),
        stage,
        specFile,
        configFile,
        ...(view ? [view] : []),
      ],
      {
        detached: true,
        stdio: ["ignore", "inherit", "inherit"],
        env: { ...hostEnvironment(), TMPDIR: tmp, TEMP: tmp, TMP: tmp },
      },
    );
    const janitor = spawn(
      process.execPath,
      [...runtime, path.join(import.meta.dirname, "janitor.ts"), String(worker.pid), stage, tmp],
      { detached: true, stdio: ["pipe", "ignore", "ignore"] },
    );
    cleanup.janitor = janitor;
    const toJanitor = janitor.stdin;
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
    const verdict = await exited;
    const { name: stop } = interruption;
    const killedBy = worker.signalCode ?? "";
    if (!matchesUndefined(stop)) {
      printError(`${stop} stopped the check, so the command wrote nothing.`);
      exitCode = SIGNAL_STATUS_OFFSET + os.constants.signals[stop];
    } else if (killedBy) {
      printError(`${killedBy} killed the check, so the command wrote nothing.`);
      exitCode = COMMAND_ERROR;
    } else if ((verdict === CHECK_PASSED || verdict === RULE_BROKEN) && fs.existsSync(done)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        fs.renameSync(done, dest);
      } catch (error) {
        if (codeOf(error) !== "ENOTEMPTY" && codeOf(error) !== "EEXIST") {throw error;}
        throw cliError(
          `${path.join(out, fs.readdirSync(dest).sort()[0])} appeared while the check ran, so the command wrote nothing. Pass --out with a new folder.`,
          { cause: error },
        );
      }
      process.stdout.write(fs.readFileSync(path.join(dest, "report.md")));
      // oxlint-disable-next-line eslint/no-console -- The command prints the completed output directory on stdout.
      console.log(`\nWrote ${out}`);
      exitCode = verdict;
    } else {exitCode = COMMAND_ERROR;}
  } finally {
    fs.rmSync(stage, { force: true, recursive: true });
    if (!matchesUndefined(cleanup.tmp)) {fs.rmSync(cleanup.tmp, { force: true, recursive: true });}
    cleanup.janitor?.kill("SIGKILL");
  }
  process.exit(exitCode);
} catch (error) {
  printError(messageOf(error));
  process.exit(COMMAND_ERROR);
}
