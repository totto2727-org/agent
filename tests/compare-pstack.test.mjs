// oxlint-disable-next-line rules/no-node-imports -- The workspace's Node suite uses native assertions for the installed script's outputs and failures.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Exercise the real Git and Node subprocesses in the disposable fixture.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Build and remove the independent checkout used by this fixture.
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the disposable checkout using the host path conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- CI runs this CLI comparison through Node's built-in test runner.
import test from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the fixture root relative to this test.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await each fixture Git command using Node's native child-process adapter.
import { promisify } from "node:util";

// oxlint-disable-next-line typescript/strict-void-return -- Node's execFile provides a custom promisify implementation that owns its ChildProcess.
const execute = promisify(execFile);

const SUCCESS = 0;
const MISSING_FILES = 1;

/** @type {(upstream: string, args: string[]) => Promise<string>} */
const git = async (upstream, args) => {
  const { stdout } = await execute("git", ["-C", upstream, ...args], { encoding: "utf8" });
  return stdout;
};

/** @type {(upstream: string) => Promise<string>} */
const createMirror = async (upstream) => {
  await writeFile(path.join(upstream, "LICENSE"), "test notice\n");
  await writeFile(path.join(upstream, "skills/retired/SKILL.md"), "Retired\n");
  await writeFile(path.join(upstream, "skills/kept/SKILL.md"), "Original\n");
  await git(upstream, ["init", "--quiet"]);
  await git(upstream, ["add", "."]);
  await git(upstream, [
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "-qm",
    "fixture",
  ]);
  const revision = await git(upstream, ["rev-parse", "HEAD"]);
  return revision.trim();
};

/** @type {(testContext: import("node:test").TestContext) => Promise<string>} */
const temporaryCheckout = async (testContext) => {
  const scratch = fileURLToPath(new URL("../tmp/", import.meta.url));
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(path.join(scratch, "pstack-rename-"));
  testContext.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  return root;
};

/** @typedef {{ cli: string, local: string, upstream: string }} ComparisonFixture */

/** @type {(root: string) => Promise<ComparisonFixture>} */
const prepareFixture = async (root) => {
  const upstream = path.join(root, "upstream");
  const local = path.join(root, "plugins/example/skills/kept");
  await Promise.all(
    [
      path.join(upstream, "skills/retired"),
      path.join(upstream, "skills/kept"),
      local,
      path.join(root, "scripts"),
      path.join(root, "docs"),
    ].map(async (directory) => {
      await mkdir(directory, { recursive: true });
    }),
  );
  const base = await createMirror(upstream);
  const cli = path.join(root, "scripts/compare-pstack.mjs");
  await copyFile(new URL("../scripts/compare-pstack.mjs", import.meta.url), cli);
  await writeFile(
    path.join(root, "docs/upstream-differences.md"),
    `backnotprop/pstack/commit/${base}\nRetired upstream skill: \`retired\`.\n`,
  );
  await writeFile(path.join(local, "SKILL.md"), "Local adaptation\n");
  await copyFile(path.join(upstream, "LICENSE"), path.join(local, "LICENSE"));
  return { cli, local, upstream };
};

/** @typedef {{ status: number | null, stderr: string, stdout: string }} Result */

/** @type {(fixture: ComparisonFixture) => Promise<Result>} */
const compare = async ({ cli, upstream }) => {
  /** @type {PromiseWithResolvers<Result>} */
  const { promise, resolve } = Promise.withResolvers();
  const subprocess = execFile(
    process.execPath,
    [cli, upstream],
    { encoding: "utf8" },
    (_error, stdout, stderr) => {
      resolve({ status: subprocess.exitCode, stderr, stdout });
    },
  );
  return promise;
};

/** @type {(fixture: ComparisonFixture) => Promise<void>} */
const verifyMissingNotice = async (fixture) => {
  await writeFile(path.join(fixture.local, "LICENSE"), "wrong notice\n");
  const missingNotice = await compare(fixture);
  assert.equal(missingNotice.status, MISSING_FILES);
  assert.match(missingNotice.stderr, /MIT notice: kept/u);
};

/** @type {(fixture: ComparisonFixture) => Promise<void>} */
const verifyRestoredRetirement = async (fixture) => {
  const retired = path.join(fixture.local, "../retired");
  await mkdir(retired);
  await writeFile(path.join(retired, "SKILL.md"), "Reintroduced\n");
  const alias = await compare(fixture);
  assert.notEqual(alias.status, SUCCESS);
  assert.match(alias.stderr, /Retired upstream skill still shipped/u);
};

// oxlint-disable-next-line typescript/no-floating-promises -- Node's test runner owns the Promise for this top-level registration.
test("a retired skill stays absent while every distributed skill keeps its notice", async (testContext) => {
  const root = await temporaryCheckout(testContext);
  const fixture = await prepareFixture(root);
  const success = await compare(fixture);
  assert.equal(success.status, SUCCESS, success.stderr);
  assert.match(success.stdout, /Adapted: skills\/kept\/SKILL\.md/u);
  await verifyMissingNotice(fixture);
  await verifyRestoredRetirement(fixture);
});
