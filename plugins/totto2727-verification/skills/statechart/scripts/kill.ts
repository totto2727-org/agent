// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from "node:child_process";

export const killGroup = async (pid: number): Promise<void> => {
  if (process.platform === "win32") {
    const { promise, resolve }: PromiseWithResolvers<void> = Promise.withResolvers();
    const finish = (): void => {resolve();};
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" })
      .on("error", finish)
      .on("exit", finish);
    return promise;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The group can disappear before cleanup sends the signal.
  }
};
