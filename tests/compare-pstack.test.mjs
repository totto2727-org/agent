import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("a renamed skill is compared under its original name, including the license, without shipping an alias", (t) => {
  const scratch = fileURLToPath(new URL("../tmp/", import.meta.url));
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "pstack-rename-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = join(root, "upstream");
  const local = join(root, "plugins/example/skills/local-name");
  for (const path of [
    join(upstream, "skills/original-name"),
    local,
    join(root, "scripts"),
    join(root, "docs"),
  ])
    mkdirSync(path, { recursive: true });
  const cli = join(root, "scripts/compare-pstack.mjs");
  copyFileSync(new URL("../scripts/compare-pstack.mjs", import.meta.url), cli);
  writeFileSync(join(upstream, "LICENSE"), "test notice\n");
  writeFileSync(join(upstream, "skills/original-name/SKILL.md"), "Original\n");
  const git = (...args) => execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8" });
  git("init", "--quiet");
  git("add", ".");
  git(
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "-qm",
    "fixture",
  );
  writeFileSync(
    join(root, "docs/upstream-differences.md"),
    `backnotprop/pstack/commit/${git("rev-parse", "HEAD").trim()}\nRenamed upstream skill: \`original-name\` → \`local-name\`.\n`,
  );
  writeFileSync(join(local, "SKILL.md"), "Local adaptation\n");
  copyFileSync(join(upstream, "LICENSE"), join(local, "LICENSE"));
  const compare = () => spawnSync(process.execPath, [cli, upstream], { encoding: "utf8" });
  const success = compare();
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Adapted: skills\/original-name\/SKILL\.md/u);
  writeFileSync(join(local, "LICENSE"), "wrong notice\n");
  const missingNotice = compare();
  assert.equal(missingNotice.status, 1);
  assert.match(missingNotice.stderr, /MIT notice: original-name/u);
  mkdirSync(join(local, "../original-name"));
  const alias = compare();
  assert.notEqual(alias.status, 0);
  assert.match(alias.stderr, /still shipped as an alias/u);
});
