// oxlint-disable-next-line rules/no-node-imports -- Start the observed native CLI child process.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Keep the real Node child process and its stdin and output pipe types.
import type { ChildProcessByStdio } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Node streams are the pipe types of the observed CLI child.
import type { Readable } from "node:stream";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { copyFile, cp, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
import { visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";
import { fileExists, runChild } from "#statechart/run.ts";
import { FIXTURE_PROCESS_OPTIONS, forEachTlcCase } from "./tlc.ts";

export const here = import.meta.dirname;
export const corpus = path.join(here, "corpus");
export const read = async (file: string): Promise<string> => readFile(file, "utf8");

// The public exit values are independent of the implementation under test.
export const CHECK_PASSED = 0;
export const RULE_BROKEN = 1;
export const COMMAND_ERROR = 2;
export const NO_COMPATIBLE_RUNTIME = 127;
export const SIGNAL_STATUS_OFFSET = 128;
const FIRST_CHARACTER = 0;
export const INDEX_STEP = 1;

// The native exit values recorded by the TLC 1.7.4 fixtures.
export const TLC_PASSED = 0;
const TLC_DEADLOCK = 11;
const TLC_SAFETY_VIOLATION = 12;
const TLC_LIVENESS_VIOLATION = 13;
const TLC_VIOLATIONS = new Set<number>([TLC_DEADLOCK, TLC_SAFETY_VIOLATION, TLC_LIVENESS_VIOLATION]);
export const replayStatus = (tlcExit: number): number => {
  if (tlcExit === TLC_PASSED) {return CHECK_PASSED;}
  return TLC_VIOLATIONS.has(tlcExit) ? RULE_BROKEN : COMMAND_ERROR;
};

interface ReplayResult extends Awaited<ReturnType<typeof runChild>> {
  configs: Record<string, string>;
  files: string[];
  out: string;
  report: string;
}

const readConfigurations = async (file: string): Promise<Record<string, string>> => {
  const configs: Record<string, string> = {};
  if (!(await fileExists(file))) {return configs;}
  const log = await readFile(file, "utf8");
  visitItems(log.split(/^## /mu), (part) => {if (part) {configs[part.slice(FIRST_CHARACTER, part.indexOf("\n"))] = part;}});
  return configs;
};

interface FixtureEnvironment {
  dir: string;
  env: NodeJS.ProcessEnv;
  java: string;
  log: string;
}

const fixtureEnvironment = ({ dir, env, java, log }: FixtureEnvironment): NodeJS.ProcessEnv => ({
  ...hostEnvironment(),
  JAVA: java,
  STATECHART_LOG: log,
  STATECHART_REPLAY: dir,
  TLA2TOOLS: "tla2tools.jar",
  ...env,
});

export const run = async function (
  dir: string,
  {
    args = [],
    view = path.join(dir, "view.mjs"),
    java = path.join(here, "java.ts"),
    command = [process.execPath, path.join(here, "../statechart.ts")],
    env = {},
  }: {
    args?: string[];
    view?: string;
    java?: string;
    command?: string[];
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ReplayResult> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "statechart-cli-"));
  const out = path.join(tmp, "out");
  const log = path.join(tmp, "configs.log");
  const name = path.basename(dir);
  const [file, ...entry] = command;
  const commandResult = await runChild(
    file,
    [
      ...entry,
      path.join(dir, `${name}.tla`),
      ...((await fileExists(view)) ? ["--view", view] : []),
      "--out",
      out,
      ...args,
    ],
    {
      ...FIXTURE_PROCESS_OPTIONS,
      env: fixtureEnvironment({ dir, env, java, log }),
    },
  );
  const configs = await readConfigurations(log);
  const files = (await fileExists(out)) ? await readdir(out) : [];
  return {
    ...commandResult,
    configs,
    files: files.toSorted(),
    out,
    report: files.includes("report.md") ? await readFile(path.join(out, "report.md"), "utf8") : "",
  };
};

export const copyCase = async function (name: string, edit: (dir: string) => Promise<void>): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), "statechart-case-"));
  const dir = path.join(parent, name);
  await cp(path.join(corpus, name), dir, { recursive: true });
  await edit(dir);
  return dir;
};

export const writeView = async (body: string): Promise<string> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "statechart-view-"));
  const view = path.join(folder, "view.mjs");
  await writeFile(view, body);
  return view;
};

export const startCommand = async function (
  dir: string,
  parent: string,
  {
    java = path.join(here, "java.ts"),
    tmpdir,
  }: { java?: string; tmpdir: string },
): Promise<ChildProcessByStdio<null, Readable, Readable>> {
  const name = path.basename(dir);
  const view = path.join(dir, "view.mjs");
  const hasView = await fileExists(view);
  return spawn(
    process.execPath,
    [
      path.join(here, "../statechart.ts"),
      path.join(dir, `${name}.tla`),
      ...(hasView ? ["--view", view] : []),
      "--out",
      path.join(parent, "out"),
    ],
    {
      env: {
        ...hostEnvironment(),
        JAVA: java,
        STATECHART_REPLAY: dir,
        TLA2TOOLS: "tla2tools.jar",
        TMPDIR: tmpdir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
};

const gridDot = (dimension: number): string => {
  const firstGridStateId = 1_000_000;
  const gridStride = 1;
  const id = (column: number, row: number): string => String(firstGridStateId + column * dimension + row);
  const lines = ["strict digraph DiskGraph {"];
  const coordinates = Array.from({ length: dimension }, (_value, index) => index);
  visitItems(coordinates, (column) => {
    visitItems(coordinates, (row) => {
      lines.push(
        `${id(column, row)} [label="/\\\\ x = ${column}\\n/\\\\ y = ${row}"${column + row ? "" : ",style = filled"}]`,
      );
      if (column + gridStride < dimension) {lines.push(`${id(column, row)} -> ${id(column + gridStride, row)} [label="IncX"];`);}
      if (row + gridStride < dimension) {lines.push(`${id(column, row)} -> ${id(column, row + gridStride)} [label="IncY"];`);}
    });
  });
  return [...lines, "}"].join("\n");
};

export const gridCase = async function (dimension: number): Promise<string> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "statechart-case-"));
  const dir = path.join(temporary, "Grid");
  await cp(path.join(here, "grid"), dir, { recursive: true });
  await forEachTlcCase(["ChartRun.out", "verdict-1.out"], async (fixtureFile) => {
    await copyFile(path.join(corpus, "Login", fixtureFile), path.join(dir, fixtureFile));
  });
  await writeFile(path.join(dir, "graph.dot"), gridDot(dimension));
  return dir;
};

export const sleepyJava = async function (fakes: string): Promise<{ java: string; pidFile: string }> {
  const java = path.join(fakes, "java.mjs");
  const pidFile = path.join(fakes, "java.pid");
  await writeFile(
    java,
    `#!/usr/bin/env node\nimport fs from "node:fs";\n` +
      `process.on("SIGTERM", () => {});\n` +
      `fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
      `setTimeout(() => {}, 60_000);\n`,
    { mode: 0o755 },
  );
  return { java, pidFile };
};

export const parentPid = async (pid: string): Promise<number> => {
  const result = await runChild("ps", ["-o", "ppid=", "-p", pid], FIXTURE_PROCESS_OPTIONS);
  return Number(result.stdout);
};
