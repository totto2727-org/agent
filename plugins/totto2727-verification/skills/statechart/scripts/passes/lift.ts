import { append, matchesUndefined, tupleKey, unkey, visitItems } from '#statechart/ir.ts';
import type { Chart, ChartState, ChartStep, Region } from '#statechart/ir.ts';

const PATH_START = 0;
const EMPTY_COUNT = 0;
const ONE_STATE = 1;
const MERGEABLE_CHILDREN = 2;
// Two path indices below 2^26 fit in a single exact integer key.
const PATH_KEY_BASE = 67_108_864;

interface Parent {
  count: number;
  depth: number;
}

const visitParentDepths = (path: string[], visit: (depth: number) => void): void => {
  path.forEach((_part, depth) => {if (depth > PATH_START) {visit(depth);}});
};

const parentsOf = (states: ChartState[]): Map<string, Parent> => {
  const parents = new Map<string, Parent>();
  visitItems(states, (state) => {
    visitParentDepths(state.path, (depth) => {
      const key = tupleKey(state.path.slice(PATH_START, depth));
      const parent = parents.get(key) ?? { count: EMPTY_COUNT, depth };
      parent.count += ONE_STATE;
      parents.set(key, parent);
    });
  });
  return parents;
};

const commonPrefixLength = ({ from, to }: ChartStep): number => {
  const match = { length: PATH_START };
  while (match.length < from.length && from[match.length] === to[match.length]) {match.length += ONE_STATE;}
  return match.length;
};

const stepsOutsideParents = (steps: ChartStep[], parents: Map<string, Parent>): Map<string, ChartStep[]> => {
  const leaving = new Map<string, ChartStep[]>();
  visitItems(steps, (step) => {
    const same = commonPrefixLength(step);
    visitParentDepths(step.from, (depth) => {
      if (depth <= same && depth < step.to.length) {return;}
      const prefix = tupleKey(step.from.slice(PATH_START, depth));
      if (parents.has(prefix)) {append(leaving, prefix, step);}
    });
  });
  return leaving;
};

const liftParentSteps = (prefix: string, leaves: number, { leaving, lifted, removed }: {
  leaving: ChartStep[];
  lifted: ChartStep[];
  removed: Set<ChartStep>;
}): void => {
  const groups = new Map<string, ChartStep[]>();
  visitItems(leaving, (step) => {
    if (!removed.has(step)) {append(groups, tupleKey([step.label, step.when, step.to]), step);}
  });
  visitItems(groups.values(), (group) => {
    if (leaves < MERGEABLE_CHILDREN || group.length < leaves) {return;}
    visitItems(group, (step) => {removed.add(step);});
    lifted.push({ ...group[PATH_START], from: unkey(prefix) });
  });
};

export const liftToParents = function liftToParents(states: ChartState[], steps: ChartStep[]): ChartStep[] {
  const parents = parentsOf(states);
  if (!parents.size) {return steps;}
  const leaving = stepsOutsideParents(steps, parents);
  const removed = new Set<ChartStep>();
  const lifted: ChartStep[] = [];
  const ordered = [...parents.entries()].toSorted(([, left], [, right]) => left.depth - right.depth);
  visitItems(ordered, ([prefix, parent]) => {
    liftParentSteps(prefix, parent.count, { leaving: leaving.get(prefix) ?? [], lifted, removed });
  });
  return [...steps.filter((step) => !removed.has(step)), ...lifted];
};

const pathIndexer = (states: ChartState[]): ((path: string[]) => number) => {
  const known = new Map<string[], number>();
  visitItems(states, (state) => {known.set(state.path, known.size);});
  const cache: { numbers?: Map<string, number> } = {};
  const pathNumbers = (): Map<string, number> => {
    if (cache.numbers) {return cache.numbers;}
    const indices = new Map<string, number>();
    cache.numbers = indices;
    visitItems(states, (state) => {indices.set(tupleKey(state.path), indices.size);});
    return indices;
  };
  return (path) => {
    const direct = known.get(path);
    if (!matchesUndefined(direct)) {return direct;}
    const numbers = pathNumbers();
    const text = tupleKey(path);
    const index = numbers.get(text) ?? numbers.size;
    numbers.set(text, index);
    known.set(path, index);
    return index;
  };
};

const liftRegion = (region: Region): Region => {
  const pathIndex = pathIndexer(region.states);
  const merged = new Map<number | string, ChartStep>();
  visitItems(liftToParents(region.states, region.steps), (step) => {
    const from = pathIndex(step.from);
    const to = pathIndex(step.to);
    const key = matchesUndefined(step.when) && from < PATH_KEY_BASE && to < PATH_KEY_BASE
      ? from * PATH_KEY_BASE + to
      : `${from},${to}:${step.when}`;
    const prior = merged.get(key);
    if (prior) {prior.label += ` or ${step.label}`;}
    else {merged.set(key, { ...step });}
  });
  return { ...region, steps: [...merged.values()] };
};

export const lift = function lift(chart: Chart): Chart {
  return { ...chart, regions: chart.regions.map((region) => liftRegion(region)) };
};
