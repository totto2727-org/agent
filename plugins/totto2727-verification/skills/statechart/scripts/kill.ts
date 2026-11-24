// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from "node:child_process";

export const killGroup = (pid: number): Promise<void> =>
  new Promise<void>((resolve) => {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" })
        .on("error", () => resolve())
        .on("exit", () => resolve());
      return;
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
    resolve();
  });
