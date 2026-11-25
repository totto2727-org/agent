// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Keep the Node child process with its stdout and stderr pipe types.
import type { ChildProcessByStdio } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to await the actual child and stream events.
import { once } from "node:events";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { mkdtemp, readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Node streams are the pipe types of the subprocess used by these tests.
import type { Readable } from "node:stream";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to await the host timer used by the polling or subprocess fixture.
import { setTimeout as sleep } from "node:timers/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { pathToFileURL } from "node:url";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { drawn } from "./drawn.ts";
import { isRecord, matchesUndefined, visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";
import { fileExists, runChild } from "#statechart/run.ts";
import { FIXTURE_PROCESS_OPTIONS, forEachTlcCase } from "./tlc.ts";

const here = import.meta.dirname;
const corpus = path.join(here, "corpus");
const read = (file: string): string => fs.readFileSync(file, "utf8");

// The public exit values are independent of the implementation under test.
const CHECK_PASSED = 0;
const RULE_BROKEN = 1;
const COMMAND_ERROR = 2;
const NO_COMPATIBLE_RUNTIME = 127;
const SIGNAL_STATUS_OFFSET = 128;
const FIRST_CHARACTER = 0;
const INDEX_STEP = 1;
const PROCESS_EXISTS_SIGNAL = 0;
const CLEANUP_ATTEMPTS = 250;
const CLEANUP_POLL_MILLISECONDS = 20;
const SIGNAL_OUTPUT_GRID_WIDTH = 150;

// The native exit values recorded by the TLC 1.7.4 fixtures.
const TLC_PASSED = 0;
const TLC_DEADLOCK = 11;
const TLC_SAFETY_VIOLATION = 12;
const TLC_LIVENESS_VIOLATION = 13;
const TLC_VIOLATIONS = new Set<number>([TLC_DEADLOCK, TLC_SAFETY_VIOLATION, TLC_LIVENESS_VIOLATION]);
const replayStatus = (tlcExit: number): number => {
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

const run = async function (
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
      env: {
        ...hostEnvironment(),
        JAVA: java,
        STATECHART_LOG: log,
        STATECHART_REPLAY: dir,
        TLA2TOOLS: "tla2tools.jar",
        ...env,
      },
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

const copyCase = async function (name: string, edit: (dir: string) => Promise<void>): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), "statechart-case-"));
  const dir = path.join(parent, name);
  await fs.promises.cp(path.join(corpus, name), dir, { recursive: true });
  await edit(dir);
  return dir;
};

const writeView = async (body: string): Promise<string> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "statechart-view-"));
  const view = path.join(folder, "view.mjs");
  await fs.promises.writeFile(view, body);
  return view;
};

const named = (report: string): string[] => {
  const files: string[] = [];
  visitItems(report.matchAll(/\btlc-\w+\.out\b/gu), ([file]) => {if (!files.includes(file)) {files.push(file);}});
  return files;
};

const corpusNames = await readdir(corpus);

visitItems(corpusNames, (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output`, async () => {
    const dir = path.join(corpus, name);
    const result = await run(dir);
    assert.equal(result.stderr, "");
    const first = path.join(dir, "verdict-1.exit");
    const plain = (await fileExists(first)) ? Number(await readFile(first, "utf8")) : TLC_PASSED;
    assert.equal(result.status, replayStatus(plain));
    assert.equal(result.report, read(path.join(dir, "report.md")));
    assert.equal(read(path.join(result.out, "chart.mmd")), read(path.join(dir, "chart.mmd")));
    assert.deepEqual(result.files, ["chart.mmd", "report.md", "tlc.out", ...named(result.report)].toSorted());
    visitItems(result.files, (currentFile) => {assert.doesNotMatch(read(path.join(result.out, currentFile)), /@!@!@/u, currentFile);});
    assert.match(result.configs.ChartRun, /^INVARIANT ChartMark$/mu);
    assert.match(result.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  });
});

const asTlcPrintsOnWindows = function (text: string): string {
  const lines = text.split("\n");
  const lastIndex = lines.length - INDEX_STEP;
  const noOpenMessages = 0;
  const oneMessage = 1;
  const frames = { depth: noOpenMessages };
  return lines.map((line, index) => {
    if (index === lastIndex) {return line;}
    if (/@!@!@STARTMSG \d+:\d+ @!@!@$/u.test(line)) {
      frames.depth += oneMessage;
    } else if (/^@!@!@ENDMSG \d+ @!@!@$/u.test(line)) {
      frames.depth -= oneMessage;
    }
    return frames.depth === noOpenMessages ? `${line}\r` : line;
  }).join("\n");
};

visitItems(corpusNames, (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output with Windows line ends`, async () => {
    const dir = await copyCase(name, async (folder) => {
      const files = await readdir(folder);
      await forEachTlcCase(files, async (file) => {
        if (!file.endsWith(".out")) {return;}
        const output = path.join(folder, file);
        const text = await readFile(output, "utf8");
        await fs.promises.writeFile(output, asTlcPrintsOnWindows(text));
      });
    });
    const result = await run(dir);
    assert.equal(result.stderr, "");
    const first = path.join(dir, "verdict-1.exit");
    const plain = (await fileExists(first)) ? Number(await readFile(first, "utf8")) : TLC_PASSED;
    assert.equal(result.status, replayStatus(plain));
    assert.equal(result.report, read(path.join(corpus, name, "report.md")));
    assert.equal(read(path.join(result.out, "chart.mmd")), read(path.join(corpus, name, "chart.mmd")));
    visitItems(result.files, (currentFile) => {assert.doesNotMatch(read(path.join(result.out, currentFile)), /\r|@!@!@/u, currentFile);});
  });
});

const launcher = path.join(here, "../statechart");

const launcherTools = async (): Promise<string> => {
  const bin = await mkdtemp(path.join(os.tmpdir(), "statechart-bin-"));
  await forEachTlcCase(["dirname", "readlink", "sed"], async (tool) => {
    const found = await runChild("sh", ["-c", `command -v ${tool}`], FIXTURE_PROCESS_OPTIONS);
    await fs.promises.symlink(found.stdout.trim(), path.join(bin, tool));
  });
  return bin;
};

const linkedLauncher = async (): Promise<string> => {
  const links = await mkdtemp(path.join(os.tmpdir(), "statechart-links-"));
  const [first, second] = [path.join(links, "a"), path.join(links, "b")];
  await fs.promises.mkdir(first);
  await fs.promises.mkdir(second);
  await fs.promises.symlink(path.relative(second, launcher), path.join(second, "statechart"));
  await fs.promises.symlink(path.join(second, "statechart"), path.join(first, "statechart"));
  return path.join(first, "statechart");
};

