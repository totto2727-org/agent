import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test } from "node:test";

const directory = new URL("./results/monid-20261017/", import.meta.url);
const json = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));

test("Monid live evidence preserves frozen requests, complete typed answers, and receipts", async () => {
  const freeze = await json("freeze.json");
  const summary = await json("summary.json");
  assert.deepEqual(
    freeze.inputs.map((item) => item.id),
    ["Q1", "Q2"],
  );
  assert.equal(summary.requests, freeze.callBudget);
  assert.equal(summary.retry, 0);
  assert.equal(summary.answered, 2);
  assert.equal(summary.missing, 0);
  assert.equal(summary.originalComparisonUnchanged, true);
  let inputTokens = 0;
  let outputTokens = 0;
  let microDollars = 0;
  for (const expected of freeze.inputs) {
    const bytes = await readFile(new URL(`${expected.id}.request.txt`, directory));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.inputSha256);
    const request = JSON.parse(bytes);
    const observed = summary.controls.find((item) => item.id === expected.id);
    assert.equal(
      createHash("sha256").update(request.questions.q0000.instructions.text).digest("hex"),
      expected.packetSha256,
    );
    assert.equal(observed.inputSha256, expected.inputSha256);
    assert.equal(observed.packetSha256, expected.packetSha256);
    assert.equal(observed.status, "COMPLETED");
    assert.equal(observed.httpStatus, 200);
    assert.equal(observed.model, freeze.model);
    assert.equal(request.model, freeze.model);
    assert.deepEqual(Object.keys(request.questions), freeze.acceptance.exactAnswerKeys);
    assert.equal(request.questions.q0000.type, observed.answer.type);
    assert.equal(observed.answer.type, "score");
    assert.ok(
      Number.isFinite(observed.answer.score) &&
        observed.answer.score >= 0 &&
        observed.answer.score <= 3,
    );
    assert.ok(
      Number.isFinite(observed.answer.confidence) &&
        observed.answer.confidence >= 0 &&
        observed.answer.confidence <= 1,
    );
    assert.deepEqual(Object.values(observed.answer.legend), request.questions.q0000.criteria);
    assert.deepEqual(Object.keys(observed.answer.probabilities), ["0", "1", "2", "3"]);
    const probabilities = Object.values(observed.answer.probabilities);
    assert.ok(probabilities.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) <= 0.02);
    assert.ok(Date.parse(freeze.prepared) < Date.parse(observed.startedAt));
    assert.equal(observed.billing.currency, "USD");
    assert.equal(observed.billing.unit, "MICRO_DOLLAR");
    inputTokens += observed.usage.input_tokens;
    outputTokens += observed.usage.output_tokens;
    microDollars += observed.billing.value;
  }
  assert.equal(summary.totalInputTokens, inputTokens);
  assert.equal(summary.totalOutputTokens, outputTokens);
  assert.equal(summary.reportedCostUsd, microDollars / 1000000);
  const [defect, clean] = summary.controls;
  assert.equal(defect.expected, "defect");
  assert.equal(clean.expected, "clean");
  assert.ok(defect.answer.score > clean.answer.score);
  assert.equal(summary.observedSeparation, defect.answer.score - clean.answer.score);
});

test("converted Monid answers trace to the actual public replay without claiming a check integration", async () => {
  const summary = await json("summary.json");
  const record = await json("converted-replay-record.json");
  const replay = await json("replay.json");
  assert.match(record.provenance.source, /not emitted by jev-lint check/);
  assert.equal(record.provenance.originalCloudflareRecordUnchanged, true);
  assert.equal(record.schema, "jev-lint-run-1");
  assert.equal(record.model, summary.model);
  for (const [index, control] of summary.controls.entries()) {
    const answer = record.answers[index];
    assert.equal(answer.file, `controls/${control.id}/packet.md`);
    assert.equal(answer.value, control.answer.score);
    assert.equal(answer.confidence, control.answer.confidence);
    assert.deepEqual(answer.probabilities, control.answer.probabilities);
  }
  assert.equal(replay.stats.subjects, 2);
  assert.equal(replay.stats.missing, 0);
  assert.deepEqual(replay.errors, []);
  assert.equal(replay.findings.length, 1);
  assert.equal(replay.findings[0].file, "controls/Q1/packet.md");
  assert.equal(replay.findings[0].value, summary.controls[0].answer.score);
  assert.equal(replay.findings[0].cutoff, 2);
  assert.equal(replay.stats.byFile["controls/Q2/packet.md"].findings, 0);
  assert.equal(replay.spent.calls, summary.requests);
  const comparison = JSON.parse(
    await readFile(new URL("./results/comparison.json", import.meta.url), "utf8"),
  );
  assert.equal(comparison.summary.fullCombinationImprovementVerified, false);
});
