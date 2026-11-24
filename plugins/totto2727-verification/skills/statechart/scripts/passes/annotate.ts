import { findLoop, findTrace, hasRule, matchesUndefined, must, pastState, stateKey, valuesOf, visitItems } from '#statechart/ir.ts';
import type { Graph, Lasso, Mark, Past, PathStep, Rule, Step, Trace, TraceState, Value } from '#statechart/ir.ts';

export const finder = (graph: Graph, names: string[]) => {
  let ids: Map<string, string> | undefined;
  const find = (values: Value[]): string | undefined => {
    if (!ids) {
      const index = new Map<string, string>();
      ids = index;
      visitItems(graph.states, ([id, state]) => {
        if (!state.excluded) {index.set(stateKey(valuesOf(state.vars, names)), id);}
      });
    }
    return ids.get(stateKey(values));
  };
  find.add = (id: string, values: Value[]) => ids?.set(stateKey(values), id);
  return find;
};

export function mark(
  graph: Graph,
  marks: Iterable<Mark>,
  names: string[],
  rules: Rule[],
  find = finder(graph, names),
) {
  const byName = new Map<string, Rule>();
  visitItems(rules, (rule) => {byName.set(rule.name, rule);});
  const past: Past = new Map();
  visitItems(marks, ({ values, broken }) => {
    const id = find(values);
    const state = matchesUndefined(id) ? undefined : graph.states.get(id);
    for (const name of broken) {
      const rule = must(byName, name);
      if (state) {state.breaks.push(rule);}
      else {past.set(stateKey(values), (past.get(stateKey(values)) ?? new Set()).add(rule));}
    }
  });
  return past;
}

export function deadEnds(graph: Graph, rule: Rule): void {
  const from = new Set<string>();
  visitItems(graph.steps, (currentStep) => {from.add(currentStep.from);});
  visitItems(graph.states, ([id, s]) => {if (!s.past && !from.has(id)) {s.breaks.push(rule);}});
}

export function addPast(
  graph: Graph,
  counterexample: TraceState[],
  names: string[],
  rule: Rule,
  past: Past,
  excludes: boolean,
  find = finder(graph, names),
): void {
  const trace = findTrace(counterexample, names, rule, find);
  const end = trace.length - 1;
  const from = trace[end - 1]?.id;
  const {action} = trace[end];
  const taken = (to: string | undefined): boolean => {
    for (const currentStep of graph.steps)
      {if (currentStep.from === from && currentStep.to === to && currentStep.action === action) {return true;}}
    return false;
  };
  let to = trace[end].id;
  const reached = matchesUndefined(to) ? undefined : graph.states.get(to);
  const excluded = excludes && !matchesUndefined(reached) && end > 0 && !reached.past && !taken(to);
  if (excluded) {to = `past ${to} ${action} ${from}`;}
  to ??= `past ${graph.states.size}`;
  let last = graph.states.get(to);
  if (!last) {
    const marked = excluded ? reached.breaks : (past.get(stateKey(trace[end].values)) ?? []);
    last = pastState(trace[end].vars, end === 0, marked, excluded);
    graph.states.set(to, last);
    if (!excluded) {find.add(to, trace[end].values);}
  }
  if (!hasRule(last.breaks, rule)) {last.breaks.push(rule);}
  (last.ends ??= []).push(rule);
  if (!matchesUndefined(from) && last.past && !taken(to)) {graph.steps.push({ from, to, action });}
}

export function lasso(
  graph: Graph,
  trace: Trace,
  names: string[],
  find = finder(graph, names),
): Lasso | undefined {
  const { seq, loop } = findLoop(trace, names, find);
  const start = seq[0]?.id;
  if (matchesUndefined(start)) {return undefined;}
  const out = new Map<string | undefined, Step[]>();
  visitItems(seq, (s) => {out.set(s.id, []);});
  visitItems(graph.steps, (currentStep) => {out.get(currentStep.from)?.push(currentStep);});
  const route: PathStep[] = [];
  for (let i = 1; i < seq.length; i++) {
    let step: Step | undefined;
    for (const stepItem of out.get(seq[i - 1].id) ?? [])
      {if (stepItem.to === seq[i].id && stepItem.action === seq[i].action) {
        step = stepItem;
        break;
      }}
    if (!step) {return undefined;}
    route.push({ action: step.action, state: step.to, step });
  }
  const stutters = loop === seq.length - 1;
  return {
    start,
    path: route,
    loop,
    stutters,
  };
}
