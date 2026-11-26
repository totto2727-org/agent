// oxlint-disable-next-line rules/no-node-imports -- The workspace's Node suite uses native assertions for the installed script's outputs and failures.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- The Node setup fixtures use this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- The Node setup fixtures use this built-in to await writes and reads through the host filesystem.
import {
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The Node setup fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The setup ownership suite runs directly on Node.
import test from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- The Node setup fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(
  new URL("../plugins/totto2727-tools/skills/totto2727-setup/setup.mjs", import.meta.url),
);
const scratch = fileURLToPath(new URL("../tmp/", import.meta.url));
const pristine = "# Installed\n";
// A version 1 receipt for a directory containing only the non-executable SKILL.md above.
const originalHash = "e6146b62641eef31d936be6aa402ad783b247ad94505bafb64929211c516a284";
const COMMIT_WIDTH = 40;
const COMMIT = "a".repeat(COMMIT_WIDTH);
const SUCCESS = 0;
const PROJECT_LOCK_VERSION = 2;
const GLOBAL_LOCK_VERSION = 3;
const RECEIPT_VERSION = 1;
const JSON_INDENT = 2;

/** @typedef {ReturnType<typeof lockEntry>} Entry */
/** @typedef {{ root: string, home: string, uninstall: () => import("node:child_process").SpawnSyncReturns<string> }} Fixture */
/** @typedef {{ hash: string, lock: Entry }} Ownership */

/** @type {(name: string, source?: string) => { commit: string, installMode: string, ref: string, skillPath: string, source: string, sourceType: string }} */
const lockEntry = (name, source = "totto2727-org/agent") => ({
  commit: COMMIT,
  installMode: "copy",
  ref: COMMIT,
  skillPath: `skills/${name}/SKILL.md`,
  source,
  sourceType: "github",
});

/** @type {(root: string, home: string, base: string) => import("node:child_process").SpawnSyncReturns<string>} */
const runUninstall = (root, home, base) =>
  // oxlint-disable-next-line node/no-sync -- Capture the real CLI's status and errors after fixture setup completes.
  spawnSync(process.execPath, [cli, "uninstall", "--scope", "project"], {
    cwd: root,
    encoding: "utf8",
    env: {
      HOME: home,
      PATH: path.join(base, "no-executables"),
      XDG_CONFIG_HOME: path.join(home, ".config"),
    },
    timeout: 10_000,
  });

/** @type {(context: import("node:test").TestContext) => Promise<Fixture>} */
const fixture = async (context) => {
  await mkdir(scratch, { recursive: true });
  const base = await realpath(await mkdtemp(path.join(scratch, "setup-ownership-")));
  context.after(async () => {
    await rm(base, { force: true, recursive: true });
  });
  const root = path.join(base, "project");
  const home = path.join(base, "home");
  await Promise.all([mkdir(root), mkdir(home)]);
  return { home, root, uninstall: () => runUninstall(root, home, base) };
};

/** @type {(root: string) => string} */
const skillsDirectory = (root) => path.join(root, ".agents", "skills");
/** @type {(root: string) => string} */
const receiptFile = (root) => path.join(root, ".agents", "totto2727-setup.json");
/** @type {(root: string) => string} */
const projectLock = (root) => path.join(root, "skills-lock.json");
/** @type {(dir: string, name: string, content: string) => [string, string]} */
const expectedSkill = (dir, name, content) => [path.join(dir, name, "SKILL.md"), content];
/** @type {(parent: string, name: string, content: string) => Promise<void>} */
const skill = async (parent, name, content) => {
  const dir = path.join(parent, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), content, { mode: 0o644 });
};

/** @type {(name: string, source?: string) => Ownership} */
const receiptEntry = (name, source) => ({ hash: originalHash, lock: lockEntry(name, source) });

/** @type {(root: string, scope: string, owned: Record<string, Ownership>) => string} */
const receiptText = (root, scope, owned) =>
  JSON.stringify({ owned, root, scope, version: RECEIPT_VERSION });

/** @type {(files: ReadonlyArray<readonly [string, string]>) => Promise<void>} */
const assertContents = async (files) => {
  await Promise.all(
    files.map(async ([filename, text]) => {
      assert.equal(await readFile(filename, "utf8"), text);
    }),
  );
};

const edited = "# User edits\nDo not delete.\n";
const user = "# Unowned local notes\n";

/** @type {(dest: string, external: string) => Promise<void>} */
const installMixedSkills = async (dest, external) => {
  await Promise.all([
    skill(dest, "unowned", user),
    skill(dest, "edited", edited),
    skill(dest, "replaced", pristine),
    skill(external, "linked", pristine),
  ]);
  await symlink(path.join(external, "linked"), path.join(dest, "linked"), "dir");
};