visitItems([
  ["by its own path", false],
  ["through an absolute and a relative symlink", true],
] satisfies [string, boolean][], ([how, usesLinks]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`the launcher reached ${how} writes the committed chart on this Node`, async () => {
    const dir = path.join(corpus, "MediaPlayer");
    const command = usesLinks ? await linkedLauncher() : launcher;
    const tools = await launcherTools();
    const result = await run(dir, {
      command: [command],
      env: { PATH: `${path.dirname(process.execPath)}${path.delimiter}${tools}` },
    });
    assert.equal(result.stderr, "");
    assert.equal(result.status, RULE_BROKEN);
    assert.equal(read(path.join(result.out, "chart.mmd")), read(path.join(dir, "chart.mmd")));
  });
});

const unsetNode = async (): Promise<string> => {
  const bin = await launcherTools();
  await fs.promises.writeFile(
    path.join(bin, "node"),
    '#!/bin/sh\necho "No version is set for node." >&2\nexit 1\n',
    { mode: 0o755 },
  );
  return bin;
};

const fakeBun = (version: string) => async (): Promise<string> => {
  const bin = await launcherTools();
  await fs.promises.writeFile(
    path.join(bin, "bun"),
    `#!/bin/sh\n[ "$1" = --version ] && echo ${version} && exit\necho "$1"\n`,
    { mode: 0o755 },
  );
  return bin;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the launcher runs statechart.ts on Bun 1.1.5 when PATH has no Node", async () => {
  const result = await run(path.join(corpus, "Login"), {
    command: [launcher],
    env: { PATH: await fakeBun("1.1.5")() },
  });
  assert.equal(result.stderr, "");
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.stdout, `${path.join(here, "../statechart.ts")}\n`);
});

