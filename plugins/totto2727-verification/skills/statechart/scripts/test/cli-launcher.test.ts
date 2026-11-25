// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { mkdtemp } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from "#statechart/ir.ts";
import { runChild } from "#statechart/run.ts";
import { FIXTURE_PROCESS_OPTIONS, forEachTlcCase } from "./tlc.ts";
import { CHECK_PASSED, NO_COMPATIBLE_RUNTIME, RULE_BROKEN, corpus, here, read, run } from "./cli-fixtures.ts";

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
  const temporary = await mkdtemp(path.join(os.tmpdir(), "statechart-links-"));
  // Relative symlink targets are resolved from the directory on disk. macOS aliases /var to /private/var.
  const links = await fs.promises.realpath(temporary);
  const target = await fs.promises.realpath(launcher);
  const [first, second] = [path.join(links, "a"), path.join(links, "b")];
  await fs.promises.mkdir(first);
  await fs.promises.mkdir(second);
  await fs.promises.symlink(path.relative(second, target), path.join(second, "statechart"));
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
    assert.equal(result.status, RULE_BROKEN, result.error?.message);
    assert.equal(await read(path.join(result.out, "chart.mmd")), await read(path.join(dir, "chart.mmd")));
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
