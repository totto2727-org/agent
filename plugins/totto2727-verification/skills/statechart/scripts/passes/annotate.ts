import { findLoop, findTrace, hasRule, matchesUndefined, must, pastState, stateKey, valuesOf, visitItems } from '#statechart/ir.ts';
import type { Graph, Lasso, Mark, Past, PathStep, Rule, State, Step, Trace, TraceState, Value, Vars } from '#statechart/ir.ts';

interface StateFinder {
  (values: Value[]): string | undefined;
  add: (id: string, values: Value[]) => Map<string, string> | undefined;
}

interface Lookup {
  find?: StateFinder;
  names: string[];
}

const FIRST_STATE = 0;
const PREVIOUS_STEP = 1;

export const finder = (graph: Graph, names: string[]): StateFinder => {
  const cache: { ids?: Map<string, string> } = {};
  const find = (values: Value[]): string | undefined => {
    if (!cache.ids) {
      const index = new Map<string, string>();
      cache.ids = index;
      visitItems(graph.states, ([id, state]) => {
        if (!(state.excluded ?? false)) {index.set(stateKey(valuesOf(state.vars, names)), id);}
      });
    }
    return cache.ids.get(stateKey(values));
  };
  find.add = (id: string, values: Value[]) => cache.ids?.set(stateKey(values), id);
  return find;
};

export const mark = function mark(
  graph: Graph,
  marks: Iterable<Mark>,
  { names, rules, find = finder(graph, names) }: Lookup & { rules: Rule[] },
): Past {
  const byName = new Map<string, Rule>();
  visitItems(rules, (rule) => {byName.set(rule.name, rule);});
  const past: Past = new Map();
  visitItems(marks, ({ values, broken }) => {
    const id = find(values);
    const state = matchesUndefined(id) ? undefined : graph.states.get(id);
    visitItems(broken, (name) => {
      const rule = must(byName, name);
      if (state) {state.breaks.push(rule);}
      else {
        const key = stateKey(values);
        past.set(key, (past.get(key) ?? new Set()).add(rule));
      }
    });
  });
  return past;
};

export const deadEnds = function deadEnds(graph: Graph, rule: Rule): void {
  const from = new Set<string>();
  visitItems(graph.steps, (currentStep) => {from.add(currentStep.from);});
  visitItems(graph.states, ([id, state]) => {if (!state.past && !from.has(id)) {state.breaks.push(rule);}});
};

interface ReplayEnd {
  action: string;
  excluded: boolean;
  from: string | undefined;
  inherited: Rule[] | undefined;
  initial: boolean;
  taken: (to: string | undefined) => boolean;
  to: string;
  values: Value[];
  vars: Vars;
}

const replayEnd = (graph: Graph, trace: ReturnType<typeof findTrace<string>>, excludes: boolean): ReplayEnd => {
  const end = trace.length - PREVIOUS_STEP;
  const from = trace[end - PREVIOUS_STEP]?.id;
  const { action, id, values, vars } = trace[end];
  const taken = (to: string | undefined): boolean =>
    graph.steps.some((step) => step.from === from && step.to === to && step.action === action);
  const reached = matchesUndefined(id) ? undefined : graph.states.get(id);
  const excluded = excludes && !matchesUndefined(reached) && end > FIRST_STATE && !reached.past && !taken(id);
  const to = excluded ? `past ${id} ${action} ${from}` : id ?? `past ${graph.states.size}`;
  return { action, excluded, from, inherited: excluded ? reached.breaks : undefined, initial: end === FIRST_STATE, taken, to, values, vars };
};

const recordState = (graph: Graph, end: ReplayEnd, { find, past }: { find: StateFinder; past: Past }): State => {
  const existing = graph.states.get(end.to);
  if (existing) {return existing;}
  const marked = end.inherited ?? past.get(stateKey(end.values)) ?? [];
  const recorded = pastState(end.vars, end.initial, marked, end.excluded);
  graph.states.set(end.to, recorded);
  if (!end.excluded) {find.add(end.to, end.values);}
  return recorded;
};

export type PastLookup = Lookup & { excludes: boolean; past: Past };

export const addPast = function addPast(
  graph: Graph,
  counterexample: TraceState[],
  { excludes, names, past, rule, find = finder(graph, names) }: PastLookup & { rule: Rule },
): void {
  const trace = findTrace(counterexample, names, rule, find);
  const end = replayEnd(graph, trace, excludes);
  const last = recordState(graph, end, { find, past });
  if (!hasRule(last.breaks, rule)) {last.breaks.push(rule);}
  (last.ends ??= []).push(rule);
  const { action, from, to } = end;
  if (!matchesUndefined(from) && last.past && !end.taken(to)) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the replay graph's existing step key order.
    graph.steps.push({ from, to, action });
  }
};

const outgoingSteps = (graph: Graph, seq: { id: string | undefined }[]): Map<string | undefined, Step[]> => {
  const out = new Map<string | undefined, Step[]>();
  visitItems(seq, (state) => {out.set(state.id, []);});
  visitItems(graph.steps, (step) => {out.get(step.from)?.push(step);});
  return out;
};

export const lasso = function lasso(graph: Graph, trace: Trace, { names, find = finder(graph, names) }: Lookup): Lasso | undefined {
  const { seq, loop } = findLoop(trace, names, find);
  const start = seq[FIRST_STATE]?.id;
  if (matchesUndefined(start)) {return undefined;}
  const out = outgoingSteps(graph, seq);
  const route: PathStep[] = [];
  const missingStep = seq.some((state, index) => {
    if (index === FIRST_STATE) {return false;}
    const step = out.get(seq[index - PREVIOUS_STEP].id)?.find((candidate) => candidate.to === state.id && candidate.action === state.action);
    if (matchesUndefined(step)) {return true;}
    route.push({ action: step.action, state: step.to, step });
    return false;
  });
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the field order returned for a replayed counterexample.
  return missingStep ? undefined : { start, path: route, loop, stutters: loop === seq.length - PREVIOUS_STEP };
};
