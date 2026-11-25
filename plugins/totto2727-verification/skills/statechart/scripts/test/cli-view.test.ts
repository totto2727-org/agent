// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- The test runner awaits the host filesystem around the CLI child process.
import { mkdtemp } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from "#statechart/ir.ts";
import { CHECK_PASSED, COMMAND_ERROR, RULE_BROKEN, corpus, read, run, sleepyJava, writeView } from "./cli-fixtures.ts";
import { assertGone } from "./cli-native-process.ts";

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a step hidden by the view is not drawn, and the report counts it", async () => {
  const dir = path.join(corpus, "MediaPlayer");
  const dot = await read(path.join(dir, "graph.dot"));
  const hidden = new Set(dot.match(/^.* -> .*label="ACallComesIn"/gmu)).size;
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
  assert.doesNotMatch(await read(path.join(result.out, "chart.mmd")), /a call comes in/u);
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
  await assertGone(Number(await read(pidFile)));
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
  const chart = await read(path.join(result.out, "chart.mmd"));
  assert.match(chart, /^title: "Login"$/mu);
  const stateId = /^ {2}(?<id>s\d+): Signed in$/mu.exec(chart)?.groups?.id;
  assert.match(chart, new RegExp(`^ {2}class ${stateId} teal$`, "mu"));
  const legend = /^ {4}(?<id>lg\d+): Done$/mu.exec(chart)?.groups?.id;
  assert.match(chart, new RegExp(`^ {2}class ${legend} teal$`, "mu"));
});
