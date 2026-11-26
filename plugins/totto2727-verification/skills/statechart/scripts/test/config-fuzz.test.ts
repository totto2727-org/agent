// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Create and remove the isolated config fixtures through the host filesystem.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Keep test-generated config files under the host's private temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Fixture paths follow the host platform's filesystem.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { hostEnvironment } from "#statechart/host-env.ts";
import { inputsForOracle, writeCases } from "./config-fuzz-files.ts";
import type { ConfigCase } from "./config-fuzz-files.ts";
import { model, passesTlcStartChecks, readInTlc, tableOf } from "./config-fuzz-oracle.ts";
import type { Reading } from "./config-fuzz-oracle.ts";

const jar = hostEnvironment().TLA2TOOLS;
const hasJar = Boolean(jar);
const skip = !hasJar && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";
const SEED = 1;
const CONFIGS = 4000;

const checkRefusal = (skill: Error, mutated: boolean, { want, where }: { want: Reading; where: string }): void => {
  if (skill.message.startsWith("TLC refuses")) {
    assert.ok(!passesTlcStartChecks(want), `The skill says TLC refuses ${where}`);
    return;
  }
  assert.ok(mutated && skill.message.startsWith("The command cannot read"), `${skill.message}\n${where}`);
};

const compare = ({ file, index, output, sample, skill }: ConfigCase, oracle: Map<string, Reading>): void => {
  const want = oracle.get(file);
  assert.ok(want, `TLC printed nothing for config ${index}`);
  const where = `config ${index} of seed ${SEED}: ${JSON.stringify(sample.text)}\nTLC reads ${JSON.stringify(want)}`;
  // oxlint-disable-next-line rules/no-instanceof-error -- Differential checks compare the native skill's original typed Error and successful value.
  if (skill instanceof Error) {
    checkRefusal(skill, sample.mutated, { want, where });
    return;
  }
  assert.ok(passesTlcStartChecks(want), `The skill reads ${where}`);
  const table = tableOf(want);
  assert.deepEqual(
    { deadlock: skill.deadlock, invariants: skill.invariants, model: model(oracle.get(output)), properties: skill.properties },
    { deadlock: want.deadlock, invariants: table.INVARIANT, model: model(want), properties: table.PROPERTY },
    where,
  );
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  `${CONFIGS} configs from seed ${SEED} read in the skill as in TLC, or stop before TLC runs`,
  { skip },
  async (testContext) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "statechart-config-fuzz-"));
    testContext.after(async () => {await fs.rm(directory, { recursive: true });});
    const cases = await writeCases(directory, SEED, CONFIGS);
    const oracle = readInTlc(cases.flatMap((current) => inputsForOracle(current)), String(jar));
    cases.forEach((current) => {compare(current, oracle);});
  },
);
