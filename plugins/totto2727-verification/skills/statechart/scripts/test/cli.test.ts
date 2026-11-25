// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, symlink, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { pathToFileURL } from "node:url";
import { visitItems } from "#statechart/ir.ts";
import { fileExists } from "#statechart/run.ts";
import { forEachTlcCase } from "./tlc.ts";
import { COMMAND_ERROR, RULE_BROKEN, corpus, here, read, run } from "./cli-fixtures.ts";

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a java that cannot start stops the command with exit 2 on a runtime that emits no close for it", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "statechart-no-java-"));
  const noClose = path.join(tmp, "no-close.mjs");
  await writeFile(
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
  const stat = await lstat(output);
  if (stat.isSymbolicLink()) {return readlink(output);}
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
      await mkdir(out);
      await writeFile(path.join(out, ".bashrc"), "export PATH\n");
      await writeFile(path.join(out, "report.md"), "# My quarterly report\n");
      await writeFile(path.join(out, "tlc-Build.out"), "build log\n");
    },
    /is not empty\. It has \.bashrc\./u,
  ],
  [
    "a folder that holds only a dotfile",
    async (out) => {
      await mkdir(out);
      await writeFile(path.join(out, ".bashrc"), "export PATH\n");
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
    async (out) => {await writeFile(out, "keep me\n");},
    /cannot be the output folder\. ENOTDIR: not a directory/u,
  ],
  [
    "a broken link",
    async (out) => {await symlink(path.join(path.dirname(out), "gone"), out);},
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
  await writeFile(
    java,
    `#!/bin/sh\nmkdir -p ${JSON.stringify(out)}\n` +
      `[ -e ${JSON.stringify(mine)} ] || echo mine > ${JSON.stringify(mine)}\n` +
      `exec ${JSON.stringify(path.join(here, "java.ts"))} "$@"\n`,
    { mode: 0o755 },
  );
  const result = await run(path.join(corpus, "Login"), { args: ["--out", out], java });
  assert.equal(result.status, COMMAND_ERROR);
  assert.ok(result.stderr.includes(mine), result.stderr);
  assert.equal(await read(mine), "mine\n");
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an empty --out folder gets the chart and the report", async () => {
  const out = await newPath();
  await mkdir(out);
  const result = await run(path.join(corpus, "Login"), { args: ["--out", out] });
  assert.equal(result.stderr, "");
  assert.equal(await read(path.join(out, "report.md")), await read(path.join(corpus, "Login", "report.md")));
  const files = await readdir(out);
  assert.deepEqual(files.toSorted(), ["chart.mmd", "report.md", "tlc.out"]);
});
