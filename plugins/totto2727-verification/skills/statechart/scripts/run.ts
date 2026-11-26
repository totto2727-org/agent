// oxlint-disable-next-line rules/no-node-imports -- Reserve and clean the standalone check's native working directory.
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Use the host's temporary directory for the standalone CLI.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the specification and temporary directory with native path conventions.
import path from "node:path";
import { must, ruleKey } from "./ir.ts";
import type { CheckResult } from "./ir.ts";
import { graphForCheck } from "./tlc-graph.ts";
import { checkRules } from "./tlc-judge.ts";
import { CHECK_FAILED, checkFailure, exitClass, messagesOf } from "./tlc-output.ts";
import { initialOnlyProperties, readCheckConfiguration, readCheckedSpec } from "./tlc-spec.ts";
import { prepareTools } from "./tlc-tools.ts";
import type { ToolRunner } from "./tlc-tools.ts";

export { fileExists, fileLines, messageOf, runChild } from "./native-process.ts";
export { PINNED_FLAGS } from "./tlc-tools.ts";

const finishCheck = async (
  location: { dir: string; specFile: string },
  { sany, spec }: Awaited<ReturnType<typeof readCheckedSpec>>,
  tools: ToolRunner,
): Promise<CheckResult> => {
  const evaluated = await checkRules(location, spec, tools);
  const exit = exitClass(evaluated.first.status);
  const initialOnly = initialOnlyProperties(sany, spec);
  if (exit === CHECK_FAILED) {throw checkFailure(location.specFile, evaluated.first);}
  const rules = evaluated.rules.map((rule) => must(evaluated.verdicts, ruleKey(rule)));
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the published check result's field order ahead of the graph fields.
  const common = { spec, exit, stop: evaluated.stop, states: evaluated.states, messages: messagesOf(evaluated.first.output), rules };
  return { ...common, ...(await graphForCheck(location, { evaluated, initialOnly, spec }, tools)) };
};

export const check = async function check(specFile: string, configFile: string): Promise<CheckResult> {
  const checks = await readCheckConfiguration(configFile);
  const folder = path.dirname(path.resolve(specFile));
  const dir = await mkdtemp(path.join(os.tmpdir(), "statechart-"));
  try {
    const tools = await prepareTools(dir, folder);
    const checkedSpec = await readCheckedSpec({ checks, folder, specFile }, tools);
    return await finishCheck({ dir, specFile }, checkedSpec, tools);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
