// oxlint-disable-next-line rules/no-node-imports -- Write the bounded check's specification to the standalone tool's native directory.
import { writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the bounded check's path through the native filesystem.
import path from "node:path";
import { boundRun } from "./backends/cfg.ts";
import { readVerdict } from "./frontends/verdict.ts";
import type { Break } from "./frontends/verdict.ts";
import { RERUN_STATES, matchesUndefined, ruleKey, stateRules, visitItems } from "./ir.ts";
import type { CheckResult, Outcome, Rule, Spec, Stop, Verdict } from "./ir.ts";
import { CHILD_SUCCESS } from "./native-process.ts";
import type { FileResult } from "./native-process.ts";
import { CHECK_FAILED, exitClass, messagesOf, stopOf, tail } from "./tlc-output.ts";
import { PINNED_FLAGS } from "./tlc-tools.ts";
import type { ToolRunner } from "./tlc-tools.ts";

interface RuleEvaluation {
  all: Rule[];
  first: FileResult;
  rules: Rule[];
  states: CheckResult["states"];
  stop: Stop | undefined;
  verdicts: Map<string, Verdict>;
}

const names = (rules: Rule[], kind: Rule["kind"]): string[] => {
  const found: string[] = [];
  visitItems(rules, (rule) => {if (rule.kind === kind) {found.push(rule.name);}});
  return found;
};

const brokenRule = (rules: Rule[], broke: Break): Rule | undefined => {
  const exact = broke.kind === "temporal" ? undefined :
    rules.find((rule) => rule.kind === broke.kind && (broke.kind === "deadlock" || rule.name === broke.name));
  return broke.kind === "invariant" && matchesUndefined(exact)
    ? rules.find((rule) => rule.kind === "property" && rule.name === broke.name)
    : exact;
};

type Decide = (rule: Rule, outcome: Outcome, result?: FileResult) => void;

interface Evaluation {
  decide: Decide;
  groups: Rule[][];
  states: CheckResult["states"];
  stop: Stop | undefined;
  verdicts: Map<string, Verdict>;
}

interface GroupRun {
  bounded: boolean;
  group: Rule[];
  includesProperties: boolean;
  output: FileResult;
}

const startEvaluation = (all: Rule[]): Evaluation => {
  const verdicts = new Map<string, Verdict>();
  const decide: Decide = (rule, outcome, result) => {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the published verdict field order.
    verdicts.set(ruleKey(rule), { rule, outcome, messages: result && messagesOf(result.output) });
  };
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the published check result's state field order.
  const states = { distinct: 0, initial: 0, complete: false, cut: false };
  return { decide, groups: [all], states, stop: undefined, verdicts };
};

const runGroup = async (
  group: Rule[],
  { bounded, name, spec }: { bounded: boolean; name: string; spec: Spec },
  { config, runJava }: ToolRunner,
): Promise<GroupRun> => {
  const invariants = names(group, "invariant");
  const properties = names(group, "property");
  const extra = [
    ...(invariants.length ? [`INVARIANT ${invariants.join(" ")}`] : []),
    ...(properties.length ? [`PROPERTY ${properties.join(" ")}`] : []),
    ...(bounded ? ["CONSTRAINT ChartBound"] : []),
  ];
  const output = await runJava({
    args: [
      "-tool",
      ...PINNED_FLAGS,
      ...(names(group, "deadlock").length ? [] : ["-deadlock"]),
      ...(await config(name, spec.written, extra)),
      bounded ? "ChartBound" : spec.module,
    ],
    main: "tlc2.TLC",
    name,
  });
  return { bounded, group, includesProperties: Boolean(properties.length), output };
};

const acceptGroup = (evaluation: Evaluation, rules: Rule[], outcome: "holds" | "not checked"): void => {
  if (outcome === "holds") {evaluation.states.complete = true;}
  else {evaluation.states.cut = true;}
  visitItems(rules, (rule) => {evaluation.decide(rule, outcome);});
};

const retryProperties = (evaluation: Evaluation, { group, output }: GroupRun, broke: Break): void => {
  const { decide, groups, verdicts } = evaluation;
  if (broke.kind === "temporal") {acceptGroup(evaluation, group.filter((rule) => rule.kind !== "property"), "holds");}
  const pending = group.filter((rule) => rule.kind === "property");
  const [only, ...otherProperties] = pending;
  if (otherProperties.length) {
    groups.shift();
    groups.unshift(group.filter((rule) => rule.kind !== "property" && !verdicts.has(ruleKey(rule))), ...pending.map((rule) => [rule]));
  } else {
    decide(only, "broken", output);
  }
};

const recordCompleted = (
  evaluation: Evaluation,
  run: GroupRun,
  { broke, cut, rule, specFile }: { broke: Break | undefined; cut: boolean; rule: Rule | undefined; specFile: string },
): void => {
  const { group, includesProperties, output } = run;
  if (rule) {evaluation.decide(rule, "broken", output);}
  else if (cut && (output.status === CHILD_SUCCESS || broke?.kind === "temporal")) {acceptGroup(evaluation, group, "not checked");}
  else if (output.status === CHILD_SUCCESS) {acceptGroup(evaluation, group, "holds");} else if (broke && includesProperties) {retryProperties(evaluation, run, broke);}
  else {
    // oxlint-disable-next-line rules/require-tagged-error -- Report the native checker's failure from the standalone CLI without loading a runtime package.
    throw new Error(`TLC exited ${output.status} on ${specFile}, but its output names no rule that broke:\n${tail(output)}`);
  }
};

const recordRun = (evaluation: Evaluation, run: GroupRun, specFile: string): void => {
  const { states } = evaluation;
  const { bounded, group, output } = run;
  const { broke, distinct, initial } = readVerdict(messagesOf(output.output));
  states.distinct = Math.max(states.distinct, distinct);
  states.initial = Math.max(states.initial, initial);
  if (exitClass(output.status) === CHECK_FAILED) {
    evaluation.stop = stopOf(output);
    return;
  }
  const rule = broke && brokenRule(group, broke);
  recordCompleted(evaluation, run, { broke, cut: bounded && distinct >= RERUN_STATES, rule, specFile });
};

const nextGroup = ({ groups, verdicts }: Evaluation): Rule[] | undefined => {
  while (groups.length) {
    const [first] = groups;
    const remaining = first.filter((rule) => !verdicts.has(ruleKey(rule)));
    if (remaining.length) {return remaining;}
    groups.shift();
  }
  return undefined;
};

const FIRST_CHECK = 1;
const CHECK_NUMBER_STEP = 1;

const runRemaining = async (
  evaluation: Evaluation,
  { spec, specFile }: { spec: Spec; specFile: string },
  tools: ToolRunner,
): Promise<void> => {
  const attempt = { number: FIRST_CHECK };
  while (!evaluation.stop) {
    const group = nextGroup(evaluation);
    if (!group) {break;}
    attempt.number += CHECK_NUMBER_STEP;
    const name = `verdict-${attempt.number}`;
    // oxlint-disable-next-line eslint/no-await-in-loop -- The previous TLC verdict determines the next group and whether its check is bounded.
    const result = await runGroup(group, { bounded: !evaluation.states.complete, name, spec }, tools);
    recordRun(evaluation, result, specFile);
  }
};

export const checkRules = async (
  { dir, specFile }: { dir: string; specFile: string },
  spec: Spec,
  tools: ToolRunner,
): Promise<RuleEvaluation> => {
  const rules = stateRules(spec);
  const all = [...rules, ...spec.properties.map((name): Rule => ({ kind: "property", name }))];
  const evaluation = startEvaluation(all);
  await writeFile(path.join(dir, "ChartBound.tla"), boundRun(spec.module));
  const first = await runGroup(all, { bounded: false, name: `verdict-${FIRST_CHECK}`, spec }, tools);
  recordRun(evaluation, first, specFile);
  await runRemaining(evaluation, { spec, specFile }, tools);
  const { decide, states, stop, verdicts } = evaluation;
  visitItems(all, (rule) => {if (!verdicts.has(ruleKey(rule))) {decide(rule, "not checked");}});
  return { all, first: first.output, rules, states, stop, verdicts };
};
