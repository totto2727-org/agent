// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to generate the native run's independent marker using the host's entropy source.
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Await the standalone tool's temporary files before starting each native checker.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
import { chartRun } from "./backends/cfg.ts";
import { readConfig } from "./frontends/config.ts";
import { parseDot } from "./frontends/dot.ts";
import { readCounterexample, readMarks } from "./frontends/marks.ts";
import { readMessages } from "./frontends/messages.ts";
import { initialOnlyProperties, readChecks, readSany, readSpec } from "./frontends/spec.ts";
import { readTrace } from "./frontends/trace.ts";
import { readVerdict } from './frontends/verdict.ts';
import { CHART_STATES, hasSection, must, ruleKey, visitItems } from './ir.ts';
import type { Bug, CheckResult, Lasso, Mark, Property, Trace, Verdict } from './ir.ts';
import { addPast, deadEnds, finder, lasso, mark } from "./passes/annotate.ts";
import { pathGraph } from "./passes/paths.ts";
import { CHILD_SUCCESS, fileExists, fileLines } from "./native-process.ts";
import type { FileResult } from "./native-process.ts";
import { checkRules } from "./tlc-judge.ts";
import { CHECK_FAILED, exitClass, messagesOf, sanyErrors, stopOf, tail } from "./tlc-output.ts";
import { PINNED_FLAGS, prepareTools } from "./tlc-tools.ts";

export { fileExists, fileLines, messageOf, runChild } from "./native-process.ts";

export { PINNED_FLAGS } from "./tlc-tools.ts";

const CHART_TAG_BYTES = 16;
const only = function* (marks: Iterable<Mark>, rules: Set<string>): Generator<Mark> {
  // oxlint-disable-next-line rules/no-for-loops -- Keep mark selection lazy while reading TLC's output stream.
  for (const { values, broken } of marks) {
    const kept: string[] = [];
    visitItems(broken, (name) => {if (rules.has(name)) {kept.push(name);}});
    // oxlint-disable-next-line eslint/sort-keys -- Keep the emitted mark's field order.
    if (kept.length) {yield { values, broken: kept };}
  }
};

export const check = async function check(specFile: string, configFile: string): Promise<CheckResult> {
  const cfg = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  const checks = readChecks({ configFile, config: cfg });
  const folder = path.dirname(path.resolve(specFile));
  const dir = await mkdtemp(path.join(os.tmpdir(), "statechart-"));
  try {
    const tools = await prepareTools(dir, folder);
    const { config, runJava } = tools;
    const xml = await runJava({
      args: ["-o", "-I", folder, path.resolve(specFile)],
      main: "tla2sany.xml.XMLExporter",
      name: "sany",
      vmOptions: ["-XX:TieredStopAtLevel=1"],
    });
    if (xml.status !== CHILD_SUCCESS) {
      const errors = xml.error
        ? undefined
        : sanyErrors(
            await runJava({
              args: [path.resolve(specFile)],
              main: "tla2sany.SANY",
              name: "sany-errors",
              vmOptions: ["-XX:TieredStopAtLevel=1"],
            }),
          );
      throw new Error(
        `SANY could not read ${specFile} (exit ${xml.status}):\n${errors ?? tail(xml)}`,
      );
    }
    const sany = readSany(await readFile(xml.stdout, "utf8"));
    const module = path.basename(specFile, ".tla");
    const spec = { ...readSpec({ module, sany, checks }), folder };
    const judged = await checkRules({ dir, specFile }, spec, tools);
    const { all, rules, verdicts } = judged;
    const exit = exitClass(judged.first.status);
    const failed = (processResult: FileResult) =>
      new Error(`TLC could not check ${specFile} (exit ${processResult.status}):\n${stopOf(processResult).message}`);
    const initialOnly = initialOnlyProperties(sany, spec);
    const propertiesWith = (bugOf: (trace: Trace) => Lasso | undefined) => {
      const properties: Property[] = [];
      visitItems(all, (rule) => {
        if (rule.kind !== "property") {return;}
        const verdict = must(verdicts, ruleKey(rule));
        properties.push({
          ...verdict,
          bug: verdict.outcome === "broken" && verdict.messages ? bugOf(readTrace(verdict.messages)) : undefined,
          initialOnly: initialOnly.has(rule.name),
        });
      });
      return properties;
    };
    if (exit === CHECK_FAILED) {throw failed(judged.first);}
    const checked: Verdict[] = [];
    visitItems(rules, (rule) => {checked.push(must(verdicts, ruleKey(rule)));});
    const common = {
      spec,
      exit,
      stop: judged.stop,
      states: judged.states,
      messages: messagesOf(judged.first.output),
      rules: checked,
    };
    if (judged.states.distinct <= CHART_STATES) {
      const tag = `chart-${randomBytes(CHART_TAG_BYTES).toString("hex")}`;
      await writeFile(path.join(dir, "ChartRun.tla"), chartRun(spec, tag));
      const drawn = await runJava({
        args: [
          "-tool",
          ...PINNED_FLAGS,
          "-deadlock",
          ...(await config("ChartRun", spec.written, ["INVARIANT ChartMark", "CONSTRAINT ChartBudget"])),
          "-dump",
          "dot,actionlabels",
          path.join(dir, "graph"),
          "ChartRun",
        ],
        main: "tlc2.TLC",
        name: "ChartRun",
      });
      const file = path.join(dir, "graph.dot");
      if (!(await fileExists(file))) {throw failed(drawn);}
      if (readVerdict(messagesOf(drawn.output)).distinct <= CHART_STATES) {
        const graph = parseDot(fileLines(file));
        const find = finder(graph, spec.variables);
        const drawing = drawn.status === CHILD_SUCCESS ? undefined : { status: drawn.status };
        const broken = new Set<string>();
        visitItems(verdicts.values(), ({ rule, outcome }) => {if (rule.kind === "invariant" && outcome === "broken") {broken.add(rule.name);}});
        const marks = only(readMarks(readMessages(fileLines(drawn.stdout)), tag), broken);
        const past = mark(graph, marks, { find, names: spec.variables, rules });
        const excludes = hasSection(spec, "ACTION_CONSTRAINT");
        visitItems(rules, (rule) => {
          const { outcome, messages } = must(verdicts, ruleKey(rule));
          if (
            rule.kind === "deadlock" &&
            outcome === "broken" &&
            !drawing &&
            !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT")
          )
            {deadEnds(graph, rule);}
          if (outcome !== "broken" || !messages) {return;}
          const counterexample = readCounterexample(messages);
          if (
            !drawing ||
            lasso(graph, { seq: counterexample, loop: undefined }, { find, names: spec.variables })
          )
            {addPast(graph, counterexample, { excludes, find, names: spec.variables, past, rule });}
        });
        const properties = propertiesWith((trace) => lasso(graph, trace, { find, names: spec.variables }));
        return {
          ...common,
          graph,
          paths: undefined,
          properties,
          drawing,
        };
      }
    }
    const drawn = pathGraph(spec.variables);
    const paths: Bug[] = [];
    visitItems(rules, (rule) => {
      const { outcome, messages } = must(verdicts, ruleKey(rule));
      if (outcome === "broken" && messages)
        {paths.push(drawn.bug(rule, readCounterexample(messages)));}
    });
    return {
      ...common,
      graph: drawn.graph,
      paths,
      properties: propertiesWith(drawn.lasso),
      drawing: undefined,
    };
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
