// oxlint-disable-next-line rules/no-node-imports -- Stage each standalone TLC process in the native filesystem.
import { mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve native executable, configuration and artifact paths.
import path from "node:path";
import { configText } from "./backends/cfg.ts";
import { hostEnvironment } from "#statechart/host-env.ts";
import type { ConfigSection } from "./ir.ts";
import { CHILD_SUCCESS, runChild, runToFiles } from "./native-process.ts";
import type { ChildResult, FileResult } from "./native-process.ts";

const TLC_TOOL =
  "http:tla2tools[url=https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar,checksum=sha256:936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88]@1.7.4";
const JAVA_TOOL = "java@temurin-25";

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

interface ToolRunner {
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
