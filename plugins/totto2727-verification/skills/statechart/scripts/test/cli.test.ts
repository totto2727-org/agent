// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { drawn } from "./drawn.ts";
import { visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const corpus = path.join(here, "corpus");
const read = (file: string): string => fs.readFileSync(file, "utf8");

const run = function (
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
) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-cli-"));
  const out = path.join(tmp, "out");
  const log = path.join(tmp, "configs.log");
  const name = path.basename(dir);
  const [file, ...entry] = command;
  const r = spawnSync(
    file,
    [
      ...entry,
      path.join(dir, `${name}.tla`),
      ...(fs.existsSync(view) ? ["--view", view] : []),
      "--out",
      out,
      ...args,
    ],
    {
      encoding: "utf8",
      env: {
        ...hostEnvironment(),
        JAVA: java,
        TLA2TOOLS: "tla2tools.jar",
        STATECHART_REPLAY: dir,
        STATECHART_LOG: log,
        ...env,
      },
    },
  );
  const configs: Record<string, string> = {};
  if (fs.existsSync(log))
    {visitItems(read(log).split(/^## /mu), (part) => {if (part) {configs[part.slice(0, part.indexOf("\n"))] = part;}});}
  const files = fs.existsSync(out) ? fs.readdirSync(out).sort() : [];
  return {
    ...r,
    out,
    files,
    configs,
    report: files.includes("report.md") ? read(path.join(out, "report.md")) : "",
  };
};

const copyCase = function (name: string, edit: (dir: string) => void = () => {}): string {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-case-")), name);
  fs.cpSync(path.join(corpus, name), dir, { recursive: true });
  edit(dir);
  return dir;
};

const named = (report: string): string[] => {
  const files: string[] = [];
  visitItems(report.matchAll(/\btlc-\w+\.out\b/g), ([file]) => {if (!files.includes(file)) {files.push(file);}});
  return files;
};

visitItems(fs.readdirSync(corpus), (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output`, () => {
    const dir = path.join(corpus, name);
    const r = run(dir);
    assert.equal(r.stderr, "");
    const first = path.join(dir, "verdict-1.exit");
    const plain = fs.existsSync(first) ? Number(read(first)) : 0;
    assert.equal(r.status, plain === 0 ? 0 : ([11, 12, 13].includes(plain) ? 1 : 2));
    assert.equal(r.report, read(path.join(dir, "report.md")));
    assert.equal(read(path.join(r.out, "chart.mmd")), read(path.join(dir, "chart.mmd")));
    assert.deepEqual(r.files, ["chart.mmd", "report.md", "tlc.out", ...named(r.report)].sort());
    for (const currentFile of r.files) {assert.doesNotMatch(read(path.join(r.out, currentFile)), /@!@!@/u, currentFile);}
    assert.match(r.configs.ChartRun, /^INVARIANT ChartMark$/mu);
    assert.match(r.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  });
});

const asTlcPrintsOnWindows = function (text: string): string {
  const lines = text.split("\n");
  let depth = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/@!@!@STARTMSG \d+:\d+ @!@!@$/u.test(lines[i])) {depth++;}
    else if (/^@!@!@ENDMSG \d+ @!@!@$/u.test(lines[i])) {depth--;}
    if (!depth) {lines[i] += "\r";}
  }
  return lines.join("\n");
};

visitItems(fs.readdirSync(corpus), (name) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} writes the committed chart and report from TLC's output with Windows line ends`, () => {
    const dir = copyCase(name, (d) => {
      for (const f of fs.readdirSync(d))
        {if (f.endsWith(".out"))
          {fs.writeFileSync(path.join(d, f), asTlcPrintsOnWindows(read(path.join(d, f))));}}
    });
    const r = run(dir);
    assert.equal(r.stderr, "");
    const first = path.join(dir, "verdict-1.exit");
    const plain = fs.existsSync(first) ? Number(read(first)) : 0;
    assert.equal(r.status, plain === 0 ? 0 : ([11, 12, 13].includes(plain) ? 1 : 2));
    assert.equal(r.report, read(path.join(corpus, name, "report.md")));
    assert.equal(read(path.join(r.out, "chart.mmd")), read(path.join(corpus, name, "chart.mmd")));
    for (const currentFile of r.files) {assert.doesNotMatch(read(path.join(r.out, currentFile)), /\r|@!@!@/u, currentFile);}
  });
});

const launcher = path.join(here, "../statechart");

const launcherTools = (): string => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-bin-"));
  visitItems(["dirname", "readlink", "sed"], (tool) => {
    const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
    fs.symlinkSync(found.stdout.trim(), path.join(bin, tool));
  });
  return bin;
};

const linkedLauncher = (): string => {
  const links = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-links-"));
  const [first, second] = [path.join(links, "a"), path.join(links, "b")];
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  fs.symlinkSync(path.relative(second, launcher), path.join(second, "statechart"));
  fs.symlinkSync(path.join(second, "statechart"), path.join(first, "statechart"));
  return path.join(first, "statechart");
};

visitItems([
  ["by its own path", () => launcher],
  ["through an absolute and a relative symlink", linkedLauncher],
] satisfies [string, () => string][], ([how, command]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`the launcher reached ${how} writes the committed chart on this Node`, () => {
    const dir = path.join(corpus, "MediaPlayer");
    const r = run(dir, {
      command: [command()],
      env: { PATH: `${path.dirname(process.execPath)}${path.delimiter}${launcherTools()}` },
    });
    assert.equal(r.stderr, "");
    assert.equal(r.status, 1);
    assert.equal(read(path.join(r.out, "chart.mmd")), read(path.join(dir, "chart.mmd")));
  });
});

