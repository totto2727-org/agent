// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to await the actual child and stream events.
import { once } from "node:events";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { mkdtemp, readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to await the host timer used by the polling or subprocess fixture.
import { setTimeout as sleep } from "node:timers/promises";
import { isRecord } from "#statechart/ir.ts";
import { fileExists } from "#statechart/run.ts";
import { INDEX_STEP, SIGNAL_STATUS_OFFSET, startCommand } from "./cli-fixtures.ts";

const PROCESS_EXISTS_SIGNAL = 0;
const CLEANUP_ATTEMPTS = 250;
const CLEANUP_POLL_MILLISECONDS = 20;

interface SignalDirectories {
  fakes: string;
  parent: string;
  tmpdir: string;
}

export const makeSignalDirectories = async (): Promise<SignalDirectories> => ({
  fakes: await mkdtemp(path.join(os.tmpdir(), "statechart-fakes-")),
  parent: await mkdtemp(path.join(os.tmpdir(), "statechart-parent-")),
  tmpdir: await mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-")),
});

interface SignalPhase {
  dir: string;
  reached: (parent: string) => boolean | Promise<boolean>;
}

const waitForPhase = async (parent: string, reached: SignalPhase["reached"]): Promise<void> => {
  const signalTimeoutMilliseconds = 60_000;
  const end = performance.now() + signalTimeoutMilliseconds;
  // oxlint-disable-next-line eslint/no-await-in-loop -- Observe one subprocess phase at a time before signalling it.
  while (!(await reached(parent))) {
    assert.ok(performance.now() < end, "The command did not reach the phase.");
  }
};

interface ChildOutput {
  captured: { stderr: string };
  closed: Promise<unknown[]>;
}

export const observeChild = (child: Awaited<ReturnType<typeof startCommand>>): ChildOutput => {
  const captured = { stderr: "" };
  child.stderr.on("data", (chunk: Buffer) => { captured.stderr += chunk.toString("utf8"); });
  const closed: Promise<unknown[]> = once(child, "close");
  return { captured, closed };
};

const assertSignalOutput = async (signal: NodeJS.Signals, { captured, closed }: ChildOutput, directories: SignalDirectories): Promise<void> => {
  const [status] = await closed;
  assert.equal(captured.stderr, `${signal} stopped the check, so the command wrote nothing.\n`);
  assert.equal(status, SIGNAL_STATUS_OFFSET + os.constants.signals[signal]);
  assert.deepEqual(await readdir(directories.parent), []);
  assert.deepEqual(await readdir(directories.tmpdir), []);
};

export const signalWhile = async function <T extends SignalPhase>(
  signal: NodeJS.Signals,
  setup: (fakes: string) => (T & { java?: string }) | Promise<T & { java?: string }>,
): Promise<T & { java?: string }> {
  const directories = await makeSignalDirectories();
  const phase = await setup(directories.fakes);
  const child = await startCommand(phase.dir, directories.parent, { java: phase.java, tmpdir: directories.tmpdir });
  const output = observeChild(child);
  await waitForPhase(directories.parent, phase.reached);
  child.kill(signal);
  await assertSignalOutput(signal, output, directories);
  return phase;
};

const processState = (pid: number): "gone" | "reaping" | "running" => {
  try {
    process.kill(pid, PROCESS_EXISTS_SIGNAL);
    return "running";
  } catch (error) {
    // oxlint-disable-next-line rules/no-error-property-access -- Node kill reports the native error code and the record check narrows the caught value.
    const code = isRecord(error) ? error.code : undefined;
    // The macOS kernel reports EPERM for a process group containing only zombies until they are reaped.
    if (code === "EPERM") {return "reaping";}
    assert.equal(code, "ESRCH");
    return "gone";
  }
};

export const assertGone = async (pid: number, attempts = CLEANUP_ATTEMPTS): Promise<void> => {
  const state = processState(pid);
  if (state === "gone") {return;}
  const noAttempts = 0;
  const detail = state === "reaping" ? "exited, but it was not reaped" : "is still running";
  assert.ok(attempts > noAttempts, `Process ${pid} ${detail}.`);
  await sleep(CLEANUP_POLL_MILLISECONDS);
  await assertGone(pid, attempts - INDEX_STEP);
};

const PID_MARKER_TIMEOUT = 30_000;
export const waitForPidMarker = async (file: string, deadline = performance.now() + PID_MARKER_TIMEOUT): Promise<string> => {
  const text = await fileExists(file) ? await readFile(file, "utf8") : "";
  if (text) {return text;}
  assert.ok(performance.now() < deadline, `The process did not write its PID to ${file}.`);
  await sleep(CLEANUP_POLL_MILLISECONDS);
  return waitForPidMarker(file, deadline);
};

const checkCleanedDirectory = async (dir: string, attempts: number): Promise<string[]> => {
  const none = 0;
  const files = await readdir(dir);
  if (files.length === none || attempts === none) {
    return files;
  }
  await sleep(CLEANUP_POLL_MILLISECONDS);
  return checkCleanedDirectory(dir, attempts - INDEX_STEP);
};

export const assertEmpty = async function (dir: string): Promise<void> {
  const remaining = await checkCleanedDirectory(dir, CLEANUP_ATTEMPTS);
  assert.deepEqual(remaining, []);
};

export const killOnMarker = async (child: Awaited<ReturnType<typeof startCommand>>, marker: string): Promise<number> => {
  const exited = once(child, "exit");
  const pid = await waitForPidMarker(marker);
  child.kill("SIGKILL");
  await exited;
  return Number(pid);
};
