// oxlint-disable-next-line rules/no-node-imports -- Read and update only the explicit corpus fixture artifacts.
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Provide independent temporary directories for the native TLC fixtures.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Use native path rules for project folders and subprocess entry points.
import path from "node:path";
import { hostEnvironment } from "#statechart/host-env.ts";
import { matchesUndefined } from "#statechart/ir.ts";
import { fileExists, PINNED_FLAGS, runChild } from "#statechart/run.ts";
import { exitClass, FIXTURE_PROCESS_OPTIONS, forEachTlcCase } from "./tlc.ts";

const directory = import.meta.dirname;
const entry = path.join(directory, "../statechart.ts");
export const corpus = path.join(directory, "corpus");

const SUCCESS = 0;
const GENERATED_SUFFIX = /\.(?:out|exit|dot|mmd|md)$/u;
const REQUIRED_OUTPUT = ["chart.mmd", "report.md"];

export const scratchDirectory = async (): Promise<string> =>
  mkdtemp(path.join(os.tmpdir(), "statechart-corpus-"));

export const read = async (file: string): Promise<string> => readFile(file, "utf8");

interface RunOptions {
  environment?: NodeJS.ProcessEnv;
  output: string;
  spec: string;
  view?: string;
}

export const runCli = async ({ environment = hostEnvironment(), output, spec, view }: RunOptions):
  Promise<Awaited<ReturnType<typeof runChild>>> =>
  runChild(process.execPath, [entry, spec, ...(matchesUndefined(view) ? [] : ["--view", view]), "--out", output], {
    ...FIXTURE_PROCESS_OPTIONS, env: environment,
  });

export const recordTlc = async (folder: string): Promise<{ environment: NodeJS.ProcessEnv; recordings: string }> => {
  const recordings = path.join(folder, "tlc");
  await mkdir(recordings);
  const variables = hostEnvironment();
  return {
    environment: {
      ...variables, JAVA: path.join(directory, "java.ts"), STATECHART_JAVA: variables.JAVA ?? "java", STATECHART_RECORD: recordings,
    },
    recordings,
  };
};

const copyOutputs = async (files: string[], source: string, target: string): Promise<void> =>
  forEachTlcCase(files, async (file) => {await copyFile(path.join(source, file), path.join(target, file));});

export const updateCorpusFixture = async (fixture: string, recordings: string, output: string): Promise<void> => {
  const paths = await readdir(fixture);
  await forEachTlcCase(paths.filter((file) => GENERATED_SUFFIX.test(file)), async (file) => {
    await rm(path.join(fixture, file));
  });
  await copyOutputs(await readdir(recordings), recordings, fixture);
  await copyOutputs(REQUIRED_OUTPUT, output, fixture);
};

export const recordedExit = async (fixture: string): Promise<number> => {
  const file = path.join(fixture, "verdict-1.exit");
  return exitClass(await fileExists(file) ? Number(await read(file)) : SUCCESS);
};

export const writeSpec = async (name: string, tla: Readonly<string[]>, cfg: string): Promise<string> => {
  const base = path.join(await scratchDirectory(), name);
  await writeFile(`${base}.tla`, `${tla.join("\n")}\n`);
  await writeFile(`${base}.cfg`, cfg);
  return base;
};

export const plainTlc = async (base: string): Promise<{ exit: number; path: string[]; rule: string | undefined }> => {
  const name = path.basename(base);
  const environment = hostEnvironment();
  const result = await runChild(environment.JAVA ?? "java", [
    "-cp", String(environment.TLA2TOOLS), "tlc2.TLC", ...PINNED_FLAGS, "-config", `${name}.cfg`, `${name}.tla`,
  ], { ...FIXTURE_PROCESS_OPTIONS, cwd: path.dirname(base) });
  return {
    exit: exitClass(result.status),
    path: [...result.stdout.matchAll(/^State \d+: <(?<step>\w+) line/gmu)].map((match) => match.groups?.step ?? ""),
    rule: /^Error: Invariant (?<rule>\w+) is violated\.$/mu.exec(result.stdout)?.groups?.rule,
  };
};
