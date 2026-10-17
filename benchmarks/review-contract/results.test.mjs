import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { evaluate } from "./oracle.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const temporaryRoot = fileURLToPath(new URL("../../tmp/", import.meta.url));
await mkdir(temporaryRoot, { recursive: true });
const comparison = JSON.parse(await readFile(join(root, "results", "comparison.json"), "utf8"));

test("published summary traces every mechanical check and frozen manual criterion", async () => {
  const manual = JSON.parse(await readFile(join(root, "results", "manual-review.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  let mechanical = 0;
  let contextual = 0;
  for (const trial of comparison.trials) {
    const checks = JSON.parse(
      await readFile(join(root, "results", "checks", `${trial.trial}.json`), "utf8"),
    );
    const reviewed = manual.trials.find((item) => item.trial === trial.trial);
    const fixture = manifest.cases.find((item) => item.id === trial.caseId);
    assert.equal(checks.caseId, trial.caseId);
    assert.equal(checks.checks.length, trial.deterministicChecks);
    assert.equal(checks.checks.filter((item) => item.pass).length, trial.deterministicPassed);
    assert.equal(reviewed.caseId, trial.caseId);
    assert.deepEqual(
      reviewed.criteria.map((item) => item.index),
      fixture.reviewCriteria.map((_, index) => index),
    );
    assert.equal(reviewed.criteria.length, trial.manualCriteria);
    assert.equal(
      reviewed.criteria.filter((item) => item.status === "pass").length,
      trial.manualPassed,
    );
    assert.equal(trial.completeTaskPass, checks.deterministicPass && reviewed.manualPass);
    mechanical += trial.deterministicPassed;
    contextual += trial.manualPassed;
  }
  assert.equal(mechanical, comparison.summary.deterministicPassed);
  assert.equal(contextual, comparison.summary.manualPassed);
  assert.equal(comparison.summary.fullCombinationImprovementVerified, false);
});

for (const { trial, caseId, patchSha256, deterministicChecks } of comparison.trials) {
  test(`${trial}: published patch reproduces actual deterministic checks`, async (t) => {
    const directory = await mkdtemp(join(temporaryRoot, "review-results-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const workspace = join(directory, "workspace");
    const prepared = spawnSync(
      process.execPath,
      [join(root, "runner.mjs"), "prepare", caseId, workspace],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    const patch = join(root, "results", "patches", `${trial}.patch`);
    assert.equal(
      createHash("sha256")
        .update(await readFile(patch))
        .digest("hex"),
      patchSha256,
    );
    const applied = spawnSync(
      "git",
      ["-C", workspace, "apply", "--unidiff-zero", "--check", patch],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.equal(applied.status, 0, applied.stderr);
    const result = spawnSync("git", ["-C", workspace, "apply", "--unidiff-zero", patch], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const score = await evaluate(caseId, workspace);
    assert.equal(score.deterministicPass, true, JSON.stringify(score));
    assert.equal(score.checks.length, deterministicChecks);
    t.diagnostic(
      JSON.stringify({
        trial,
        caseId,
        checks: score.checks.length,
        patchSha256: createHash("sha256")
          .update(await readFile(patch))
          .digest("hex"),
      }),
    );
  });
}
