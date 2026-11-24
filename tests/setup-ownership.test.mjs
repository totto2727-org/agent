import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
import { join } from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The setup ownership suite runs directly on Node.
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(
  new URL("../plugins/totto2727-tools/skills/totto2727-setup/setup.mjs", import.meta.url),
);
const scratch = fileURLToPath(new URL("../tmp/", import.meta.url));
const pristine = "# Installed\n";
// A version 1 receipt for a directory containing only the non-executable SKILL.md above.
const originalHash = "e6146b62641eef31d936be6aa402ad783b247ad94505bafb64929211c516a284";
const commit = "a".repeat(40);
const lockEntry = (name, source = "totto2727-org/agent") => ({
  source,
  sourceType: "github",
  ref: commit,
  commit,
  skillPath: `skills/${name}/SKILL.md`,
  installMode: "copy",
});

const fixture = async function (t) {
  await mkdir(scratch, { recursive: true });
  const base = await realpath(await mkdtemp(join(scratch, "setup-ownership-")));
  t.after(() => rm(base, { force: true, recursive: true }));
  const root = join(base, "project");
  const home = join(base, "home");
  await Promise.all([mkdir(root), mkdir(home)]);
  const uninstall = () =>
    spawnSync(process.execPath, [cli, "uninstall", "--scope", "project"], {
      cwd: root,
      encoding: "utf8",
      env: {
        HOME: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        PATH: join(base, "no-executables"),
      },
      timeout: 10_000,
    });
  return { root, home, uninstall };
};

const skill = async function (parent, name, content) {
  const dir = join(parent, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), content, { mode: 0o644 });
};

// oxlint-disable-next-line typescript/no-floating-promises -- The setup ownership suite registers this test with Node's runner.
test("project uninstall retains user files, replacement sources, and links into another scope", async (t) => {
  const { root, home, uninstall } = await fixture(t);
  const dest = join(root, ".agents", "skills");
  const external = join(home, ".agents", "skills");
  const edited = "# User edits\nDo not delete.\n";
  const user = "# Unowned local notes\n";
  await skill(dest, "unowned", user);
  await skill(dest, "edited", edited);
  await skill(dest, "replaced", pristine);
  await skill(external, "linked", pristine);
  await symlink(join(external, "linked"), join(dest, "linked"), "dir");
  const globalLock = join(home, ".agents", ".skill-lock.json");
  const globalBytes = JSON.stringify({
    version: 3,
    skills: { linked: lockEntry("linked", "another/project") },
  });
  await writeFile(globalLock, globalBytes);
  const names = ["edited", "linked", "replaced"];
  const owned = Object.fromEntries(
    names.map((currentName) => [currentName, { lock: lockEntry(currentName), hash: originalHash }]),
  );
  const receipt = join(root, ".agents", "totto2727-setup.json");
  await writeFile(receipt, JSON.stringify({ version: 1, scope: "project", root, owned }));
  const entries = Object.fromEntries([...names, "unowned"].map((n) => [n, lockEntry(n)]));
  entries.replaced = lockEntry("replaced", "user/replacement");
  const lock = join(root, "skills-lock.json");
  const initialLock = `${JSON.stringify({ version: 2, skills: entries }, null, 2)}\n`;
  await writeFile(lock, initialLock);

  const result = uninstall();
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.equal(await readFile(lock, "utf8"), initialLock);
  assert.equal(await readFile(globalLock, "utf8"), globalBytes);
  assert.equal(await readFile(join(dest, "unowned/SKILL.md"), "utf8"), user);
  assert.equal(await readFile(join(dest, "edited/SKILL.md"), "utf8"), edited);
  assert.equal(await readFile(join(dest, "replaced/SKILL.md"), "utf8"), pristine);
  assert.equal(await readlink(join(dest, "linked")), join(external, "linked"));
  assert.equal(await readFile(join(external, "linked/SKILL.md"), "utf8"), pristine);
});

// oxlint-disable-next-line typescript/no-floating-promises -- The setup ownership suite registers this test with Node's runner.
test("project uninstall refuses a receipt copied from another scope without changing either scope", async (t) => {
  const { root, home, uninstall } = await fixture(t);
  const name = "shared";
  for (const base of [root, home]) {
    await skill(join(base, ".agents/skills"), name, pristine);
  }
  const foreignReceipt = JSON.stringify({
    version: 1,
    scope: "global",
    root: home,
    owned: { [name]: { lock: lockEntry(name), hash: originalHash } },
  });
  const receipt = join(root, ".agents/totto2727-setup.json");
  const original = join(home, ".agents/totto2727-setup.json");
  await Promise.all([writeFile(receipt, foreignReceipt), writeFile(original, foreignReceipt)]);
  const result = uninstall();
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  for (const path of [receipt, original]) {
    assert.equal(await readFile(path, "utf8"), foreignReceipt);
  }
  for (const base of [root, home]) {
    assert.equal(await readFile(join(base, ".agents/skills/shared/SKILL.md"), "utf8"), pristine);
  }
});

// oxlint-disable-next-line typescript/no-floating-promises -- Node's test runner owns the Promise for this top-level registration.
test("uninstall leaves Orca's host-provided guides and their lock entries intact", async (t) => {
  const { root, uninstall } = await fixture(t);
  const names = ["orca-cli", "orchestration"];
  const entries = {};
  const owned = {};
  for (const currentName of names) {
    await skill(join(root, ".agents/skills"), currentName, pristine);
    entries[currentName] = lockEntry(currentName, "stablyai/orca");
    owned[currentName] = { lock: entries[currentName], hash: originalHash };
  }
  const receipt = join(root, ".agents/totto2727-setup.json");
  const lock = join(root, "skills-lock.json");
  const bytes = JSON.stringify({ version: 2, skills: entries });
  await writeFile(receipt, JSON.stringify({ version: 1, scope: "project", root, owned }));
  await writeFile(lock, bytes);
  const result = uninstall();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(lock, "utf8"), bytes);
  for (const currentName of names)
    assert.equal(
      await readFile(join(root, ".agents/skills", currentName, "SKILL.md"), "utf8"),
      pristine,
    );
  await assert.rejects(readFile(receipt), { code: "ENOENT" });
});