visitItems([
  ["has none", launcherTools],
  ["has only a node that fails --version", unsetNode],
  ["has only Bun 1.1.4", fakeBun("1.1.4")],
] satisfies [string, () => Promise<string>][], ([what, bin]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`the launcher stops with exit 127 and names only the runtimes when PATH ${what}`, async () => {
    const result = await run(path.join(corpus, "Login"), { command: [launcher], env: { PATH: await bin() } });
    assert.equal(result.status, NO_COMPATIBLE_RUNTIME);
    assert.equal(
      result.stderr,
      "statechart needs Node 22.18 to 22.x, Node 23.6 or later, Bun 1.1.5 or later, or Deno 2.0 or later.\n",
    );
    assert.deepEqual(result.files, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the order of TLC's dump and its state IDs do not change the chart or the report", async () => {
  const firstSeed = 7;
  const multiplier = 48_271;
  const modulus = 2_147_483_647;
  const generator = { seed: firstSeed };
  const random = (): number => {
    generator.seed = (generator.seed * multiplier) % modulus;
    return generator.seed / modulus;
  };
  await forEachTlcCase(["DieHard", "LoginParallel", "TwoPhase"], async (name) => {
    const dir = await copyCase(name, async (copiedDirectory) => {
      const file = path.join(copiedDirectory, "graph.dot");
      const ids = new Map<string, string>();
      const firstReplacementId = 9000;
      const replacementStride = 17;
      const id = (originalId: string): string => {
        const existing = ids.get(originalId);
        if (!matchesUndefined(existing)) {return existing;}
        const replacement = String(firstReplacementId - ids.size * replacementStride);
        ids.set(originalId, replacement);
        return replacement;
      };
      const lines: string[] = [];
      visitItems(read(file).split("\n"), (part) => {if (/^-?\d+ (?:\[|->)/u.test(part))
          {lines.push(
            part.replace(
              /^(?<fromId>-?\d+)(?: -> (?<toId>-?\d+))?/u,
              (_match: string, fromId: string, toId: string | undefined) => `${id(fromId)}${matchesUndefined(toId) ? "" : ` -> ${id(toId)}`}`,
            ),
          );}});
      const indices = Array.from({ length: lines.length }, (_line, index) => index);
      visitItems(indices.slice(INDEX_STEP).toReversed(), (shuffleIndex) => {
        const swapIndex = Math.floor(random() * (shuffleIndex + INDEX_STEP));
        [lines[shuffleIndex], lines[swapIndex]] = [lines[swapIndex], lines[shuffleIndex]];
      });
      await fs.promises.writeFile(file, ["strict digraph DiskGraph {", ...lines, "}"].join("\n"));
    });
    const result = await run(dir);
    assert.equal(result.report, read(path.join(corpus, name, "report.md")), name);
    assert.equal(
      read(path.join(result.out, "chart.mmd")),
      read(path.join(corpus, name, "chart.mmd")),
      name,
    );
  });
});

const startCommand = async function (
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

const signalWhile = async function <T extends { dir: string; reached: (parent: string) => boolean }>(
  signal: NodeJS.Signals,
  setup: (fakes: string) => (T & { java?: string }) | Promise<T & { java?: string }>,
): Promise<T & { java?: string }> {
  const fakes = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
  const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-parent-"));
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-"));
  const phase = await Promise.resolve(setup(fakes));
  const child = await startCommand(phase.dir, parent, { java: phase.java, tmpdir });
  const captured = { stderr: "" };
  child.stderr.on("data", (chunk: Buffer) => { captured.stderr += chunk.toString("utf8"); });
  const closed: Promise<unknown[]> = once(child, "close");
  const signalTimeoutMilliseconds = 60_000;
  const end = performance.now() + signalTimeoutMilliseconds;
  while (!phase.reached(parent))
    {assert.ok(performance.now() < end, "The command did not reach the phase.");}
  child.kill(signal);
  const [status] = await closed;
  assert.equal(captured.stderr, `${signal} stopped the check, so the command wrote nothing.\n`);
  assert.equal(status, SIGNAL_STATUS_OFFSET + os.constants.signals[signal]);
  assert.deepEqual(await fs.promises.readdir(parent), []);
  assert.deepEqual(await fs.promises.readdir(tmpdir), []);
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

const assertGone = async (pid: number, attempts = CLEANUP_ATTEMPTS): Promise<void> => {
  const state = processState(pid);
  if (state === "gone") {return;}
  const noAttempts = 0;
  const detail = state === "reaping" ? "exited, but it was not reaped" : "is still running";
  assert.ok(attempts > noAttempts, `Process ${pid} ${detail}.`);
  await sleep(CLEANUP_POLL_MILLISECONDS);
  await assertGone(pid, attempts - INDEX_STEP);
};

const PID_MARKER_TIMEOUT = 30_000;
const waitForPidMarker = async (file: string, deadline = performance.now() + PID_MARKER_TIMEOUT): Promise<string> => {
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

const assertEmpty = async function (dir: string): Promise<void> {
  const remaining = await checkCleanedDirectory(dir, CLEANUP_ATTEMPTS);
  assert.deepEqual(remaining, []);
};

const gridCase = async function (dimension: number): Promise<string> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "statechart-case-"));
  const dir = path.join(temporary, "Grid");
  await fs.promises.cp(path.join(here, "grid"), dir, { recursive: true });
  await forEachTlcCase(["ChartRun.out", "verdict-1.out"], async (fixtureFile) => {
    await fs.promises.copyFile(path.join(corpus, "Login", fixtureFile), path.join(dir, fixtureFile));
  });
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
  lines.push("}");
  await fs.promises.writeFile(path.join(dir, "graph.dot"), lines.join("\n"));
  return dir;
};

const sleepyJava = async function (fakes: string): Promise<{ java: string; pidFile: string }> {
  const java = path.join(fakes, "java.mjs");
  const pidFile = path.join(fakes, "java.pid");
  await fs.promises.writeFile(
    java,
    `#!/usr/bin/env node\nimport fs from "node:fs";\n` +
      `process.on("SIGTERM", () => {});\n` +
      `fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n` +
      `setTimeout(() => {}, 60_000);\n`,
    { mode: 0o755 },
  );
  return { java, pidFile };
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a SIGKILL of the command stops TLC, removes the temporary folder, and writes nothing",
  { timeout: 30_000 },
  async () => {
    const fakes = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
    const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-parent-"));
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-"));
    const { java, pidFile } = await sleepyJava(fakes);
    const child = await startCommand(path.join(corpus, "DieHard"), parent, { java, tmpdir });
    const exited = once(child, "exit");
    const pid = await waitForPidMarker(pidFile);
    child.kill("SIGKILL");
    await exited;
    await assertGone(Number(pid));
    await assertEmpty(parent);
    await assertEmpty(tmpdir);
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a SIGKILL of the command while the view draws the chart leaves no folder behind",
  { timeout: 30_000 },
  async () => {
    const fakes = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
    const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-parent-"));
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-"));
    const drawing = path.join(fakes, "drawing");
    const release = path.join(fakes, "release");
    const dir = await copyCase("Login", async (copiedDirectory) =>
      { await fs.promises.writeFile(
        path.join(copiedDirectory, "view.mjs"),
        `import fs from "node:fs";\n` +
          `export const state = (v) => {\n` +
          `  if (!fs.existsSync(${JSON.stringify(drawing)})) {\n` +
          `    fs.writeFileSync(${JSON.stringify(drawing)}, String(process.pid));\n` +
          `    for (const end = Date.now() + 20_000; Date.now() < end && !fs.existsSync(${JSON.stringify(release)}); );\n` +
          `  }\n` +
          `  return JSON.stringify(v);\n` +
          `};\n`,
      ); },
    );
    const child = await startCommand(dir, parent, { tmpdir });
    const exited = once(child, "exit");
    const pid = await waitForPidMarker(drawing);
    child.kill("SIGKILL");
    await exited;
    await fs.promises.writeFile(release, "");
    await assertGone(-Number(pid));
    await assertEmpty(parent);
    await assertEmpty(tmpdir);
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a check killed by a signal stops the command with exit 2, and it writes nothing",
  { timeout: 30_000 },
  async () => {
    const fakes = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
    const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-parent-"));
    const { java, pidFile } = await sleepyJava(fakes);
    const tmpdir = await mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-"));
    const child = await startCommand(path.join(corpus, "DieHard"), parent, { java, tmpdir });
    const captured = { stderr: "" };
    child.stderr.on("data", (chunk: Buffer) => { captured.stderr += chunk.toString("utf8"); });
    const closed: Promise<unknown[]> = once(child, "close");
    const pid = await waitForPidMarker(pidFile);
    const ps = await runChild("ps", ["-o", "ppid=", "-p", pid], FIXTURE_PROCESS_OPTIONS);
    process.kill(Number(ps.stdout), "SIGKILL");
    const [status] = await closed;
    assert.equal(captured.stderr, "SIGKILL killed the check, so the command wrote nothing.\n");
    assert.equal(status, COMMAND_ERROR);
    assert.deepEqual(await fs.promises.readdir(parent), []);
  },
);

visitItems(["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[], (signal) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(
    `${signal} stops TLC, removes the temporary folder, and writes nothing`,
    { timeout: 30_000 },
    async () => {
      const { pidFile } = await signalWhile(signal, async (fakes) => {
        const fake = await sleepyJava(fakes);
        return {
          dir: path.join(corpus, "DieHard"),
          ...fake,
          reached: () => fs.existsSync(fake.pidFile),
        };
      });
      await assertGone(Number(read(pidFile)));
    },
  );

  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(
    `${signal} while the view draws the chart stops the command, and it writes nothing`,
    { timeout: 60_000 },
    async () => {
      await signalWhile(signal, async (fakes) => {
        const drawing = path.join(fakes, "drawing");
        const dir = await copyCase("Login", async (copiedDirectory) =>
          { await fs.promises.writeFile(
            path.join(copiedDirectory, "view.mjs"),
            `import fs from "node:fs";\n` +
              `export const state = (v) => {\n` +
              `  if (!fs.existsSync(${JSON.stringify(drawing)})) {\n` +
              `    fs.writeFileSync(${JSON.stringify(drawing)}, "");\n` +
              `    for (const end = Date.now() + 30_000; Date.now() < end; );\n` +
              `  }\n` +
              `  return JSON.stringify(v);\n` +
              `};\n`,
          ); },
        );
        return { dir, reached: () => fs.existsSync(drawing) };
      });
    },
  );

  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(
    `${signal} while the command writes its files stops it, and it writes nothing`,
    { timeout: 60_000 },
    async () => {
      await signalWhile(signal, async () => ({
        dir: await gridCase(SIGNAL_OUTPUT_GRID_WIDTH),
        reached: (parent) => {
          for (const relativeFile of fs.readdirSync(parent, { encoding: "utf8", recursive: true }))
            {if (
              path.basename(relativeFile) === "chart.mmd" &&
              fs.statSync(path.join(parent, relativeFile), { throwIfNoEntry: false })?.size
            )
              {return true;}}
          return false;
        },
      }));
    },
  );
});

visitItems(["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[], (signal) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${signal} while the command reads TLC's last output stops the check and writes nothing`, async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-late-"));
    const java = path.join(tmp, "java.mjs");
    const tmpdir = path.join(tmp, "tmpdir");
    await fs.promises.mkdir(tmpdir);
    const sendWhileRead = `const fs = require("node:fs");
const [dot, pid, signal, graph] = process.argv.slice(1);
setTimeout(() => process.exit(1), 30_000).unref();
fs.open(dot, "w", (error, fd) => {
  process.kill(Number(pid), signal);
  fs.writeSync(fd, fs.readFileSync(graph));
  fs.closeSync(fd);
});`;
    await fs.promises.writeFile(
      java,
      `#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const dot = args[args.indexOf("-dump") + 2] + ".dot";
spawnSync("mkfifo", [dot]);
const command = spawnSync("ps", ["-o", "ppid=", "-p", String(process.ppid)], { encoding: "utf8" }).stdout.trim();
spawn(process.execPath, ["-e", ${JSON.stringify(sendWhileRead)}, dot, command, ${JSON.stringify(signal)}, ${JSON.stringify(path.join(corpus, "Login", "graph.dot"))}], { detached: true, stdio: "ignore" }).unref();
`,
      { mode: 0o755 },
    );
    const result = await run(path.join(corpus, "Login"), { env: { TMPDIR: tmpdir }, java });
    assert.equal(result.stderr, `${signal} stopped the check, so the command wrote nothing.\n`);
    assert.equal(result.status, SIGNAL_STATUS_OFFSET + os.constants.signals[signal]);
    assert.deepEqual(await fs.promises.readdir(tmpdir), []);
    assert.equal(await fileExists(result.out), false);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a broken property is named in the report, and its TLC trace is in tlc-NAME.out", async () => {
  const dir = path.join(corpus, "MediaPlayerProps");
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  visitItems(["EventuallyPlays", "QuietWhenStopped"], (propertyName) => {
    assert.match(result.report, new RegExp(`^## ${propertyName} breaks\n.*tlc-${propertyName}\\.out`, "mu"));
    const out = read(path.join(result.out, `tlc-${propertyName}.out`));
    const from: string[] = [];
    Object.keys(result.configs).forEach((name) => {
      if (!name.startsWith("verdict-")) {return;}
      const tool = read(path.join(dir, `${name}.out`));
      if (tool && out === `${[...plainText(readMessages(tool))].join("")}\n`) {from.push(name);}
    });
    const expectedVerdictFiles = 1;
    assert.equal(from.length, expectedVerdictFiles, propertyName);
    assert.match(result.configs[from[0]], new RegExp(`^PROPERTY ${propertyName}$`, "mu"));
    assert.match(out, /^TLC2 Version /u);
    assert.doesNotMatch(out, /@!@!@/u);
  });
  assert.match(read(path.join(result.out, "tlc-QuietWhenStopped.out")), /^State 2: <YouTurnItUp /mu);
  assert.match(result.report, /^## Rules that hold\n.*\bEventuallyStops\b.*\bStaysTyped\b/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC checks the rules and draws the chart with VIEW and SYMMETRY, and the report says an arrow can lead to a representative", async () => {
  const dir = await copyCase("MediaPlayer", async (copiedDirectory) =>
    { await fs.promises.appendFile(path.join(copiedDirectory, "MediaPlayer.cfg"), "\nVIEW vars\nSYMMETRY Perms\n"); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  const verdict = result.configs["verdict-1"];
  assert.match(verdict, /^PROPERTY EventuallyStops$/mu);
  visitItems([verdict, result.configs.ChartRun], (config) => {
    assert.match(config, /^VIEW vars$/mu);
    assert.match(config, /^SYMMETRY Perms$/mu);
  });
  assert.match(
    result.report,
    /^With VIEW and SYMMETRY, TLC keeps one representative for each group of states that it counts as the same\. An arrow can lead to the representative rather than to the state that the step reaches\.$/mu,
  );
  const { report } = await run(path.join(corpus, "MediaPlayer"));
  assert.doesNotMatch(report, /representative/u);
});

const overBudget = async (file: string): Promise<void> => {
  const text = await readFile(file, "utf8");
  await fs.promises.writeFile(file, text.replaceAll(/\b\d+(?<counted> distinct states found)/gu, "1234$<counted>"));
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a check above the chart budget skips the drawing run and draws only the bug paths", async () => {
  const dir = await copyCase("FirstRule", async (folder) => {
    const files = await readdir(folder);
    await forEachTlcCase(files.filter((file) => /^verdict-\d+\.out$/u.test(file)), async (file) => {
      await overBudget(path.join(folder, file));
    });
  });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.configs.ChartRun, undefined);
  assert.ok(result.files.includes("chart.mmd"));
  assert.match(
    result.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
  visitItems(["NotOne", "NotOneOrThree", "AlsoNotOne", "NoDeadlock"], (rule) => {assert.match(result.report, new RegExp(`^## ${rule} breaks$`, "mu"));});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a passing check above the chart budget writes no chart.mmd and gives the state count", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "verdict-1.out")); });
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.configs.ChartRun, undefined);
  assert.deepEqual(result.files, ["report.md", "tlc.out"]);
  assert.match(
    result.report,
    /^TLC reached 1,234 states, more than the chart budget of 500, so the command wrote no chart\.mmd\.$/mu,
  );
  assert.match(result.report, /^## Rules that hold\nTypeOK, NoDeadlock$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that INSTANCE actions break above the chart budget draws their qualified names and the loop", async () => {
  const dir = await copyCase("CounterInstance", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "verdict-1.out")); });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.configs.ChartRun, undefined);
  assert.match(
    result.report,
    /^1\. C!Up: 1\n2\. C!Up: 2\n3\. C!Back: 1\nThe run loops through "1" and "2" forever\.$/mu,
  );
  assert.match(read(path.join(result.out, "chart.mmd")), /^ {2}s\d+ --> s\d+: C!Back$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that counts more states than the chart budget gives only the bug paths", async () => {
  const dir = await copyCase("FirstRule", async (copiedDirectory) => { await overBudget(path.join(copiedDirectory, "ChartRun.out")); });
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.match(result.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  assert.match(
    result.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property with no temporal operator says TLC checked it only in the initial states", async () => {
  const result = await run(path.join(corpus, "Counter"));
  assert.equal(result.status, CHECK_PASSED);
  assert.match(result.report, /^## Rules that hold\nLow, StaysSmall\n/mu);
  assert.match(
    result.report,
    /^TLC checked Low only in the initial states, because it has no \[\], <>, or ~>\. List it as an INVARIANT to check every state\.$/mu,
  );
  assert.doesNotMatch(result.report, /TLC checked StaysSmall/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that the config replaces with a state predicate gets the initial-states note", async () => {
  const dir = await copyCase("Counter", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "Counter.cfg"),
      "SPECIFICATION Spec\nCONSTANT StaysSmall <- Low\nPROPERTY StaysSmall\nCHECK_DEADLOCK FALSE\n",
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.match(result.report, /^TLC checked StaysSmall only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that an extended module also defines as LOCAL takes the root definition's level", async () => {
  const result = await run(path.join(corpus, "Shadow"));
  assert.equal(result.status, CHECK_PASSED);
  assert.doesNotMatch(result.report, /TLC checked Shadow/u);
  assert.match(result.report, /^TLC checked Shade only in the initial states, /mu);
  assert.match(result.report, /^TLC checked Hold only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property from an extended module gets the initial-states note too", async () => {
  const dir = await copyCase("MediaPlayerProps", async (copiedDirectory) => {
    await fs.promises.appendFile(path.join(copiedDirectory, "MediaPlayerProps.cfg"), "\nPROPERTY TypeOK\n");
    await fs.promises.copyFile(path.join(copiedDirectory, "verdict-6.out"), path.join(copiedDirectory, "verdict-7.out"));
  });
  const result = await run(dir);
  assert.match(result.report, /^TLC checked TypeOK only in the initial states, /mu);
  assert.doesNotMatch(result.report, /TLC checked (?:EventuallyStops|StaysTyped)/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a spec that SANY cannot read stops the command with exit 2", async () => {
  const dir = await copyCase("MediaPlayer", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "sany.exit"), "150\n"); });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /SANY could not read .*MediaPlayer\.tla \(exit 150\)/u);
  assert.deepEqual(result.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a first verdict run that TLC cannot finish stops the command with exit 2", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "verdict-1.exit"), "150\n"); });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /TLC could not check .*Login\.tla \(exit 150\)/u);
  assert.deepEqual(result.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a later verdict run that TLC cannot finish keeps the exit and leaves its rules not checked", async () => {
  const dir = await copyCase("CounterJump", async (copiedDirectory) =>
    { await fs.promises.writeFile(path.join(copiedDirectory, "verdict-2.exit"), "150\n"); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.match(result.report, /^## NotThree breaks$/mu);
  assert.match(
    result.report,
    /^## Rules not checked\nNoDeadlock\nTLC stopped with exit 150 before it checked this rule:$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that TLC cannot finish stops the command with exit 2", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => {
    await fs.promises.rm(path.join(copiedDirectory, "graph.dot"));
    await fs.promises.writeFile(path.join(copiedDirectory, "ChartRun.exit"), "150\n");
  });
  const result = await run(dir);
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /TLC could not check .*Login\.tla \(exit 150\)/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a java that cannot start stops the command with exit 2 on a runtime that emits no close for it", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-no-java-"));
  const noClose = path.join(tmp, "no-close.mjs");
  await fs.promises.writeFile(
    noClose,
    `import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
const { spawn } = childProcess;
childProcess.spawn = (...args) => {
  const child = spawn(...args);
  const { emit } = child;
  child.emit = (name, ...rest) =>
    name === "close" && child.pid === undefined ? false : emit.call(child, name, ...rest);
  return child;
};
syncBuiltinESMExports();
`,
  );
  const java = path.join(tmp, "java");
  const spec = path.join(corpus, "Login", "Login.tla");
  const result = await run(path.dirname(spec), {
    command: [
      process.execPath,
      `--import=${pathToFileURL(noClose).href}`,
      path.join(here, "../statechart.ts"),
    ],
    java,
  });
  assert.equal(result.stderr, `SANY could not read ${spec} (exit null):\nspawn ${java} ENOENT\n`);
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(await fileExists(result.out), false);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a step hidden by the view is not drawn, and the report counts it", async () => {
  const dir = path.join(corpus, "MediaPlayer");
  const hidden = new Set(read(path.join(dir, "graph.dot")).match(/^.* -> .*label="ACallComesIn"/gmu))
    .size;
  const view = await writeView(
    `export * from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `import { step as words } from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `export const step = (action, from, to) => action === "ACallComesIn" ? null : words(action, from, to);\n`,
  );
  const result = await run(dir, { view });
  assert.equal(result.status, RULE_BROKEN);
  assert.match(
    result.report,
    new RegExp(`^The view hides ${hidden} steps, so the chart does not draw them\\.$`, "mu"),
  );
  assert.doesNotMatch(read(path.join(result.out, "chart.mmd")), /a call comes in/u);
  assert.match(result.report, /^1\. you turn it up: Playback Stopped, Volume Loud$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view that hides a step of a bug path stops the command with exit 2", async () => {
  const dir = path.join(corpus, "MediaPlayer");
  const view = await writeView(
    `export * from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `export const step = (action) => (action === "YouTurnItUp" ? null : action);\n`,
  );
  const result = await run(dir, { view });
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /LoudWhenStopped/u);
  assert.deepEqual(result.files, []);
});

visitItems([
  ["state() returns a number", "export const state = (v) => 7;", /state\(\) returned 7/u],
  ["state() reads a missing variable", `export const state = (v) => \`\${v.nope}\`;`, /undefined/u],
  ["step() returns an empty label", 'export const step = () => "";', /step\(\) returned ""/u],
  [
    "group() names no color",
    'export const group = () => "Busy";\nexport const colors = {};',
    /group\(\) returned "Busy"/u,
  ],
] satisfies [string, string, RegExp][], ([what, body, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a view whose ${what} stops the command with exit 2`, async () => {
    const view = await writeView(body);
    const result = await run(path.join(corpus, "Login"), { view });
    assert.equal(result.status, COMMAND_ERROR);
    assert.match(result.stderr, words);
  });
});

visitItems([
  [
    "gives a group a mark class as its color",
    'export const group = () => "Working";\nexport const colors = { Working: "breaks" };',
    /\bWorking\b[\s\S]*"breaks"[\s\S]*\bblue\b[\s\S]*\bpink\b/u,
  ],
  [
    "gives a group a color outside the theme",
    'export const group = () => "Lost";\nexport const colors = { Lost: "red" };',
    /^The view's colors give "Lost" the color "red"\. Give each group blue, orange, purple, yellow, teal, tan or pink\.\n$/u,
  ],
  [
    "exports colors as a Map",
    'export const colors = new Map([["Busy", "blue"]]);',
    /^The view's colors must be a plain object\.\n$/u,
  ],
  [
    "exports group() but no colors",
    'export const group = () => "Working";',
    /\bgroup\b[\s\S]*\bcolors\b/u,
  ],
  [
    "misspells an export",
    "export const state = (v) => v.main;\nexport const steps = (a) => a;",
    /\bsteps\b[\s\S]*\bstep\b/u,
  ],
  ["has a default export", "export default { state: (v) => v.main };", /\bdefault\b/u],
  ["exports colors as a string", 'export const colors = "blue";', /\bcolors\b[\s\S]*\bobject\b/u],
  ["exports a number as its title", "export const title = 7;", /\btitle\b[\s\S]*\bstring\b/u],
] satisfies [string, string, RegExp][], ([what, body, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a view that ${what} stops the command with exit 2 before TLC runs`, async () => {
    const result = await run(path.join(corpus, "Login"), { view: await writeView(body) });
    assert.equal(result.status, COMMAND_ERROR);
    assert.match(result.stderr, words);
    assert.deepEqual(result.files, []);
    assert.deepEqual(result.configs, {});
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws null stops the command with exit 2 and no stack trace", async () => {
  const result = await run(path.join(corpus, "Login"), { view: await writeView("throw null;\n") });
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(result.stderr, "null\n");
  assert.deepEqual(result.files, []);
  assert.deepEqual(result.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws an object with no prototype stops the command with exit 2", async () => {
  const result = await run(path.join(corpus, "Login"), {
    view: await writeView("throw Object.create(null);\n"),
  });
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(result.stderr, "[Object: null prototype] {}\n");
  assert.deepEqual(result.files, []);
  assert.deepEqual(result.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws a plain object with a message prints the message", async () => {
  const result = await run(path.join(corpus, "Login"), {
    view: await writeView('throw { message: "The view has no states." };\n'),
  });
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(result.stderr, "The view has no states.\n");
  assert.deepEqual(result.files, []);
  assert.deepEqual(result.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view that ends the check while TLC runs stops TLC, and the command exits 2 and writes nothing", async () => {
  const fakes = await mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
  const { java, pidFile } = await sleepyJava(fakes);
  const result = await run(path.join(corpus, "Login"), {
    java,
    view: await writeView(
      'import fs from "node:fs";\n' +
        `setInterval(() => fs.existsSync(${JSON.stringify(pidFile)}) && process.exit(1), 20);\n` +
        "export const state = (v) => JSON.stringify(v);\n",
    ),
  });
  assert.equal(result.status, COMMAND_ERROR);
  assert.deepEqual(result.files, []);
  await assertGone(Number(read(pidFile)));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a group that only a mixed chart state gets still needs a color", async () => {
  const view = await writeView(
    'export const state = (v) => v.main.split(".")[0];\n' +
      'export const group = (v) => v.main.includes("Checking") ? "Checking" : v.main.includes("Wrong") ? "Waiting" : undefined;\n' +
      'export const colors = { Waiting: "blue" };\n',
  );
  const result = await run(path.join(corpus, "Login"), { view });
  assert.equal(result.status, COMMAND_ERROR);
  assert.match(result.stderr, /group\(\) returned "Checking"/u);
  assert.deepEqual(result.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view with a group in a theme color draws that color and names the group in the Legend", async () => {
  const view = await writeView(
    'export const state = (v) => v.main.split(".");\n' +
      'export const group = (v) => (v.main === "Signed in" ? "Done" : undefined);\n' +
      'export const colors = { Done: "teal" };\n' +
      'export const title = "Login";\n',
  );
  const result = await run(path.join(corpus, "Login"), { view });
  assert.equal(result.stderr, "");
  assert.equal(result.status, CHECK_PASSED);
  const chart = read(path.join(result.out, "chart.mmd"));
  assert.match(chart, /^title: "Login"$/mu);
  const stateId = /^ {2}(?<id>s\d+): Signed in$/mu.exec(chart)?.groups?.id;
  assert.match(chart, new RegExp(`^ {2}class ${stateId} teal$`, "mu"));
  const legend = /^ {4}(?<id>lg\d+): Done$/mu.exec(chart)?.groups?.id;
  assert.match(chart, new RegExp(`^ {2}class ${legend} teal$`, "mu"));
});

const byX = (labels: unknown[]): string => `export const state = (v) => ${JSON.stringify(labels)}[v.x];\n`;

const fanOut = (width: number): string => {
  const lines = ["strict digraph DiskGraph {", '0 [label="x = 0",style = filled]'];
  const states = Array.from({ length: width }, (_value, index) => index + INDEX_STEP);
  visitItems(states, (stateIndex) => {
    lines.push(
      `${stateIndex} [label="x = ${stateIndex}"];`,
      `0 -> ${stateIndex} [label="Inc",color="black",fontcolor="black"];`,
    );
  });
  return [...lines, "}"].join("\n");
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a flat view names a label with U+0000 as written when a loop cannot take a step out of it", async () => {
  const view = await writeView(
    `export const state = (v) => (v.playback === "Stopped" || v.volume === "Muted" ? ${JSON.stringify("a\0b")} : v.playback);\n`,
  );
  const result = await run(path.join(corpus, "MediaPlayerProps"), { view });
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(
    result.stderr,
    "The chart draws the step TheCallEnds out of a\0b, but the EventuallyPlays loop cannot take it there. Show in a label what stops it.\n",
  );
  assert.deepEqual(result.files, []);
});

visitItems([
  [
    "a parent-state view keeps a label with U+0000 apart from the parent path it spells",
    {
      arrows: ["a start --> b", "ab --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["ab", "a", "b", "c", "d"],
      status: CHECK_PASSED,
      view: byX([["a\0b"], ["a", "b"], ["c"], ["d"]]),
    },
  ],
  [
    "a regions view keeps a label with U+0000 apart from the parent path it spells, and the report names it as written",
    {
      arrows: [
        "R f start --> S p",
        "R ab start --> S q",
        "R b start --> S r",
        "R a start --> R b",
        "S p --> R ab: Inc",
        "S p --> R a: Inc",
      ],
      base: "Counter",
      fanOut: 2,
      says: /^The regions chart lets R f, S p go to R a\0b, S r by Inc, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
      states: ["R f", "S p", "R ab", "S q", "R a", "R b", "S r"],
      status: CHECK_PASSED,
      view: byX([
        { R: "f", S: "p" },
        { R: ["a\0b"], S: "q" },
        { R: ["a", "b"], S: "r" },
      ]),
    },
  ],
  [
    "a flat view with U+0001 in a label draws each arrow between the states it joins",
    {
      arrows: ["a\u0001b --> a: Inc", "a --> b: Inc", "b --> c: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "a", "b", "c"],
      status: CHECK_PASSED,
      view: byX(["a\u0001b", "a", "b", "c"]),
    },
  ],
  [
    "a parent-state view with U+0001 in a label draws the chart",
    {
      arrows: ["a start --> b", "a\u0001b --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "a", "b", "c", "d"],
      status: CHECK_PASSED,
      view: byX([["a\u0001b"], ["a", "b"], ["c"], ["d"]]),
    },
  ],
  [
    "a regions view with U+0001 in a label draws the chart",
    {
      arrows: ["a\u0001b --> c: Inc", "c --> d: Inc", "d --> e: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 5 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "c", "d", "e", "p"],
      status: CHECK_PASSED,
      view: byX([
        { R: "a\u0001b", S: "p" },
        { R: "c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
    },
  ],
  [
    "a flat view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: b\cBc$/mu,
      states: ["a", "b\u0002c", "d", "e"],
      status: RULE_BROKEN,
      view: byX(["a", "b\u0002c", "d", "e"]),
    },
  ],
  [
    "a parent-state view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["P start --> b\u0002c", "a --> P: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: P \/ b\cBc$/mu,
      states: ["a", "P", "b\u0002c", "d", "e"],
      status: RULE_BROKEN,
      view: byX([["a"], ["P", "b\u0002c"], ["d"], ["e"]]),
    },
  ],
  [
    "a regions view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. R a, S p\n1\. Next: R b\cBc, S p$/mu,
      states: ["a", "b\u0002c", "d", "e", "p"],
      status: RULE_BROKEN,
      view: byX([
        { R: "a", S: "p" },
        { R: "b\u0002c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
    },
  ],
  [
    "a regions view with U+0003 in labels draws parent states when the regions chart would invent a move",
    {
      arrows: [
        "R f start --> S p",
        "R a start --> S r",
        "R b start --> S q",
        "R X\u0003a start --> S q",
        "R X\u0003b start --> S r",
        "S p --> R a: Go\u0003X",
        "S p --> R b: Go\u0003X",
        "S p --> R X\u0003a: Go",
        "S p --> R X\u0003b: Go",
      ],
      base: "Counter",
      fanOut: 4,
      says: /^The regions chart lets R f, S p go to R a, S q by Go\cCX, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
      states: ["R f", "S p", "R a", "S r", "R b", "S q", "R X\u0003a", "S q", "R X\u0003b", "S r"],
      status: CHECK_PASSED,
      view:
        `${byX([
          { R: "f", S: "p" },
          { R: "a", S: "r" },
          { R: "b", S: "q" },
          { R: "X\u0003a", S: "q" },
          { R: "X\u0003b", S: "r" },
        ])
        }export const step = (action, from, to) => (to.x <= 2 ? ${JSON.stringify("Go\u0003X")} : "Go");\n`,
    },
  ],
] satisfies [
  string,
  {
    base: string;
    fanOut?: number;
    view: string;
    status: number;
    states: string[];
    arrows: string[];
    says: RegExp;
  },
][], ([what, chartCase]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(what, async () => {
    const width = "fanOut" in chartCase ? chartCase.fanOut : undefined;
    const noFanOut = 0;
    const dir = !matchesUndefined(width) && width !== noFanOut
      ? await copyCase(chartCase.base, async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "graph.dot"), fanOut(width)); })
      : path.join(corpus, chartCase.base);
    const result = await run(dir, { view: await writeView(chartCase.view) });
    assert.equal(result.stderr, "");
    assert.equal(result.status, chartCase.status);
    const chart = read(path.join(result.out, "chart.mmd"));
    assert.deepEqual(drawn(chart), {
      arrows: chartCase.arrows,
      states: chartCase.states,
    });
    assert.match(result.report, chartCase.says);
  });
});

visitItems([
  ["an unknown option", ["--bogus"], /Unknown option '--bogus'[\s\S]*Usage:/u],
  ["a second spec", ["Other.tla"], /Give one SPEC\.tla\.[\s\S]*Usage:/u],
  [
    "a config that does not exist",
    ["--config", "Missing.cfg"],
    /Cannot find the TLC config Missing\.cfg/u,
  ],
] satisfies [string, string[], RegExp][], ([what, args, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${what} stops the command with exit 2 before TLC runs`, async () => {
    const result = await run(path.join(corpus, "Login"), { args });
    assert.equal(result.status, COMMAND_ERROR);
    assert.match(result.stderr, words);
    assert.deepEqual(result.configs, {});
  });
});

const contents = async (output: string): Promise<Record<string, string> | string> => {
  const stat = await fs.promises.lstat(output);
  if (stat.isSymbolicLink()) {return fs.promises.readlink(output);}
  if (!stat.isDirectory()) {return readFile(output, "utf8");}
  const files: Record<string, string> = {};
  await forEachTlcCase(await readdir(output), async (fileName) => {
    files[fileName] = await readFile(path.join(output, fileName), "utf8");
  });
  return files;
};
const newPath = async (): Promise<string> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "statechart-out-"));
  return path.join(folder, "out");
};

visitItems([
  [
    "a folder of the user's files",
    async (out) => {
      await fs.promises.mkdir(out);
      await fs.promises.writeFile(path.join(out, ".bashrc"), "export PATH\n");
      await fs.promises.writeFile(path.join(out, "report.md"), "# My quarterly report\n");
      await fs.promises.writeFile(path.join(out, "tlc-Build.out"), "build log\n");
    },
    /is not empty\. It has \.bashrc\./u,
  ],
  [
    "a folder that holds only a dotfile",
    async (out) => {
      await fs.promises.mkdir(out);
      await fs.promises.writeFile(path.join(out, ".bashrc"), "export PATH\n");
    },
    /is not empty\. It has \.bashrc\./u,
  ],
  [
    "the folder of an earlier run",
    async (out) => {
      const earlier = await run(path.join(corpus, "MediaPlayerProps"), { args: ["--out", out] });
      assert.equal(earlier.status, RULE_BROKEN);
    },
    /is not empty\. It has chart\.mmd\./u,
  ],
  [
    "a file",
    async (out) => {await fs.promises.writeFile(out, "keep me\n");},
    /cannot be the output folder\. ENOTDIR: not a directory/u,
  ],
  [
    "a broken link",
    async (out) => {await fs.promises.symlink(path.join(path.dirname(out), "gone"), out);},
    /cannot be the output folder\. It is a broken link\./u,
  ],
] satisfies [string, (out: string) => Promise<void>, RegExp][], ([what, make, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`an --out that is ${what} stops the command with exit 2 before TLC runs, and keeps what is there`, async () => {
    const out = await newPath();
    await make(out);
    const before = await contents(out);
    const result = await run(path.join(corpus, "Login"), { args: ["--out", out] });
    assert.equal(result.status, COMMAND_ERROR);
    assert.ok(result.stderr.includes(out), result.stderr);
    assert.match(result.stderr, words);
    assert.match(result.stderr, /Pass --out with a new folder\.\n$/u);
    assert.deepEqual(result.configs, {});
    assert.deepEqual(await contents(out), before);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a file that appears in --out while TLC runs is kept, and the command stops with exit 2", async () => {
  const out = await newPath();
  const mine = path.join(out, "report.md");
  const java = path.join(path.dirname(out), "java.sh");
  await fs.promises.writeFile(
    java,
    `#!/bin/sh\nmkdir -p ${JSON.stringify(out)}\n` +
      `[ -e ${JSON.stringify(mine)} ] || echo mine > ${JSON.stringify(mine)}\n` +
      `exec ${JSON.stringify(path.join(here, "java.ts"))} "$@"\n`,
    { mode: 0o755 },
  );
  const result = await run(path.join(corpus, "Login"), { args: ["--out", out], java });
  assert.equal(result.status, COMMAND_ERROR);
  assert.ok(result.stderr.includes(mine), result.stderr);
  assert.equal(read(mine), "mine\n");
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an empty --out folder gets the chart and the report", async () => {
  const out = await newPath();
  await fs.promises.mkdir(out);
  const result = await run(path.join(corpus, "Login"), { args: ["--out", out] });
  assert.equal(result.stderr, "");
  assert.equal(read(path.join(out, "report.md")), read(path.join(corpus, "Login", "report.md")));
  const files = await readdir(out);
  assert.deepEqual(files.toSorted(), ["chart.mmd", "report.md", "tlc.out"]);
});

visitItems([
  [
    "a misspelled first keyword",
    "\\* The rules\nINVARIENT NeverLocked\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 2\. It was expecting a keyword, but did not find it\.$/mu,
  ],
  [
    "a CHECK_DEADLOCK value in lower case",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nCHECK_DEADLOCK false\n",
    /Login\.cfg at line 3\. It was expecting TRUE or FALSE, but did not find it\./u,
  ],
  [
    "an ALIAS line",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nVIEW vars\nALIAS Pretty\n",
    /Login\.cfg at line 4\. It was expecting a keyword, but did not find it\./u,
  ],
  [
    "a comma between invariants",
    "SPECIFICATION Spec\nINVARIANT TypeOK, NeverLocked\n",
    /Login\.cfg at line 2\. The invariant , specified in the configuration file is not defined in the specification\./u,
  ],
  [
    "a keyword two times",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nSPECIFICATION Spec\n",
    /Login\.cfg at line 3\. The keyword SPECIFICATION appeared twice\./u,
  ],
  [
    "a constant value that TLC cannot read",
    "CONSTANT N = -1\nSPECIFICATION Spec\n",
    /Login\.cfg at line 1\..*"-"/u,
  ],
  [
    "both SPECIFICATION and NEXT",
    "SPECIFICATION Spec\nNEXT Next\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file cannot specify both INIT\/NEXT and SPECIFICATION fields\.$/mu,
  ],
  [
    "no SPECIFICATION and no INIT",
    "\\* The rules\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file did not specify the initial state predicate\.$/mu,
  ],
  [
    "an operator constant with no arguments",
    "CONSTANT f() = 1\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 1\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\n\nCONSTANT f(1, 2 = 3\n",
    /^TLC refuses .*Login\.cfg at line 3\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "a CONSTANT keyword on its own line before operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\nCONSTANT\nf(1, 2\n= 3\n",
    /^TLC refuses .*Login\.cfg at line 2\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "a comma invariant before a CHECK_DEADLOCK value in lower case",
    "SPECIFICATION Spec\nINVARIANT ,\nCHECK_DEADLOCK false\n",
    /Login\.cfg at line 3\. It was expecting TRUE or FALSE, but did not find it\./u,
  ],
  [
    "a comment that does not end",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n(* The view\nVIEW vars\n",
    /Login\.cfg at line 3\..*\bcomment\b/u,
  ],
  [
    "CHECK_DEADLOCK FALSE in a comment that does not end",
    "INVARIANT TypeOK\nSPECIFICATION Spec\n(* CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. A comment starts here and does not end\./u,
  ],
  [
    "a no-break space before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n\u00A0CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. It cannot read the character "\u00A0" \(U\+00A0\) outside a string\./u,
  ],
  [
    "a line separator before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\u2028CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 2\. It cannot read the character "\u2028" \(U\+2028\) outside a string\./u,
  ],
  [
    "a byte order mark",
    "\uFEFFSPECIFICATION Spec\nINVARIANT TypeOK\n",
    /Login\.cfg at line 1\. The file starts with a byte order mark\. Save it as UTF-8 without one\.$/mu,
  ],
] satisfies [string, string, RegExp][], ([what, config, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a config with ${what} stops the command with exit 2 before TLC runs`, async () => {
    const dir = await copyCase("Login", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "Login.cfg"), config); });
    const result = await run(dir);
    assert.equal(result.status, COMMAND_ERROR);
    assert.match(result.stderr, words);
    assert.deepEqual(result.configs, {});
    assert.deepEqual(result.files, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a nested comment hides all of its text, as in TLC", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => {
    const file = path.join(copiedDirectory, "Login.cfg");
    await fs.promises.writeFile(file, `(* Off: (* old *) CHECK_DEADLOCK FALSE *)\n${read(file)}`);
  });
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.report, read(path.join(corpus, "Login", "report.md")));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a string constant keeps the keywords and comment markers in it", async () => {
  const dir = await copyCase("TwoPhase", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "TwoPhase.cfg"),
      'CONSTANT RM = {"INVARIANT (*", "\\\\* r2"}\nSPECIFICATION TPSpec\nINVARIANT TPTypeOK TCConsistent\n',
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.report, read(path.join(corpus, "TwoPhase", "report.md")));
  assert.match(result.configs.ChartRun, /^CONSTANT RM = .*"INVARIANT \(\*".*"\\\\\* r2"/mu);
  assert.deepEqual(result.configs.ChartRun.match(/^INVARIANT.*$/gmu), ["INVARIANT ChartMark"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TYPE and TYPE_CONSTRAINT are config keywords, as in TLC", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "Login.cfg"),
      "SPECIFICATION Spec\nINVARIANT TypeOK\nTYPE TypeOK\nTYPE_CONSTRAINT TypeOK\nVIEW vars\n",
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.report, read(path.join(corpus, "Login", "report.md")));
  assert.match(result.configs.ChartRun, /^TYPE TypeOK$/mu);
  assert.match(result.configs.ChartRun, /^TYPE_CONSTRAINT TypeOK$/mu);
});
