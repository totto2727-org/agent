// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures await the host filesystem for the corpus configuration and replay paths.
import { readdir } from "node:fs/promises";
import { hasSection, stateRules, visitItems } from '#statechart/ir.ts';
import type { Bug, Graph, Part, Spec } from '#statechart/ir.ts';
import { addPast, deadEnds, finder, lasso, mark } from "#statechart/passes/annotate.ts";
import { readCounterexample, readMarks } from "#statechart/frontends/marks.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { readVerdict } from "#statechart/frontends/verdict.ts";
import { fileExists, fileLines } from "#statechart/run.ts";
import { pathGraph } from "#statechart/passes/paths.ts";
import { corpus, corpusSpec } from "./chart-corpus-source.ts";

const visitVerdicts = async (name: string, visit: (messages: Part[]) => void): Promise<void> => {
  const files = await readdir(corpus(name, ""));
  const verdictFiles = files.filter((file) => /^verdict-\d+\.out$/u.test(file));
  visitItems(verdictFiles.toSorted(), (file) => {
    const output = fileLines(corpus(name, file));
    visit([...readMessages(output)]);
  });
};

interface Replay {
  find: ReturnType<typeof finder>;
  graph: Graph;
  hasCompleteDrawing: boolean;
  names: Spec["variables"];
  past: ReturnType<typeof mark>;
  rules: ReturnType<typeof stateRules>;
  spec: Spec;
}

const applyVerdict = (messages: Part[], { find, graph, hasCompleteDrawing, names, past, rules, spec }: Replay): void => {
  const { broke } = readVerdict(messages);
  const rule = broke && rules.findLast((current) => current.kind === broke.kind && (broke.kind === "deadlock" || current.name === broke.name));
  if (!rule) {return;}
  if (rule.kind === "deadlock" && hasCompleteDrawing && !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT")) {
    deadEnds(graph, rule);
  }
  const counterexample = readCounterexample(messages);
  if (hasCompleteDrawing || lasso(graph, { loop: undefined, seq: counterexample }, { find, names })) {
    addPast(graph, counterexample, { excludes: hasSection(spec, "ACTION_CONSTRAINT"), find, names, past, rule });
  }
};

export const replay = async function (name: string, graph: Graph): Promise<void> {
  const spec = await corpusSpec(name);
  const names = spec.variables;
  const rules = stateRules(spec);
  const find = finder(graph, names);
  const chartOutput = fileLines(corpus(name, "ChartRun.out"));
  const marks = readMarks(readMessages(chartOutput), "chart");
  const past = mark(graph, marks, { find, names, rules });
  const hasCompleteDrawing = !(await fileExists(corpus(name, "ChartRun.exit")));
  await visitVerdicts(name, (messages) => {
    applyVerdict(messages, { find, graph, hasCompleteDrawing, names, past, rules, spec });
  });
};

export const corpusBugPaths = async (name: string): Promise<{ graph: Graph; paths: Bug[]; spec: Spec }> => {
  const spec = await corpusSpec(name);
  const rules = stateRules(spec);
  const pathDrawing = pathGraph(spec.variables);
  const paths: Bug[] = [];
  await visitVerdicts(name, (messages) => {
    const { broke } = readVerdict(messages);
    visitItems(rules, (rule) => {
      if (broke?.kind === rule.kind && (broke.kind === "deadlock" || rule.name === broke.name)) {
        paths.push(pathDrawing.bug(rule, readCounterexample(messages)));
      }
    });
  });
  return { graph: pathDrawing.graph, paths, spec };
};
