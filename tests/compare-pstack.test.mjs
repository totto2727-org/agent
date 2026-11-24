// oxlint-disable-next-line rules/no-node-imports -- The workspace's Node suite uses native assertions for the installed script's outputs and failures.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- CI runs this CLI comparison through Node's built-in test runner.
import test from "node:test";
import { fileURLToPath } from "node:url";

// oxlint-disable-next-line typescript/no-floating-promises -- Node's test runner owns the Promise for this top-level registration.
test("a retired skill stays absent while every distributed skill keeps its notice", (t) => {
  const scratch = fileURLToPath(new URL("../tmp/", import.meta.url));
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "pstack-rename-"));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const upstream = join(root, "upstream");
  const local = join(root, "plugins/example/skills/kept");
  Iterator.from([
    join(upstream, "skills/retired"),
    join(upstream, "skills/kept"),
    local,
    join(root, "scripts"),
    join(root, "docs"),
  ]).forEach((path) => {
    mkdirSync(path, { recursive: true });
  });
  const cli = join(root, "scripts/compare-pstack.mjs");
  copyFileSync(new URL("../scripts/compare-pstack.mjs", import.meta.url), cli);
  writeFileSync(join(upstream, "LICENSE"), "test notice\n");
  writeFileSync(join(upstream, "skills/retired/SKILL.md"), "Retired\n");
  writeFileSync(join(upstream, "skills/kept/SKILL.md"), "Original\n");
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
    `backnotprop/pstack/commit/${git("rev-parse", "HEAD").trim()}\nRetired upstream skill: \`retired\`.\n`,
  );
  writeFileSync(join(local, "SKILL.md"), "Local adaptation\n");
  copyFileSync(join(upstream, "LICENSE"), join(local, "LICENSE"));
  const compare = () => spawnSync(process.execPath, [cli, upstream], { encoding: "utf8" });
  const success = compare();
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Adapted: skills\/kept\/SKILL\.md/u);
  writeFileSync(join(local, "LICENSE"), "wrong notice\n");
  const missingNotice = compare();
  assert.equal(missingNotice.status, 1);
  assert.match(missingNotice.stderr, /MIT notice: kept/u);
  mkdirSync(join(local, "../retired"));
  writeFileSync(join(local, "../retired/SKILL.md"), "Reintroduced\n");
  const alias = compare();
  assert.notEqual(alias.status, 0);
  assert.match(alias.stderr, /Retired upstream skill still shipped/u);
});
