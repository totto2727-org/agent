// oxlint-disable-next-line rules/no-node-imports -- Compare the actual standalone Statechart process and its JVM children.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Wait for the native child and its stderr stream to close.
import { once } from "node:events";
// oxlint-disable-next-line rules/no-node-imports -- Await fixture I/O through the native Node filesystem.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Use the host's isolated temporary directory for captured reports.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Native loaders expect paths in the host platform's format.
import path from "node:path";
import { hostEnvironment } from "#statechart/host-env.ts";
import { fileExists } from "#statechart/run.ts";

const here = import.meta.dirname;
export const corpus = path.join(here, "corpus");

export interface TwinFolders {
  out: string;
  tool: string;
  twin: string;
}

const foldersFor = async (): Promise<TwinFolders> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "statechart-plain-"));
  const tool = path.join(root, "tool");
  const twin = path.join(root, "plain");
  await fs.mkdir(tool);
  await fs.mkdir(twin);
  return { out: path.join(root, "out"), tool, twin };
};

const launchTwin = async (name: string, { out, tool, twin }: TwinFolders): Promise<string> => {
  const dir = path.join(corpus, name);
  const view = path.join(dir, "view.mjs");
  const extra = (await fileExists(view)) ? ["--view", view] : [];
  const child = spawn(
    process.execPath,
    [path.join(here, "../statechart.ts"), path.join(dir, `${name}.tla`), ...extra, "--out", out],
    {
      env: {
        ...hostEnvironment(),
        JAVA: path.join(here, "java.ts"),
        STATECHART_JAVA: hostEnvironment().JAVA ?? "java",
        STATECHART_PLAIN: twin,
        STATECHART_RECORD: tool,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  const stderr: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {stderr.push(chunk.toString());});
  await once(child, "close");
  return stderr.join("");
};

export const readPlainAndTool = async (name: string): Promise<{ folders: TwinFolders; stderr: string }> => {
  const folders = await foldersFor();
  const stderr = await launchTwin(name, folders);
  return { folders, stderr };
};
