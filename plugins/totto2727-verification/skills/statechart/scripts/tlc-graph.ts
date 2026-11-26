import { parseDot } from "./frontends/dot.ts";
import { readCounterexample, readMarks } from "./frontends/marks.ts";
import { readMessages } from "./frontends/messages.ts";
import { readTrace } from "./frontends/trace.ts";
import { CHART_STATES, hasSection, must, ruleKey, visitItems } from "./ir.ts";
import type { Bug, CheckResult, Graph, Lasso, Mark, Property, Rule, Trace } from "./ir.ts";
import { CHILD_SUCCESS, fileLines } from "./native-process.ts";
import { addPast, deadEnds, finder, lasso, mark } from "./passes/annotate.ts";
import type { PastLookup } from "./passes/annotate.ts";
import { pathGraph } from "./passes/paths.ts";
import type { RuleEvaluation } from "./tlc-judge.ts";
import { drawWithinBudget } from "./tlc-tools.ts";
import type { TlcDrawing, ToolRunner } from "./tlc-tools.ts";

type Presentation = Pick<CheckResult, "graph" | "paths" | "properties" | "drawing">;

interface GraphContext {
  evaluated: RuleEvaluation;
  initialOnly: Set<string>;
  spec: CheckResult["spec"];
}

const only = function* (marks: Iterable<Mark>, rules: Set<string>): Generator<Mark> {
  // oxlint-disable-next-line rules/no-for-loops -- Keep mark selection lazy while reading TLC's output stream.
  for (const { values, broken } of marks) {
    const kept: string[] = [];
    visitItems(broken, (name) => {if (rules.has(name)) {kept.push(name);}});
    // oxlint-disable-next-line eslint/sort-keys -- Keep the emitted mark's field order.
    if (kept.length) {yield { values, broken: kept };}
  }
};

const propertiesWith = ({ evaluated, initialOnly }: GraphContext, bugOf: (trace: Trace) => Lasso | undefined): Property[] => {
  const { all, verdicts } = evaluated;
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

const pathsOnly = (context: GraphContext): Presentation => {
  const { evaluated: { rules, verdicts }, spec } = context;
  const drawn = pathGraph(spec.variables);
  const paths: Bug[] = [];
  visitItems(rules, (rule) => {
    const { outcome, messages } = must(verdicts, ruleKey(rule));
    if (outcome === "broken" && messages) {
      paths.push(drawn.bug(rule, readCounterexample(messages)));
    }
  });
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the published check result's graph field order.
  return { graph: drawn.graph, paths, properties: propertiesWith(context, drawn.lasso), drawing: undefined };
};

const drawnMarks = ({ result, tag }: TlcDrawing, { verdicts }: RuleEvaluation): Iterable<Mark> => {
  const broken = new Set<string>();
  visitItems(verdicts.values(), ({ rule, outcome }) => {
    if (rule.kind === "invariant" && outcome === "broken") {broken.add(rule.name);}
  });
  const messages = readMessages(fileLines(result.stdout));
  return only(readMarks(messages, tag), broken);
};

interface Annotation {
  drawn: boolean;
  graph: Graph;
  lookup: PastLookup;
}

const annotateRule = (
  rule: Rule,
  { drawn, graph, lookup }: Annotation,
  { evaluated, spec }: GraphContext,
): void => {
  const { outcome, messages } = must(evaluated.verdicts, ruleKey(rule));
  if (rule.kind === "deadlock" && outcome === "broken" && drawn && !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT")) {
    deadEnds(graph, rule);
  }
  if (outcome !== "broken" || !messages) {return;}
  const counterexample = readCounterexample(messages);
  if (drawn || lasso(graph, { loop: undefined, seq: counterexample }, lookup)) {
    addPast(graph, counterexample, { ...lookup, rule });
  }
};

const drawnGraph = (drawingRun: TlcDrawing, context: GraphContext): Presentation => {
  const { evaluated, spec } = context;
  const graph = parseDot(fileLines(drawingRun.file));
  const find = finder(graph, spec.variables);
  const drawing = drawingRun.result.status === CHILD_SUCCESS ? undefined : { status: drawingRun.result.status };
  const marks = drawnMarks(drawingRun, evaluated);
  const past = mark(graph, marks, { find, names: spec.variables, rules: evaluated.rules });
  const lookup = { excludes: hasSection(spec, "ACTION_CONSTRAINT"), find, names: spec.variables, past };
  visitItems(evaluated.rules, (rule) => {annotateRule(rule, { drawn: !drawing, graph, lookup }, context);});
  const properties = propertiesWith(context, (trace) => lasso(graph, trace, { find, names: spec.variables }));
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the published check result's graph field order.
  return { graph, paths: undefined, properties, drawing };
};

export const graphForCheck = async (
  location: { dir: string; specFile: string },
  context: GraphContext,
  tools: ToolRunner,
): Promise<Presentation> => {
  if (context.evaluated.states.distinct > CHART_STATES) {return pathsOnly(context);}
  const drawing = await drawWithinBudget(location, context.spec, tools);
  return drawing ? drawnGraph(drawing, context) : pathsOnly(context);
};
