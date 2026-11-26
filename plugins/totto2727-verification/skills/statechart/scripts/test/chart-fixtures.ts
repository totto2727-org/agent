// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { mermaid } from "#statechart/backends/mermaid.ts";
import { report } from "#statechart/backends/report.ts";
import { hasObjectType, matchesUndefined, visitItems } from '#statechart/ir.ts';
import type { Bug, Graph, Rule, Spec, Value, Vars, View } from '#statechart/ir.ts';
import { bugs, walk } from "#statechart/passes/reach.ts";
import { project } from "#statechart/pipeline.ts";

export type StateRow = [id: string, vars: Vars, start?: boolean, breaks?: string[]];
export type StepRow = [from: string, to: string, action: string];

export const graphOf = (states: StateRow[], steps: StepRow[]): Graph => {
  const graph: Graph = { states: new Map(), steps: [] };
  visitItems(states, ([id, vars, start, breaks = []]) => {
    const rules: Rule[] = [];
    visitItems(breaks, (name) => {rules.push({ kind: "invariant", name });});
    graph.states.set(id, { breaks: rules, start: start ?? false, vars });
  });
  visitItems(steps, ([from, to, action]) => {graph.steps.push({ action, from, to });});
  return graph;
};

export const field = (value: Value, name: string): Value => {
  const fieldNotFound = -1;
  assert.ok(hasObjectType(value) && value.kind === "function", `${inspect(value)} is not a function.`);
  const index = value.keys.findIndex((candidate) =>
    candidate === name || (hasObjectType(candidate) && candidate.kind === "model" && candidate.name === name));
  assert.ok(index !== fieldNotFound, `${inspect(value)} has no ${name}.`);
  return value.values[index];
};

export const fixtureText = (value: Value): string => {
  assert.ok(!hasObjectType(value), "Chart fixture labels use scalar TLA+ values.");
  return String(value);
};

export const SWITCH_OFF = 0;
export const SWITCH_ON = 1;
export const FIRST = 0;
export const LAST = -1;
export const NO_CALLS = 0;
export const ALL_MARKS_PLACED = 0;
export const ONE_CALL = 1;

export const countQuestion = (asked: Record<string, number>, question: string): number => {
  const count = (asked[question] ?? NO_CALLS) + ONE_CALL;
  asked[question] = count;
  return count;
};

export const draw = function (graph: Graph, view: View, loops: Bug[] = []): { chart: string; report: string } {
  const found = [...bugs(graph), ...loops];
  const { chart, stories } = project(graph, walk(graph), { found, view });
  const spec: Spec = {
    deadlock: false,
    invariants: [],
    module: "Test",
    properties: [],
    variables: [],
    written: [],
  };
  const result = {
    drawing: undefined,
    graph,
    paths: undefined,
    properties: [],
    rules: [],
    spec,
    states: { complete: true, cut: false, distinct: graph.states.size, initial: 1 },
    stop: undefined,
  };
  return { chart: mermaid(chart), report: report(result, { chart, found, stories }) };
};

export const marked = (chart: string): Record<string, string> => {
  const out: Record<string, string> = {};
  visitItems(chart.matchAll(/^ {2}class (?<id>s\d+) (?<kind>breaks|mayBreak)$/gmu), (match) => {
    assert.ok(match.groups);
    const { id, kind } = match.groups;
    const label = new RegExp(`^\\s*${id}: (?<label>.*)$`, "mu").exec(chart)?.groups?.label;
    assert.ok(!matchesUndefined(label), `${id} has no label`);
    out[label] = kind;
  });
  return out;
};
export const numberedState = (variables: Vars): string => `S${fixtureText(variables.n)}`;