const unsetNode = (): string => {
  const bin = launcherTools();
  fs.writeFileSync(
    path.join(bin, "node"),
    '#!/bin/sh\necho "No version is set for node." >&2\nexit 1\n',
    { mode: 0o755 },
  );
  return bin;
};

const fakeBun = (version: string) => () => {
  const bin = launcherTools();
  fs.writeFileSync(
    path.join(bin, "bun"),
    `#!/bin/sh\n[ "$1" = --version ] && echo ${version} && exit\necho "$1"\n`,
    { mode: 0o755 },
  );
  return bin;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the launcher runs statechart.ts on Bun 1.1.5 when PATH has no Node", () => {
  const r = run(path.join(corpus, "Login"), {
    command: [launcher],
    env: { PATH: fakeBun("1.1.5")() },
  });
  assert.equal(r.stderr, "");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `${path.join(here, "../statechart.ts")}\n`);
});

visitItems([
  ["has none", launcherTools],
  ["has only a node that fails --version", unsetNode],
  ["has only Bun 1.1.4", fakeBun("1.1.4")],
] satisfies [string, () => string][], ([what, bin]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`the launcher stops with exit 127 and names only the runtimes when PATH ${what}`, () => {
    const r = run(path.join(corpus, "Login"), { command: [launcher], env: { PATH: bin() } });
    assert.equal(r.status, 127);
    assert.equal(
      r.stderr,
      "statechart needs Node 22.18 to 22.x, Node 23.6 or later, Bun 1.1.5 or later, or Deno 2.0 or later.\n",
    );
    assert.deepEqual(r.files, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the order of TLC's dump and its state IDs do not change the chart or the report", () => {
  let seed = 7;
  const random = (): number => (seed = (seed * 48_271) % 2_147_483_647) / 2_147_483_647;
  visitItems(["DieHard", "LoginParallel", "TwoPhase"], (name) => {
    const dir = copyCase(name, (d) => {
      const file = path.join(d, "graph.dot");
      const ids = new Map<string, string>();
      const id = (n: string): string | undefined => ids.get(n) ?? ids.set(n, String(9000 - ids.size * 17)).get(n);
      const lines: string[] = [];
      for (const part of read(file).split("\n"))
        {if (/^-?\d+ (?:\[|->)/u.test(part))
          {lines.push(
            part.replace(
              /^(-?\d+)(?: -> (-?\d+))?/u,
              (_: string, a: string, b: string | undefined) => id(a) + (b ? ` -> ${id(b)}` : ""),
            ),
          );}}
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      fs.writeFileSync(file, ["strict digraph DiskGraph {", ...lines, "}"].join("\n"));
    });
    const r = run(dir);
    assert.equal(r.report, read(path.join(corpus, name, "report.md")), name);
    assert.equal(
      read(path.join(r.out, "chart.mmd")),
      read(path.join(corpus, name, "chart.mmd")),
      name,
    );
  });
});

const startCommand = function (
  dir: string,
  parent: string,
  {
    java = path.join(here, "java.ts"),
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-tmpdir-")),
  }: { java?: string; tmpdir?: string } = {},
) {
  const name = path.basename(dir);
  const view = path.join(dir, "view.mjs");
  return spawn(
    process.execPath,
    [
      path.join(here, "../statechart.ts"),
      path.join(dir, `${name}.tla`),
      ...(fs.existsSync(view) ? ["--view", view] : []),
      "--out",
      path.join(parent, "out"),
    ],
    {
      env: {
        ...hostEnvironment(),
        JAVA: java,
        TLA2TOOLS: "tla2tools.jar",
        STATECHART_REPLAY: dir,
        TMPDIR: tmpdir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
};

const signalWhile = async function <T extends { dir: string; reached: (parent: string) => boolean }>(
  signal: NodeJS.Signals,
  setup: (fakes: string) => T & { java?: string },
) {
  const fakes = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-fakes-"));
  const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-parent-"));
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-tmpdir-"));
  const phase = setup(fakes);
  const child = startCommand(phase.dir, parent, { java: phase.java, tmpdir });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
  const closed = once(child, "close");
  const signalTimeoutMilliseconds = 60_000;
  const end = performance.now() + signalTimeoutMilliseconds;
  while (!phase.reached(parent))
    {assert.ok(performance.now() < end, "The command did not reach the phase.");}
  child.kill(signal);
  const [status] = await closed;
  assert.equal(stderr, `${signal} stopped the check, so the command wrote nothing.\n`);
  assert.equal(status, 128 + os.constants.signals[signal]);
  assert.deepEqual(fs.readdirSync(parent), []);
  assert.deepEqual(fs.readdirSync(tmpdir), []);
  return phase;
};

const assertGone = async function (pid: number): Promise<void> {
  for (let i = 0; ; i++) {
    let code: string | undefined;
    try {
      process.kill(pid, 0);
    } catch (error) {
      code = (error as NodeJS.ErrnoException).code;
      // MacOS gives EPERM for a process group of only zombies, until they are reaped.
      if (code !== "EPERM") {
        assert.equal(code, "ESRCH");
        return;
      }
    }
    assert.ok(
      i < 250,
      `Process ${pid} ${code ? "exited, but it was not reaped" : "is still running"}.`,
    );
    await sleep(20);
  }
};

const assertEmpty = async function (dir: string): Promise<void> {
  for (let i = 0; i < 250 && fs.readdirSync(dir).length; i++) {await sleep(20);}
  assert.deepEqual(fs.readdirSync(dir), []);
};

const gridCase = function (n: number): string {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-case-")), "Grid");
  fs.cpSync(path.join(here, "grid"), dir, { recursive: true });
  visitItems(["ChartRun.out", "verdict-1.out"], (run) => {fs.copyFileSync(path.join(corpus, "Login", run), path.join(dir, run));});
  const id = (x: number, y: number): string => String(1_000_000 + x * n + y);
  const lines = ["strict digraph DiskGraph {"];
  for (let x = 0; x < n; x++)
    {for (let y = 0; y < n; y++) {
      lines.push(
        `${id(x, y)} [label="/\\\\ x = ${x}\\n/\\\\ y = ${y}"${x + y ? "" : ",style = filled"}]`,
      );
      if (x + 1 < n) {lines.push(`${id(x, y)} -> ${id(x + 1, y)} [label="IncX"];`);}
      if (y + 1 < n) {lines.push(`${id(x, y)} -> ${id(x, y + 1)} [label="IncY"];`);}
    }}
  lines.push("}");
  fs.writeFileSync(path.join(dir, "graph.dot"), lines.join("\n"));
  return dir;
};

const sleepyJava = function (fakes: string) {
  const java = path.join(fakes, "java.mjs");
  const pidFile = path.join(fakes, "java.pid");
  fs.writeFileSync(
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
    const { java, pidFile } = sleepyJava(fakes);
    const child = startCommand(path.join(corpus, "DieHard"), parent, { java, tmpdir });
    const exited = once(child, "exit");
    while (!fs.existsSync(pidFile)) {await sleep(20);}
    child.kill("SIGKILL");
    await exited;
    await assertGone(Number(read(pidFile)));
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
    const dir = copyCase("Login", (d) =>
      fs.writeFileSync(
        path.join(d, "view.mjs"),
        `import fs from "node:fs";\n` +
          `export const state = (v) => {\n` +
          `  if (!fs.existsSync(${JSON.stringify(drawing)})) {\n` +
          `    fs.writeFileSync(${JSON.stringify(drawing)}, String(process.pid));\n` +
          `    for (const end = Date.now() + 20_000; Date.now() < end && !fs.existsSync(${JSON.stringify(release)}); );\n` +
          `  }\n` +
          `  return JSON.stringify(v);\n` +
          `};\n`,
      ),
    );
    const child = startCommand(dir, parent, { tmpdir });
    const exited = once(child, "exit");
    while (!fs.existsSync(drawing) || !read(drawing)) {await sleep(20);}
    child.kill("SIGKILL");
    await exited;
    await fs.promises.writeFile(release, "");
    await assertGone(-Number(read(drawing)));
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
    const { java, pidFile } = sleepyJava(fakes);
    const child = startCommand(path.join(corpus, "DieHard"), parent, { java });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
    const closed = once(child, "close");
    while (!fs.existsSync(pidFile) || !read(pidFile)) {await sleep(20);}
    const ps = spawnSync("ps", ["-o", "ppid=", "-p", read(pidFile)], { encoding: "utf8" });
    process.kill(Number(ps.stdout), "SIGKILL");
    const [status] = await closed;
    assert.equal(stderr, "SIGKILL killed the check, so the command wrote nothing.\n");
    assert.equal(status, 2);
    assert.deepEqual(fs.readdirSync(parent), []);
  },
);

visitItems(["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[], (signal) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(
    `${signal} stops TLC, removes the temporary folder, and writes nothing`,
    { timeout: 30_000 },
    async () => {
      const { pidFile } = await signalWhile(signal, (fakes) => {
        const fake = sleepyJava(fakes);
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
      await signalWhile(signal, (fakes) => {
        const drawing = path.join(fakes, "drawing");
        const dir = copyCase("Login", (d) =>
          fs.writeFileSync(
            path.join(d, "view.mjs"),
            `import fs from "node:fs";\n` +
              `export const state = (v) => {\n` +
              `  if (!fs.existsSync(${JSON.stringify(drawing)})) {\n` +
              `    fs.writeFileSync(${JSON.stringify(drawing)}, "");\n` +
              `    for (const end = Date.now() + 30_000; Date.now() < end; );\n` +
              `  }\n` +
              `  return JSON.stringify(v);\n` +
              `};\n`,
          ),
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
      await signalWhile(signal, () => ({
        dir: gridCase(150),
        reached: (parent) => {
          for (const f of fs.readdirSync(parent, { encoding: "utf8", recursive: true }))
            {if (
              path.basename(f) === "chart.mmd" &&
              fs.statSync(path.join(parent, f), { throwIfNoEntry: false })?.size
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
  test(`${signal} while the command reads TLC's last output stops the check and writes nothing`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-late-"));
    const java = path.join(tmp, "java.mjs");
    const tmpdir = path.join(tmp, "tmpdir");
    fs.mkdirSync(tmpdir);
    const sendWhileRead = `const fs = require("node:fs");
const [dot, pid, signal, graph] = process.argv.slice(1);
setTimeout(() => process.exit(1), 30_000).unref();
fs.open(dot, "w", (error, fd) => {
  process.kill(Number(pid), signal);
  fs.writeSync(fd, fs.readFileSync(graph));
  fs.closeSync(fd);
});`;
    fs.writeFileSync(
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
    const r = run(path.join(corpus, "Login"), { java, env: { TMPDIR: tmpdir } });
    assert.equal(r.stderr, `${signal} stopped the check, so the command wrote nothing.\n`);
    assert.equal(r.status, 128 + os.constants.signals[signal]);
    assert.deepEqual(fs.readdirSync(tmpdir), []);
    assert.equal(fs.existsSync(r.out), false);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a broken property is named in the report, and its TLC trace is in tlc-NAME.out", () => {
  const dir = path.join(corpus, "MediaPlayerProps");
  const r = run(dir);
  assert.equal(r.status, 1);
  visitItems(["EventuallyPlays", "QuietWhenStopped"], (p) => {
    assert.match(r.report, new RegExp(`^## ${p} breaks\n.*tlc-${p}\\.out`, "m"));
    const out = read(path.join(r.out, `tlc-${p}.out`));
    const from: string[] = [];
    Object.keys(r.configs).forEach((name) => {
      const tool = name.startsWith("verdict-") && read(path.join(dir, `${name}.out`));
      if (tool && out === `${[...plainText(readMessages(tool))].join("")}\n`) {from.push(name);}
    });
    assert.equal(from.length, 1, p);
    assert.match(r.configs[from[0]], new RegExp(`^PROPERTY ${p}$`, "m"));
    assert.match(out, /^TLC2 Version /u);
    assert.doesNotMatch(out, /@!@!@/u);
  });
  assert.match(read(path.join(r.out, "tlc-QuietWhenStopped.out")), /^State 2: <YouTurnItUp /mu);
  assert.match(r.report, /^## Rules that hold\n.*\bEventuallyStops\b.*\bStaysTyped\b/m);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC checks the rules and draws the chart with VIEW and SYMMETRY, and the report says an arrow can lead to a representative", () => {
  const dir = copyCase("MediaPlayer", (d) =>
    fs.appendFileSync(path.join(d, "MediaPlayer.cfg"), "\nVIEW vars\nSYMMETRY Perms\n"),
  );
  const r = run(dir);
  assert.equal(r.status, 1);
  const verdict = r.configs["verdict-1"];
  assert.match(verdict, /^PROPERTY EventuallyStops$/mu);
  visitItems([verdict, r.configs.ChartRun], (config) => {
    assert.match(config, /^VIEW vars$/mu);
    assert.match(config, /^SYMMETRY Perms$/mu);
  });
  assert.match(
    r.report,
    /^With VIEW and SYMMETRY, TLC keeps one representative for each group of states that it counts as the same\. An arrow can lead to the representative rather than to the state that the step reaches\.$/mu,
  );
  assert.doesNotMatch(run(path.join(corpus, "MediaPlayer")).report, /representative/u);
});

const overBudget = (file: string): void =>
  fs.writeFileSync(file, read(file).replaceAll(/\b\d+( distinct states found)/g, "1234$1"));

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a check above the chart budget skips the drawing run and draws only the bug paths", () => {
  const dir = copyCase("FirstRule", (d) => {
    visitItems(fs.readdirSync(d), (fileName) => {if (/^verdict-\d+\.out$/u.test(fileName)) {overBudget(path.join(d, fileName));}});
  });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.equal(r.configs.ChartRun, undefined);
  assert.ok(r.files.includes("chart.mmd"));
  assert.match(
    r.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
  visitItems(["NotOne", "NotOneOrThree", "AlsoNotOne", "NoDeadlock"], (rule) => {assert.match(r.report, new RegExp(`^## ${rule} breaks$`, "m"));});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a passing check above the chart budget writes no chart.mmd and gives the state count", () => {
  const dir = copyCase("Login", (d) => overBudget(path.join(d, "verdict-1.out")));
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.configs.ChartRun, undefined);
  assert.deepEqual(r.files, ["report.md", "tlc.out"]);
  assert.match(
    r.report,
    /^TLC reached 1,234 states, more than the chart budget of 500, so the command wrote no chart\.mmd\.$/mu,
  );
  assert.match(r.report, /^## Rules that hold\nTypeOK, NoDeadlock$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that INSTANCE actions break above the chart budget draws their qualified names and the loop", () => {
  const dir = copyCase("CounterInstance", (d) => overBudget(path.join(d, "verdict-1.out")));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.equal(r.configs.ChartRun, undefined);
  assert.match(
    r.report,
    /^1\. C!Up: 1\n2\. C!Up: 2\n3\. C!Back: 1\nThe run loops through "1" and "2" forever\.$/mu,
  );
  assert.match(read(path.join(r.out, "chart.mmd")), /^  s\d+ --> s\d+: C!Back$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that counts more states than the chart budget gives only the bug paths", () => {
  const dir = copyCase("FirstRule", (d) => overBudget(path.join(d, "ChartRun.out")));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.configs.ChartRun, /^CONSTRAINT ChartBudget$/mu);
  assert.match(
    r.report,
    /^TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property with no temporal operator says TLC checked it only in the initial states", () => {
  const r = run(path.join(corpus, "Counter"));
  assert.equal(r.status, 0);
  assert.match(r.report, /^## Rules that hold\nLow, StaysSmall\n/mu);
  assert.match(
    r.report,
    /^TLC checked Low only in the initial states, because it has no \[\], <>, or ~>\. List it as an INVARIANT to check every state\.$/mu,
  );
  assert.doesNotMatch(r.report, /TLC checked StaysSmall/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that the config replaces with a state predicate gets the initial-states note", () => {
  const dir = copyCase("Counter", (d) =>
    fs.writeFileSync(
      path.join(d, "Counter.cfg"),
      "SPECIFICATION Spec\nCONSTANT StaysSmall <- Low\nPROPERTY StaysSmall\nCHECK_DEADLOCK FALSE\n",
    ),
  );
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.match(r.report, /^TLC checked StaysSmall only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property that an extended module also defines as LOCAL takes the root definition's level", () => {
  const r = run(path.join(corpus, "Shadow"));
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.report, /TLC checked Shadow/u);
  assert.match(r.report, /^TLC checked Shade only in the initial states, /mu);
  assert.match(r.report, /^TLC checked Hold only in the initial states, /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a property from an extended module gets the initial-states note too", () => {
  const dir = copyCase("MediaPlayerProps", (d) => {
    fs.appendFileSync(path.join(d, "MediaPlayerProps.cfg"), "\nPROPERTY TypeOK\n");
    fs.copyFileSync(path.join(d, "verdict-6.out"), path.join(d, "verdict-7.out"));
  });
  const r = run(dir);
  assert.match(r.report, /^TLC checked TypeOK only in the initial states, /mu);
  assert.doesNotMatch(r.report, /TLC checked (?:EventuallyStops|StaysTyped)/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a spec that SANY cannot read stops the command with exit 2", () => {
  const dir = copyCase("MediaPlayer", (d) => fs.writeFileSync(path.join(d, "sany.exit"), "150\n"));
  const r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /SANY could not read .*MediaPlayer\.tla \(exit 150\)/);
  assert.deepEqual(r.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a first verdict run that TLC cannot finish stops the command with exit 2", () => {
  const dir = copyCase("Login", (d) => fs.writeFileSync(path.join(d, "verdict-1.exit"), "150\n"));
  const r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /TLC could not check .*Login\.tla \(exit 150\)/);
  assert.deepEqual(r.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a later verdict run that TLC cannot finish keeps the exit and leaves its rules not checked", () => {
  const dir = copyCase("CounterJump", (d) =>
    fs.writeFileSync(path.join(d, "verdict-2.exit"), "150\n"),
  );
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.report, /^## NotThree breaks$/mu);
  assert.match(
    r.report,
    /^## Rules not checked\nNoDeadlock\nTLC stopped with exit 150 before it checked this rule:$/mu,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a drawing run that TLC cannot finish stops the command with exit 2", () => {
  const dir = copyCase("Login", (d) => {
    fs.rmSync(path.join(d, "graph.dot"));
    fs.writeFileSync(path.join(d, "ChartRun.exit"), "150\n");
  });
  const r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /TLC could not check .*Login\.tla \(exit 150\)/);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a java that cannot start stops the command with exit 2 on a runtime that emits no close for it", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-no-java-"));
  const noClose = path.join(tmp, "no-close.mjs");
  fs.writeFileSync(
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
  const r = run(path.dirname(spec), {
    java,
    command: [
      process.execPath,
      `--import=${pathToFileURL(noClose).href}`,
      path.join(here, "../statechart.ts"),
    ],
  });
  assert.equal(r.stderr, `SANY could not read ${spec} (exit null):\nspawn ${java} ENOENT\n`);
  assert.equal(r.status, 2);
  assert.equal(fs.existsSync(r.out), false);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a step hidden by the view is not drawn, and the report counts it", () => {
  const dir = path.join(corpus, "MediaPlayer");
  const hidden = new Set(read(path.join(dir, "graph.dot")).match(/^.* -> .*label="ACallComesIn"/gm))
    .size;
  const view = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-view-")), "view.mjs");
  fs.writeFileSync(
    view,
    `export * from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `import { step as words } from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `export const step = (action, from, to) => action === "ACallComesIn" ? null : words(action, from, to);\n`,
  );
  const r = run(dir, { view });
  assert.equal(r.status, 1);
  assert.match(
    r.report,
    new RegExp(`^The view hides ${hidden} steps, so the chart does not draw them\\.$`, "m"),
  );
  assert.doesNotMatch(read(path.join(r.out, "chart.mmd")), /a call comes in/u);
  assert.match(r.report, /^1\. you turn it up: Playback Stopped, Volume Loud$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view that hides a step of a bug path stops the command with exit 2", () => {
  const dir = path.join(corpus, "MediaPlayer");
  const view = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-view-")), "view.mjs");
  fs.writeFileSync(
    view,
    `export * from ${JSON.stringify(path.join(dir, "view.mjs"))};\n` +
      `export const step = (action) => (action === "YouTurnItUp" ? null : action);\n`,
  );
  const r = run(dir, { view });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /LoudWhenStopped/u);
  assert.deepEqual(r.files, []);
});

visitItems([
  ["state() returns a number", "export const state = (v) => 7;", /state\(\) returned 7/u],
  ["state() reads a missing variable", "export const state = (v) => `${v.nope}`;", /undefined/u],
  ["step() returns an empty label", 'export const step = () => "";', /step\(\) returned ""/u],
  [
    "group() names no color",
    'export const group = () => "Busy";\nexport const colors = {};',
    /group\(\) returned "Busy"/u,
  ],
] satisfies [string, string, RegExp][], ([what, body, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a view whose ${what} stops the command with exit 2`, () => {
    const view = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-view-")), "view.mjs");
    fs.writeFileSync(view, body);
    const r = run(path.join(corpus, "Login"), { view });
    assert.equal(r.status, 2);
    assert.match(r.stderr, words);
  });
});

const writeView = (body: string): string => {
  const view = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-view-")), "view.mjs");
  fs.writeFileSync(view, body);
  return view;
};

visitItems([
  [
    "gives a group a mark class as its color",
    'export const group = () => "Working";\nexport const colors = { Working: "breaks" };',
    /\bWorking\b[\s\S]*"breaks"[\s\S]*\bblue\b[\s\S]*\bpink\b/,
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
    /\bgroup\b[\s\S]*\bcolors\b/,
  ],
  [
    "misspells an export",
    "export const state = (v) => v.main;\nexport const steps = (a) => a;",
    /\bsteps\b[\s\S]*\bstep\b/,
  ],
  ["has a default export", "export default { state: (v) => v.main };", /\bdefault\b/u],
  ["exports colors as a string", 'export const colors = "blue";', /\bcolors\b[\s\S]*\bobject\b/],
  ["exports a number as its title", "export const title = 7;", /\btitle\b[\s\S]*\bstring\b/],
] satisfies [string, string, RegExp][], ([what, body, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a view that ${what} stops the command with exit 2 before TLC runs`, () => {
    const r = run(path.join(corpus, "Login"), { view: writeView(body) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, words);
    assert.deepEqual(r.files, []);
    assert.deepEqual(r.configs, {});
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws null stops the command with exit 2 and no stack trace", () => {
  const r = run(path.join(corpus, "Login"), { view: writeView("throw null;\n") });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, "null\n");
  assert.deepEqual(r.files, []);
  assert.deepEqual(r.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws an object with no prototype stops the command with exit 2", () => {
  const r = run(path.join(corpus, "Login"), {
    view: writeView("throw Object.create(null);\n"),
  });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, "[Object: null prototype] {}\n");
  assert.deepEqual(r.files, []);
  assert.deepEqual(r.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view module that throws a plain object with a message prints the message", () => {
  const r = run(path.join(corpus, "Login"), {
    view: writeView('throw { message: "The view has no states." };\n'),
  });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, "The view has no states.\n");
  assert.deepEqual(r.files, []);
  assert.deepEqual(r.configs, {});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view that ends the check while TLC runs stops TLC, and the command exits 2 and writes nothing", async () => {
  const { java, pidFile } = sleepyJava(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-fakes-")));
  const r = run(path.join(corpus, "Login"), {
    java,
    view: writeView(
      'import fs from "node:fs";\n' +
        `setInterval(() => fs.existsSync(${JSON.stringify(pidFile)}) && process.exit(1), 20);\n` +
        "export const state = (v) => JSON.stringify(v);\n",
    ),
  });
  assert.equal(r.status, 2);
  assert.deepEqual(r.files, []);
  await assertGone(Number(read(pidFile)));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a group that only a mixed chart state gets still needs a color", () => {
  const view = writeView(
    'export const state = (v) => v.main.split(".")[0];\n' +
      'export const group = (v) => v.main.includes("Checking") ? "Checking" : v.main.includes("Wrong") ? "Waiting" : undefined;\n' +
      'export const colors = { Waiting: "blue" };\n',
  );
  const r = run(path.join(corpus, "Login"), { view });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /group\(\) returned "Checking"/u);
  assert.deepEqual(r.files, []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view with a group in a theme color draws that color and names the group in the Legend", () => {
  const view = writeView(
    'export const state = (v) => v.main.split(".");\n' +
      'export const group = (v) => (v.main === "Signed in" ? "Done" : undefined);\n' +
      'export const colors = { Done: "teal" };\n' +
      'export const title = "Login";\n',
  );
  const r = run(path.join(corpus, "Login"), { view });
  assert.equal(r.stderr, "");
  assert.equal(r.status, 0);
  const chart = read(path.join(r.out, "chart.mmd"));
  assert.match(chart, /^title: "Login"$/mu);
  const id = (/^ {2}(s\d+): Signed in$/mu.exec(chart))?.[1];
  assert.match(chart, new RegExp(`^ {2}class ${id} teal$`, "m"));
  const legend = (/^ {4}(lg\d+): Done$/mu.exec(chart))?.[1];
  assert.match(chart, new RegExp(`^ {2}class ${legend} teal$`, "m"));
});

const byX = (labels: unknown[]): string => `export const state = (v) => ${JSON.stringify(labels)}[v.x];\n`;

const fanOut = (n: number): string => {
  const lines = ["strict digraph DiskGraph {", '0 [label="x = 0",style = filled]'];
  for (let i = 1; i <= n; i++)
    {lines.push(
      `${i} [label="x = ${i}"];`,
      `0 -> ${i} [label="Inc",color="black",fontcolor="black"];`,
    );}
  return [...lines, "}"].join("\n");
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a flat view names a label with U+0000 as written when a loop cannot take a step out of it", () => {
  const view = writeView(
    `export const state = (v) => (v.playback === "Stopped" || v.volume === "Muted" ? ${JSON.stringify("a\0b")} : v.playback);\n`,
  );
  const r = run(path.join(corpus, "MediaPlayerProps"), { view });
  assert.equal(r.status, 2);
  assert.equal(
    r.stderr,
    "The chart draws the step TheCallEnds out of a\0b, but the EventuallyPlays loop cannot take it there. Show in a label what stops it.\n",
  );
  assert.deepEqual(r.files, []);
});

visitItems([
  [
    "a parent-state view keeps a label with U+0000 apart from the parent path it spells",
    {
      base: "Counter",
      view: byX([["a\0b"], ["a", "b"], ["c"], ["d"]]),
      status: 0,
      states: ["ab", "a", "b", "c", "d"],
      arrows: ["a start --> b", "ab --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
    },
  ],
  [
    "a regions view keeps a label with U+0000 apart from the parent path it spells, and the report names it as written",
    {
      base: "Counter",
      fanOut: 2,
      view: byX([
        { R: "f", S: "p" },
        { R: ["a\0b"], S: "q" },
        { R: ["a", "b"], S: "r" },
      ]),
      status: 0,
      states: ["R f", "S p", "R ab", "S q", "R a", "R b", "S r"],
      arrows: [
        "R f start --> S p",
        "R ab start --> S q",
        "R b start --> S r",
        "R a start --> R b",
        "S p --> R ab: Inc",
        "S p --> R a: Inc",
      ],
      says: /^The regions chart lets R f, S p go to R a\0b, S r by Inc, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
    },
  ],
  [
    "a flat view with U+0001 in a label draws each arrow between the states it joins",
    {
      base: "Counter",
      view: byX(["a\u0001b", "a", "b", "c"]),
      status: 0,
      states: ["a\u0001b", "a", "b", "c"],
      arrows: ["a\u0001b --> a: Inc", "a --> b: Inc", "b --> c: Inc"],
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
    },
  ],
  [
    "a parent-state view with U+0001 in a label draws the chart",
    {
      base: "Counter",
      view: byX([["a\u0001b"], ["a", "b"], ["c"], ["d"]]),
      status: 0,
      states: ["a\u0001b", "a", "b", "c", "d"],
      arrows: ["a start --> b", "a\u0001b --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
    },
  ],
  [
    "a regions view with U+0001 in a label draws the chart",
    {
      base: "Counter",
      view: byX([
        { R: "a\u0001b", S: "p" },
        { R: "c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
      status: 0,
      states: ["a\u0001b", "c", "d", "e", "p"],
      arrows: ["a\u0001b --> c: Inc", "c --> d: Inc", "d --> e: Inc"],
      says: /^TLC reached 4 states and 3 steps\. The chart draws 5 states and 3 arrows\.$/mu,
    },
  ],
  [
    "a flat view reports a state with U+0002 in its label that breaks a rule",
    {
      base: "FirstRule",
      view: byX(["a", "b\u0002c", "d", "e"]),
      status: 1,
      states: ["a", "b\u0002c", "d", "e"],
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: b\cBc$/mu,
    },
  ],
  [
    "a parent-state view reports a state with U+0002 in its label that breaks a rule",
    {
      base: "FirstRule",
      view: byX([["a"], ["P", "b\u0002c"], ["d"], ["e"]]),
      status: 1,
      states: ["a", "P", "b\u0002c", "d", "e"],
      arrows: ["P start --> b\u0002c", "a --> P: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: P \/ b\cBc$/mu,
    },
  ],
  [
    "a regions view reports a state with U+0002 in its label that breaks a rule",
    {
      base: "FirstRule",
      view: byX([
        { R: "a", S: "p" },
        { R: "b\u0002c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
      status: 1,
      states: ["a", "b\u0002c", "d", "e", "p"],
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. R a, S p\n1\. Next: R b\cBc, S p$/mu,
    },
  ],
  [
    "a regions view with U+0003 in labels draws parent states when the regions chart would invent a move",
    {
      base: "Counter",
      fanOut: 4,
      view:
        `${byX([
          { R: "f", S: "p" },
          { R: "a", S: "r" },
          { R: "b", S: "q" },
          { R: "X\u0003a", S: "q" },
          { R: "X\u0003b", S: "r" },
        ])
        }export const step = (action, from, to) => (to.x <= 2 ? ${JSON.stringify("Go\u0003X")} : "Go");\n`,
      status: 0,
      states: ["R f", "S p", "R a", "S r", "R b", "S q", "R X\u0003a", "S q", "R X\u0003b", "S r"],
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
      says: /^The regions chart lets R f, S p go to R a, S q by Go\cCX, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
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
][], ([what, c]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(what, () => {
    const width = "fanOut" in c ? c.fanOut : undefined;
    const dir = width
      ? copyCase(c.base, (d) => fs.writeFileSync(path.join(d, "graph.dot"), fanOut(width)))
      : path.join(corpus, c.base);
    const r = run(dir, { view: writeView(c.view) });
    assert.equal(r.stderr, "");
    assert.equal(r.status, c.status);
    assert.deepEqual(drawn(read(path.join(r.out, "chart.mmd"))), {
      states: c.states,
      arrows: c.arrows,
    });
    assert.match(r.report, c.says);
  });
});

visitItems([
  ["an unknown option", ["--bogus"], /Unknown option '--bogus'[\s\S]*Usage:/],
  ["a second spec", ["Other.tla"], /Give one SPEC\.tla\.[\s\S]*Usage:/],
  [
    "a config that does not exist",
    ["--config", "Missing.cfg"],
    /Cannot find the TLC config Missing\.cfg/u,
  ],
] satisfies [string, string[], RegExp][], ([what, args, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${what} stops the command with exit 2 before TLC runs`, () => {
    const r = run(path.join(corpus, "Login"), { args });
    assert.equal(r.status, 2);
    assert.match(r.stderr, words);
    assert.deepEqual(r.configs, {});
  });
});

const contents = (p: string) => {
  const stat = fs.lstatSync(p);
  if (stat.isSymbolicLink()) {return fs.readlinkSync(p);}
  if (!stat.isDirectory()) {return read(p);}
  const files: Record<string, string> = {};
  visitItems(fs.readdirSync(p), (fileName) => {files[fileName] = read(path.join(p, fileName));});
  return files;
};
const newPath = (): string => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "statechart-out-")), "out");

visitItems([
  [
    "a folder of the user's files",
    (out) => {
      fs.mkdirSync(out);
      fs.writeFileSync(path.join(out, ".bashrc"), "export PATH\n");
      fs.writeFileSync(path.join(out, "report.md"), "# My quarterly report\n");
      fs.writeFileSync(path.join(out, "tlc-Build.out"), "build log\n");
    },
    /is not empty\. It has \.bashrc\./u,
  ],
  [
    "a folder that holds only a dotfile",
    (out) => {
      fs.mkdirSync(out);
      fs.writeFileSync(path.join(out, ".bashrc"), "export PATH\n");
    },
    /is not empty\. It has \.bashrc\./u,
  ],
  [
    "the folder of an earlier run",
    (out) =>
      assert.equal(run(path.join(corpus, "MediaPlayerProps"), { args: ["--out", out] }).status, 1),
    /is not empty\. It has chart\.mmd\./u,
  ],
  [
    "a file",
    (out) => fs.writeFileSync(out, "keep me\n"),
    /cannot be the output folder\. ENOTDIR: not a directory/u,
  ],
  [
    "a broken link",
    (out) => fs.symlinkSync(path.join(path.dirname(out), "gone"), out),
    /cannot be the output folder\. It is a broken link\./u,
  ],
] satisfies [string, (out: string) => void, RegExp][], ([what, make, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`an --out that is ${what} stops the command with exit 2 before TLC runs, and keeps what is there`, () => {
    const out = newPath();
    make(out);
    const before = contents(out);
    const r = run(path.join(corpus, "Login"), { args: ["--out", out] });
    assert.equal(r.status, 2);
    assert.ok(r.stderr.includes(out), r.stderr);
    assert.match(r.stderr, words);
    assert.match(r.stderr, /Pass --out with a new folder\.\n$/u);
    assert.deepEqual(r.configs, {});
    assert.deepEqual(contents(out), before);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a file that appears in --out while TLC runs is kept, and the command stops with exit 2", () => {
  const out = newPath();
  const mine = path.join(out, "report.md");
  const java = path.join(path.dirname(out), "java.sh");
  fs.writeFileSync(
    java,
    `#!/bin/sh\nmkdir -p ${JSON.stringify(out)}\n` +
      `[ -e ${JSON.stringify(mine)} ] || echo mine > ${JSON.stringify(mine)}\n` +
      `exec ${JSON.stringify(path.join(here, "java.ts"))} "$@"\n`,
    { mode: 0o755 },
  );
  const r = run(path.join(corpus, "Login"), { args: ["--out", out], java });
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(mine), r.stderr);
  assert.equal(read(mine), "mine\n");
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an empty --out folder gets the chart and the report", () => {
  const out = newPath();
  fs.mkdirSync(out);
  const r = run(path.join(corpus, "Login"), { args: ["--out", out] });
  assert.equal(r.stderr, "");
  assert.equal(read(path.join(out, "report.md")), read(path.join(corpus, "Login", "report.md")));
  assert.deepEqual(fs.readdirSync(out).sort(), ["chart.mmd", "report.md", "tlc.out"]);
});

visitItems([
  [
    "a misspelled first keyword",
    "\\* The rules\nINVARIENT NeverLocked\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 2\. It was expecting a keyword, but did not find it\.$/m,
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
    /Login\.cfg at line 1\..*"-"/,
  ],
  [
    "both SPECIFICATION and NEXT",
    "SPECIFICATION Spec\nNEXT Next\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file cannot specify both INIT\/NEXT and SPECIFICATION fields\.$/m,
  ],
  [
    "no SPECIFICATION and no INIT",
    "\\* The rules\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file did not specify the initial state predicate\.$/m,
  ],
  [
    "an operator constant with no arguments",
    "CONSTANT f() = 1\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 1\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/m,
  ],
  [
    "operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\n\nCONSTANT f(1, 2 = 3\n",
    /^TLC refuses .*Login\.cfg at line 3\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/m,
  ],
  [
    "a CONSTANT keyword on its own line before operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\nCONSTANT\nf(1, 2\n= 3\n",
    /^TLC refuses .*Login\.cfg at line 2\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/m,
  ],
  [
    "a comma invariant before a CHECK_DEADLOCK value in lower case",
    "SPECIFICATION Spec\nINVARIANT ,\nCHECK_DEADLOCK false\n",
    /Login\.cfg at line 3\. It was expecting TRUE or FALSE, but did not find it\./u,
  ],
  [
    "a comment that does not end",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n(* The view\nVIEW vars\n",
    /Login\.cfg at line 3\..*\bcomment\b/,
  ],
  [
    "CHECK_DEADLOCK FALSE in a comment that does not end",
    "INVARIANT TypeOK\nSPECIFICATION Spec\n(* CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. A comment starts here and does not end\./u,
  ],
  [
    "a no-break space before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n\u00A0CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. It cannot read the character "\u00A0" \(U\+00A0\) outside a string\./,
  ],
  [
    "a line separator before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\u2028CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 2\. It cannot read the character "\u2028" \(U\+2028\) outside a string\./,
  ],
  [
    "a byte order mark",
    "\uFEFFSPECIFICATION Spec\nINVARIANT TypeOK\n",
    /Login\.cfg at line 1\. The file starts with a byte order mark\. Save it as UTF-8 without one\.$/mu,
  ],
] satisfies [string, string, RegExp][], ([what, config, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a config with ${what} stops the command with exit 2 before TLC runs`, () => {
    const dir = copyCase("Login", (d) => fs.writeFileSync(path.join(d, "Login.cfg"), config));
    const r = run(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, words);
    assert.deepEqual(r.configs, {});
    assert.deepEqual(r.files, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a nested comment hides all of its text, as in TLC", () => {
  const dir = copyCase("Login", (d) => {
    const file = path.join(d, "Login.cfg");
    fs.writeFileSync(file, `(* Off: (* old *) CHECK_DEADLOCK FALSE *)\n${read(file)}`);
  });
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.report, read(path.join(corpus, "Login", "report.md")));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a string constant keeps the keywords and comment markers in it", () => {
  const dir = copyCase("TwoPhase", (d) =>
    fs.writeFileSync(
      path.join(d, "TwoPhase.cfg"),
      'CONSTANT RM = {"INVARIANT (*", "\\\\* r2"}\nSPECIFICATION TPSpec\nINVARIANT TPTypeOK TCConsistent\n',
    ),
  );
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.equal(r.report, read(path.join(corpus, "TwoPhase", "report.md")));
  assert.match(r.configs.ChartRun, /^CONSTANT RM = .*"INVARIANT \(\*".*"\\\\\* r2"/m);
  assert.deepEqual(r.configs.ChartRun.match(/^INVARIANT.*$/gm), ["INVARIANT ChartMark"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TYPE and TYPE_CONSTRAINT are config keywords, as in TLC", () => {
  const dir = copyCase("Login", (d) =>
    fs.writeFileSync(
      path.join(d, "Login.cfg"),
      "SPECIFICATION Spec\nINVARIANT TypeOK\nTYPE TypeOK\nTYPE_CONSTRAINT TypeOK\nVIEW vars\n",
    ),
  );
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.report, read(path.join(corpus, "Login", "report.md")));
  assert.match(r.configs.ChartRun, /^TYPE TypeOK$/mu);
  assert.match(r.configs.ChartRun, /^TYPE_CONSTRAINT TypeOK$/mu);
});
