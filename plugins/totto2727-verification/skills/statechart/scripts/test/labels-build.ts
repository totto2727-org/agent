import { mermaid as chartText } from "#statechart/backends/mermaid.ts";
import { count as indices, matchesUndefined, visitItems } from "#statechart/ir.ts";
import type { Chart, Graph, State, Step, View } from "#statechart/ir.ts";
import { walk } from "#statechart/passes/reach.ts";
import { project } from "#statechart/pipeline.ts";
import { errorText, nativeFailure } from "./labels-errors.ts";
import type { Case } from "./labels-generate.ts";

interface RawView extends Record<string, unknown> {
  state: (vars: { k: number }) => unknown;
  step: (action: string) => string;
  group?: (vars: { k: number }) => string | undefined;
  colors?: Record<string, unknown>;
  title?: string;
}

const START_STATE_INDEX = 0;
const FIRST_ASSIGNED_INDEX = 0;
const ACTION_PREFIX = "A";

const namedState = (chart: Case, labels: string[], stateIndex: number): unknown => {
  if (chart.mode === "regions") {
    const shape = chart.regions.map((region, regionIndex): [string, string] => [
      labels[region],
      labels[chart.pools[regionIndex][chart.values[stateIndex][regionIndex]]],
    ]);
    return Object.fromEntries(shape);
  }
  const leaf = labels[chart.leaf[stateIndex]];
  if (chart.mode === "parents" && chart.parentOf[stateIndex] >= FIRST_ASSIGNED_INDEX) {
    return [labels[chart.parents[chart.parentOf[stateIndex]]], leaf];
  }
  return leaf;
};

const buildView = (chart: Case, labels: string[]): RawView => {
  const view: RawView = {
    state: ({ k: stateIndex }) => namedState(chart, labels, stateIndex),
    step: (action) => labels[chart.actions[Number(action.slice(ACTION_PREFIX.length))]],
  };
  if (chart.groups) {
    const { groups, colors, groupOf } = chart;
    view.group = ({ k: stateIndex }) => groupOf[stateIndex] < FIRST_ASSIGNED_INDEX
      ? undefined
      : labels[groups[groupOf[stateIndex]]];
    view.colors = Object.fromEntries(groups.map((group, groupIndex) => [labels[group], colors[groupIndex]]));
  }
  if (!matchesUndefined(chart.title)) {view.title = labels[chart.title];}
  return view;
};

const buildGraph = (chart: Case): Graph => {
  const states = new Map<string, State>();
  visitItems(indices(chart.stateCount), (stateIndex) => {
    states.set(String(stateIndex), { breaks: [], start: stateIndex === START_STATE_INDEX, vars: { k: stateIndex } });
  });
  const steps: Step[] = [];
  visitItems(chart.steps, ([from, to, action]) => {
    steps.push({ action: `${ACTION_PREFIX}${action}`, from: String(from), to: String(to) });
  });
  return { states, steps };
};

export const build = (chart: Case, labels: string[]): { graph: Graph; view: RawView } =>
  ({ graph: buildGraph(chart), view: buildView(chart, labels) });

export const draw = (graph: Graph, view: View): { chart: Chart; text: string } | { problems: string[]; refused?: true } => {
  try {
    const { chart } = project(graph, walk(graph), { found: [], view });
    return { chart, text: chartText(chart) };
  } catch (error) {
    const failure = nativeFailure(error);
    const message = errorText(failure);
    if (/^The view's (?:state|step)\(\) returned /u.test(message)) {
      return { problems: [], refused: true };
    }
    return { problems: [`skill-throws: ${failure.constructor.name}: ${message}`] };
  }
};
