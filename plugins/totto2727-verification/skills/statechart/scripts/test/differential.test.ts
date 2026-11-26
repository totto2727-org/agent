// oxlint-disable-next-line rules/no-node-imports -- Statechart runs the standalone differential fixtures with Node's native assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Keep the existing native test runner and registrations.
import { test } from "node:test";
import fc from "fast-check";
import { hostEnvironment } from "#statechart/host-env.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { caseOf } from "./differential-case.ts";
import type { Case } from "./differential-case.ts";
import { CASES } from "./differential-fixtures.ts";
import { MODEL } from "./differential-model.ts";
import { compareFixture } from "./differential-run.ts";
import { skip } from "./tlc.ts";

const DEFAULT_RUNS = 20;
const NO_SEED = 0;

const answer = async (fixture: Case): Promise<string> => {
  const { compiled, plain, stdout } = await compareFixture(fixture);
  assert.deepEqual(compiled, plain);
  return stdout;
};

const parameters = (): { includeErrorInReport: boolean; numRuns: number; seed: number | undefined } => {
  const { STATECHART_DIFFERENTIAL_RUNS: runs, STATECHART_DIFFERENTIAL_SEED: seed } = hostEnvironment();
  return {
    includeErrorInReport: true,
    numRuns: Number(runs ?? DEFAULT_RUNS),
    seed: matchesUndefined(seed) || seed.length === NO_SEED ? undefined : Number(seed),
  };
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the compiler answers each rule as plain TLC does for generated models", { skip }, async () => {
  await fc.assert(
    fc.asyncProperty(MODEL.map((model) => caseOf(model)), async (fixture) => {await answer(fixture);}),
    parameters(),
  );
});

visitItems(CASES, ([name, fixture, messages]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name}, as plain TLC answers`, { skip }, async () => {
    const report = await answer(fixture);
    visitItems(messages, (message) => {assert.ok(report.includes(message), `${message}\nis not in\n${report}`);});
  });
});
