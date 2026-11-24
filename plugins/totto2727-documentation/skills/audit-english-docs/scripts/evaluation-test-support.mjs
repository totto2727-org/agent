// oxlint-disable-next-line rules/no-node-imports -- Read the report emitted by the native CLI in integration tests.
import { readFile } from "node:fs/promises";
import { assert } from "vitest";
import { object } from "./evaluation-validation.mjs";

/** @typedef {Awaited<ReturnType<typeof import("./evaluate.mjs").evaluate>>} EvaluationReport */

/** @type {(file: string) => Promise<EvaluationReport>} */
export const readEvaluationReport = async (file) => {
  const report = object(JSON.parse(await readFile(file, "utf8")), "evaluation report");
  assert(Array.isArray(report.evaluations), "Evaluator output needs its evaluation list.");
  return (
    /** @type {EvaluationReport} */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Individual tests assert the emitted fields after checking the report envelope here.
    report
  );
};
