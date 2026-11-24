// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to wait for the native stream to finish before cleanup.
import { finished } from "node:stream/promises";
import { killGroup } from "./kill.ts";
import { visitItems } from "./ir.ts";

const [pid, ...dirs] = process.argv.slice(2);

let input = "";
process.stdin.setEncoding("utf8").on("data", (chunk: string) => (input += chunk));
await finished(process.stdin).catch(() => {});
const running = !input.includes("exited");
const groupOutlivesWorker = process.platform !== "win32";
if (running || groupOutlivesWorker) {await killGroup(Number(pid));}
visitItems(dirs, (dir) => {fs.rmSync(dir, { force: true, recursive: true });});
