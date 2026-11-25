// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { fileExists } from "#statechart/run.ts";
import { assertEmpty, assertGone, killOnMarker, makeSignalDirectories, observeChild, signalWhile, waitForPidMarker } from "./cli-native-process.ts";
import { COMMAND_ERROR, SIGNAL_STATUS_OFFSET, copyCase, corpus, gridCase, parentPid, read, run, sleepyJava, startCommand } from "./cli-fixtures.ts";

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a SIGKILL of the command stops TLC, removes the temporary folder, and writes nothing",
  { timeout: 30_000 },
  async () => {
    const { fakes, parent, tmpdir } = await makeSignalDirectories();
    const { java, pidFile } = await sleepyJava(fakes);
    const child = await startCommand(path.join(corpus, "DieHard"), parent, { java, tmpdir });
    const pid = await killOnMarker(child, pidFile);
    await assertGone(pid);
    await assertEmpty(parent);
    await assertEmpty(tmpdir);
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a SIGKILL of the command while the view draws the chart leaves no folder behind",
  { timeout: 30_000 },
  async () => {
    const { fakes, parent, tmpdir } = await makeSignalDirectories();
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
    const pid = await killOnMarker(child, drawing);
    await fs.promises.writeFile(release, "");
    await assertGone(-pid);
    await assertEmpty(parent);
    await assertEmpty(tmpdir);
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a check killed by a signal stops the command with exit 2, and it writes nothing",
  { timeout: 30_000 },
  async () => {
    const { fakes, parent, tmpdir } = await makeSignalDirectories();
    const { java, pidFile } = await sleepyJava(fakes);
    const child = await startCommand(path.join(corpus, "DieHard"), parent, { java, tmpdir });
    const { captured, closed } = observeChild(child);
    const pid = await waitForPidMarker(pidFile);
    process.kill(await parentPid(pid), "SIGKILL");
    const [status] = await closed;
    assert.equal(captured.stderr, "SIGKILL killed the check, so the command wrote nothing.\n");
    assert.equal(status, COMMAND_ERROR);
    assert.deepEqual(await fs.promises.readdir(parent), []);
  },
);

const SIGNAL_OUTPUT_GRID_WIDTH = 150;

const activeChartWrite = (parent: string): boolean => {
  // oxlint-disable-next-line node/no-sync -- Inspect staging files in the same sampling turn so the signal reaches an active write, before publication.
  const files = fs.readdirSync(parent, { encoding: "utf8", recursive: true });
  return files.some((relativeFile) => {
    if (path.basename(relativeFile) !== "chart.mmd") {return false;}
    // oxlint-disable-next-line node/no-sync -- Read staging size without yielding between discovery and the active-write check.
    const size = fs.statSync(path.join(parent, relativeFile), { throwIfNoEntry: false })?.size;
    const empty = 0;
    return !matchesUndefined(size) && size > empty;
  });
};

const registerTlcSignal = (signal: NodeJS.Signals): void => {
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
          reached: async () => fileExists(fake.pidFile),
        };
      });
      await assertGone(Number(await read(pidFile)));
    },
  );
};

const registerViewSignal = (signal: NodeJS.Signals): void => {
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
        return { dir, reached: async () => fileExists(drawing) };
      });
    },
  );
};

const registerWriteSignal = (signal: NodeJS.Signals): void => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(
    `${signal} while the command writes its files stops it, and it writes nothing`,
    { timeout: 60_000 },
    async () => {
      await signalWhile(signal, async () => ({
        dir: await gridCase(SIGNAL_OUTPUT_GRID_WIDTH),
        reached: activeChartWrite,
      }));
    },
  );
};

visitItems(["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[], (signal) => {
  registerTlcSignal(signal);
  registerViewSignal(signal);
  registerWriteSignal(signal);
});

visitItems(["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[], (signal) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${signal} while the command reads TLC's last output stops the check and writes nothing`, async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-late-"));
    const java = path.join(tmp, "java.mjs");
    const tmpdir = await fs.promises.mkdtemp(path.join(tmp, "tmpdir-"));
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
