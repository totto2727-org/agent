// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to wait for the native stream to finish before cleanup.
import { finished } from "node:stream/promises";
import { killGroup } from "./kill.ts";

const FIRST_ARGUMENT = 2;
const [pid, ...dirs] = process.argv.slice(FIRST_ARGUMENT);

const pipe = { input: "" };
process.stdin.setEncoding("utf8").on("data", (chunk: string) => {pipe.input += chunk;});
try {
  await finished(process.stdin);
} catch {
  // Loss of the parent's pipe also calls for cleanup.
}
const running = !pipe.input.includes("exited");
const groupOutlivesWorker = process.platform !== "win32";
if (running || groupOutlivesWorker) {await killGroup(Number(pid));}
// oxlint-disable-next-line rules/no-for-loops -- Remove the stage and temporary directory in the order in which the parent listed them.
for (const dir of dirs) {
  // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for one path to be removed before moving to the next cleanup path.
  await fs.rm(dir, { force: true, recursive: true });
}
