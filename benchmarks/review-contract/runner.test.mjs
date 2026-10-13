import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const temporaryRoot = fileURLToPath(new URL("../../tmp/", import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, [join(root, "runner.mjs"), ...args], {
    encoding: "utf8",
    timeout: 20000,
  });

test("public runner prepares no oracle, scores real operations, and builds a whole packet", async (t) => {
  const directory = await mkdtemp(join(temporaryRoot, "review-runner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const initial = join(directory, "initial");
  assert.equal(run("prepare", "01-defaults", initial).status, 0);
  await assert.rejects(readFile(join(initial, "oracle.mjs")));
  await assert.rejects(readFile(join(initial, "accepted", "runtime.mjs")));
  assert.equal(
    run("prepare", "01-defaults", initial).status,
    1,
    "Must not overwrite an existing trial",
  );
  const before = run("score", "01-defaults", initial);
  assert.equal(before.status, 0, before.stderr);
  assert.equal(JSON.parse(before.stdout).deterministicPass, false);
  const accepted = join(directory, "answer");
  assert.equal(run("answer", "01-defaults", accepted).status, 0);
  const after = run("score", "01-defaults", accepted);
  assert.equal(after.status, 0, after.stderr);
  assert.equal(JSON.parse(after.stdout).deterministicPass, true);
  await mkdir(join(accepted, ".review-policy"));
  await writeFile(join(accepted, ".review-policy", "instructions.md"), "evaluation-only-marker");
  await writeFile(join(accepted, "policy.md"), "evaluation-only-marker");
  await writeFile(join(accepted, "documentation-review.md"), "evaluation-only-marker");
  const packet = run("packet", "01-defaults", accepted);
  assert.equal(packet.status, 0, packet.stderr);
  const content = await readFile(JSON.parse(packet.stdout).output, "utf8");
  assert.match(content, /# Task/);
  assert.match(content, /# File: runtime\.mjs/);
  assert.doesNotMatch(
    content,
    /oracle\.mjs|acceptedOverlay|deterministicPass|evaluation-only-marker/,
  );
  await writeFile(join(accepted, "large.md"), "x".repeat(48001));
  const tooLarge = run("packet", "01-defaults", accepted);
  assert.equal(tooLarge.status, 1);
  assert.match(tooLarge.stderr, /exceeds the whole-file Text boundary/);
});

test("public runner rejects unknown cases and commands", () => {
  assert.equal(run("score", "unknown", "/not-used").status, 1);
  assert.equal(run("missing").status, 1);
});
