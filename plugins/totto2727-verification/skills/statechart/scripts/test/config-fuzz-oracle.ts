// oxlint-disable-next-line rules/no-node-imports -- The Node suite checks the independent Java oracle's output.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- TLC's Java parser is an external oracle rather than code under test.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Give Java the oracle file's native platform path.
import path from "node:path";
import { hostEnvironment } from "#statechart/host-env.ts";
import { isRecord, visitItems } from "#statechart/ir.ts";

export type Reading = Record<string, unknown>;
const SUCCESS = 0;
const hasValue = Boolean;
const NO_JAVA = "";
const MAX_ORACLE_OUTPUT = 1_073_741_824;
const NAME = /^\w*[A-Za-z]\w*$/u;
const LIST_NAMES = ["INVARIANT", "PROPERTY", "CONSTRAINT", "ACTION_CONSTRAINT"];
const SINGLE_NAMES = ["INIT", "NEXT", "SPECIFICATION", "VIEW", "SYMMETRY"];
const MODEL = ["CONSTANT", "CONSTRAINT", "ACTION_CONSTRAINT", "INIT", "NEXT", "SPECIFICATION", "VIEW", "SYMMETRY", "TYPE", "TYPE_CONSTRAINT"];

export const tableOf = (reading: Reading): Reading => {
  const { table } = reading;
  assert.ok(isRecord(table), `TLC printed no table: ${JSON.stringify(reading)}`);
  return table;
};

export const readInTlc = function (files: string[], jar: string): Map<string, Reading> {
  const java = hostEnvironment().JAVA ?? NO_JAVA;
  const executable = java === NO_JAVA ? "java" : java;
  // oxlint-disable-next-line node/no-sync -- One Java oracle consumes the ordered fixture paths on stdin and returns all lines before comparison begins.
  const result = spawnSync(executable, ["-cp", jar, path.join(import.meta.dirname, "ConfigOracle.java")], {
    encoding: "utf8",
    input: `${files.join("\n")}\n`,
    maxBuffer: MAX_ORACLE_OUTPUT,
  });
  assert.equal(result.status, SUCCESS, result.error?.message ?? result.stderr);
  const lines = result.stdout.split("\n");
  const readings = new Map<string, Reading>();
  files.forEach((file, index) => {
    const reading: unknown = JSON.parse(lines[index]);
    assert.ok(isRecord(reading), `TLC printed ${lines[index]}`);
    readings.set(file, reading);
  });
  return readings;
};

const listHasNames = (table: Reading, key: string): boolean => {
  const list = table[key];
  assert.ok(Array.isArray(list), `TLC printed no list for ${key}.`);
  const names: unknown[] = list;
  return names.every((name) => NAME.test(String(name)));
};

export const passesTlcStartChecks = function (reading: Reading): boolean {
  if (hasValue(reading.error)) {return false;}
  const table = tableOf(reading);
  if (!LIST_NAMES.every((key) => listHasNames(table, key))) {return false;}
  if (!SINGLE_NAMES.every((key) => !hasValue(table[key]) || NAME.test(String(table[key])))) {return false;}
  return hasValue(table.SPECIFICATION) ? !hasValue(table.INIT) && !hasValue(table.NEXT) : hasValue(table.INIT);
};

export const model = function (reading: Reading | undefined): Reading | undefined {
  if (!reading || hasValue(reading.error)) {return reading;}
  const { modConstants, modOverrides, overrides } = reading;
  const table = tableOf(reading);
  const values: Reading = { modConstants, modOverrides, overrides };
  visitItems(MODEL, (key) => {values[key] = table[key];});
  return values;
};
