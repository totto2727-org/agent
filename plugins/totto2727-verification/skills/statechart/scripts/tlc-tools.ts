// oxlint-disable-next-line rules/no-node-imports -- Generate a native marker that separates this drawing from any specification records.
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Stage each standalone TLC process in the native filesystem.
import { mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve native executable, configuration and artifact paths.
import path from "node:path";
import { chartRun, configText } from "./backends/cfg.ts";
import { hostEnvironment } from "#statechart/host-env.ts";
import { CHART_STATES } from "./ir.ts";
import type { ConfigSection, Spec } from "./ir.ts";
import { CHILD_SUCCESS, fileExists, runChild, runToFiles } from "./native-process.ts";
import type { ChildResult, FileResult } from "./native-process.ts";
import { checkFailure, distinctStates } from "./tlc-output.ts";

const TLC_TOOL =
  "http:tla2tools[url=https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar,checksum=sha256:936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88]@1.7.4";
const JAVA_TOOL = "java@temurin-25";

export const PINNED_FLAGS = ["-workers", "1", "-fp", "0", "-lncheck", "final"];

interface TlcTools {
  jar: string;
  java: string;
}

type MiseTools = [jar: ChildResult, java: ChildResult];

const runMise = async (cwd: string, args: string[]): Promise<ChildResult> =>
  runChild("mise", args, { cwd, env: { ...hostEnvironment(), MISE_CEILING_PATHS: cwd } });

const findInstalled = async (cwd: string): Promise<MiseTools> =>
  Promise.all([runMise(cwd, ["where", TLC_TOOL]), runMise(cwd, ["which", "java", "--tool", JAVA_TOOL])]);

const findWithMise = async (cwd: string): Promise<MiseTools> => {
  const found = await findInstalled(cwd);
  if (found.every((tool) => tool.status === CHILD_SUCCESS)) {return found;}
  const installed = await runMise(cwd, ["install", JAVA_TOOL, TLC_TOOL]);
  if (installed.status !== CHILD_SUCCESS) {
    // oxlint-disable-next-line rules/require-tagged-error -- Report the native toolchain failure in the standalone CLI without loading a runtime package.
    throw new Error(
      `Cannot find TLC: mise install failed: ${installed.error?.message ?? installed.stderr.trim()}\nOr set TLA2TOOLS to the path of tla2tools.jar, and JAVA to a java binary (Java 11 or later).`,
    );
  }
  return findInstalled(cwd);
};

const hasEnvValue = (value: string): boolean => Boolean(value.length);

const findTlc = async (cwd: string): Promise<TlcTools> => {
  const { TLA2TOOLS = "", JAVA = "" } = hostEnvironment();
  if (hasEnvValue(TLA2TOOLS)) {return { jar: TLA2TOOLS, java: hasEnvValue(JAVA) ? JAVA : "java" };}
  const [jar, java] = await findWithMise(cwd);
  return {
    jar: path.join(jar.stdout.trim(), "tla2tools.jar"),
    java: hasEnvValue(JAVA) ? JAVA : java.stdout.trim(),
  };
};

interface JavaCommand {
  args: string[];
  main: string;
  name: string;
  vmOptions?: string[];
}

export interface ToolRunner {
  config: (name: string, sections: ConfigSection[], extra: string[]) => Promise<string[]>;
  runJava: (command: JavaCommand) => Promise<FileResult>;
}

export const prepareTools = async (dir: string, folder: string): Promise<ToolRunner> => {
  const tlc = await findTlc(dir);
  const config = async (name: string, sections: ConfigSection[], extra: string[]): Promise<string[]> => {
    const file = path.join(dir, `${name}.cfg`);
    await writeFile(file, configText(sections, extra));
    return ["-metadir", path.join(dir, `meta-${name}`), "-config", file];
  };
  const runJava = async ({ args, main, name, vmOptions = [] }: JavaCommand): Promise<FileResult> => {
    const tmp = path.join(dir, `tmp-${name}`);
    await mkdir(tmp);
    return runToFiles(
      tlc.java,
      [
        `-Djava.io.tmpdir=${tmp}`,
        `-DTLA-Library=${folder}`,
        "-Dstdout.encoding=UTF-8",
        "-Dstderr.encoding=UTF-8",
        ...vmOptions,
        "-cp",
        tlc.jar,
        main,
        ...args,
      ],
      {
        cwd: dir,
        env: process.platform === "darwin" ? hostEnvironment() : { ...hostEnvironment(), LC_ALL: "C.UTF-8" },
        out: path.join(dir, name),
      },
    );
  };
  return { config, runJava };
};

const CHART_TAG_BYTES = 16;

export interface TlcDrawing {
  file: string;
  result: FileResult;
  tag: string;
}

const drawChart = async (dir: string, spec: Spec, { config, runJava }: ToolRunner): Promise<TlcDrawing> => {
  const tag = `chart-${randomBytes(CHART_TAG_BYTES).toString("hex")}`;
  await writeFile(path.join(dir, "ChartRun.tla"), chartRun(spec, tag));
  const result = await runJava({
    args: [
      "-tool",
      ...PINNED_FLAGS,
      "-deadlock",
      ...(await config("ChartRun", spec.written, ["INVARIANT ChartMark", "CONSTRAINT ChartBudget"])),
      "-dump",
      "dot,actionlabels",
      path.join(dir, "graph"),
      "ChartRun",
    ],
    main: "tlc2.TLC",
    name: "ChartRun",
  });
  return { file: path.join(dir, "graph.dot"), result, tag };
};

export const drawWithinBudget = async (
  { dir, specFile }: { dir: string; specFile: string },
  spec: Spec,
  tools: ToolRunner,
): Promise<TlcDrawing | undefined> => {
  const drawing = await drawChart(dir, spec, tools);
  if (!(await fileExists(drawing.file))) {throw checkFailure(specFile, drawing.result);}
  return distinctStates(drawing.result.output) <= CHART_STATES ? drawing : undefined;
};