/** @type {(root: string) => Promise<[string, string]>} */
const writeMixedOwnership = async (root) => {
  const names = ["edited", "linked", "replaced"];
  const owned = Object.fromEntries(names.map((name) => [name, receiptEntry(name)]));
  await writeFile(receiptFile(root), receiptText(root, "project", owned));
  const entries = Object.fromEntries([...names, "unowned"].map((name) => [name, lockEntry(name)]));
  entries.replaced = lockEntry("replaced", "user/replacement");
  const lock = projectLock(root);
  const initialLock = `${JSON.stringify({ skills: entries, version: PROJECT_LOCK_VERSION }, undefined, JSON_INDENT)}\n`;
  await writeFile(lock, initialLock);
  return [lock, initialLock];
};

/** @type {(home: string) => Promise<[string, string]>} */
const writeExternalLock = async (home) => {
  const globalLock = path.join(home, ".agents", ".skill-lock.json");
  const bytes = JSON.stringify({
    skills: { linked: lockEntry("linked", "another/project") },
    version: GLOBAL_LOCK_VERSION,
  });
  await writeFile(globalLock, bytes);
  return [globalLock, bytes];
};

// oxlint-disable-next-line typescript/no-floating-promises -- The setup ownership suite registers this test with Node's runner.
test("project uninstall retains user files, replacement sources, and links into another scope", async (context) => {
  const { root, home, uninstall } = await fixture(context);
  const dest = skillsDirectory(root);
  const external = skillsDirectory(home);
  await installMixedSkills(dest, external);
  const externalLock = await writeExternalLock(home);
  const lock = await writeMixedOwnership(root);
  const result = uninstall();
  assert.equal(result.status, SUCCESS, result.stderr || String(result.error));
  await assertContents([
    lock,
    externalLock,
    expectedSkill(dest, "unowned", user),
    expectedSkill(dest, "edited", edited),
    expectedSkill(dest, "replaced", pristine),
    expectedSkill(external, "linked", pristine),
  ]);
  assert.equal(await readlink(path.join(dest, "linked")), path.join(external, "linked"));
});

/** @type {(root: string, home: string) => Promise<Array<[string, string]>>} */
const copyForeignReceipt = async (root, home) => {
  const name = "shared";
  const scopes = [root, home];
  await Promise.all(
    scopes.map(async (base) => {
      await skill(skillsDirectory(base), name, pristine);
    }),
  );
  const text = receiptText(home, "global", { [name]: receiptEntry(name) });
  await Promise.all(
    scopes.map(async (base) => {
      await writeFile(receiptFile(base), text);
    }),
  );
  return scopes.flatMap((base) => [
    [receiptFile(base), text],
    [path.join(skillsDirectory(base), name, "SKILL.md"), pristine],
  ]);
};

// oxlint-disable-next-line typescript/no-floating-promises -- The setup ownership suite registers this test with Node's runner.
test("project uninstall refuses a receipt copied from another scope without changing either scope", async (context) => {
  const { root, home, uninstall } = await fixture(context);
  const original = await copyForeignReceipt(root, home);
  const result = uninstall();
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, SUCCESS);
  await assertContents(original);
});

/** @type {(root: string, names: string[]) => Promise<Array<[string, string]>>} */
const installOrcaGuides = async (root, names) => {
  const dest = skillsDirectory(root);
  const source = "stablyai/orca";
  await Promise.all(
    names.map(async (name) => {
      await skill(dest, name, pristine);
    }),
  );
  const skills = Object.fromEntries(names.map((name) => [name, lockEntry(name, source)]));
  const owned = Object.fromEntries(names.map((name) => [name, receiptEntry(name, source)]));
  const bytes = JSON.stringify({ skills, version: PROJECT_LOCK_VERSION });
  const lock = projectLock(root);
  await writeFile(receiptFile(root), receiptText(root, "project", owned));
  await writeFile(lock, bytes);
  return [[lock, bytes], ...names.map((name) => expectedSkill(dest, name, pristine))];
};

// oxlint-disable-next-line typescript/no-floating-promises -- Node's test runner owns the Promise for this top-level registration.
test("uninstall leaves Orca's host-provided guides and their lock entries intact", async (context) => {
  const { root, uninstall } = await fixture(context);
  const original = await installOrcaGuides(root, ["orca-cli", "orchestration"]);
  const result = uninstall();
  assert.equal(result.status, SUCCESS, result.stderr);
  await assertContents(original);
  await assert.rejects(readFile(receiptFile(root)), { code: "ENOENT" });
});
