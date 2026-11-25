import { byText, count, defaultState, matchesUndefined, must, ruleKey, sortBy, visitItems } from '#statechart/ir.ts';
import type { Bug, Graph, PathStep, Rule, State, Walk } from '#statechart/ir.ts';

const FIRST_INDEX = 0;
const INDEX_STEP = 1;
const ROOT_DEPTH = 0;
const UNREACHED_DEPTH = -1;
const NO_EDGE = -1;

export const walk = function walk(graph: Graph): Walk {
  const ids: string[] = [];
  const states: State[] = [];
  const nameOf: string[] = [];
  const starts: number[] = [];
  const unique = new Set<string>();
  visitItems(graph.states, ([id, state]) => {
    const name = defaultState(state.vars);
    if (state.start) {starts.push(ids.length);}
    ids.push(id);
    states.push(state);
    nameOf.push(name);
    unique.add(name);
  });
  const names = Array.from(unique).sort(byText);
  const rankOf = new Map<string, number>();
  visitItems(names.keys(), (nameIndex) => {rankOf.set(names[nameIndex], nameIndex);});
  const index = new Map<string, number>();
  const nameRank = new Int32Array(ids.length);
  visitItems(ids.keys(), (stateIndex) => {
    index.set(ids[stateIndex], stateIndex);
    nameRank[stateIndex] = must(rankOf, nameOf[stateIndex]);
  });
  const stepCount = graph.steps.length;
  const from = new Int32Array(stepCount);
  const to = new Int32Array(stepCount);
  const action = new Int32Array(stepCount);
  const actions = new Map<string, number>();
  const actionIndex = (name: string): number => {
    const existing = actions.get(name);
    if (!matchesUndefined(existing)) {return existing;}
    const added = actions.size;
    actions.set(name, added);
    return added;
  };
  visitItems(from.keys(), (stepIndex) => {
    const step = graph.steps[stepIndex];
    from[stepIndex] = must(index, step.from);
    to[stepIndex] = must(index, step.to);
    action[stepIndex] = actionIndex(step.action);
  });
  const actionRank = new Int32Array(actions.size);
  visitItems([...actions.keys()].sort(byText).entries(), ([rank, name]) => {actionRank[must(actions, name)] = rank;});
  const toName = new Int32Array(stepCount);
  visitItems(to.keys(), (stepIndex) => {
    action[stepIndex] = actionRank[action[stepIndex]];
    toName[stepIndex] = nameRank[to[stepIndex]];
  });
  const first = new Int32Array(ids.length + INDEX_STEP);
  visitItems(from, (source) => {first[source + INDEX_STEP] += INDEX_STEP;});
  visitItems(ids.keys(), (stateIndex) => {first[stateIndex + INDEX_STEP] += first[stateIndex];});
  const fill = first.slice(FIRST_INDEX, ids.length);
  const next = new Int32Array(stepCount);
  visitItems(sortBy(count(stepCount), [action, toName]), (stepIndex) => {
    const source = from[stepIndex];
    const slot = fill[source];
    fill[source] += INDEX_STEP;
    next[slot] = stepIndex;
  });
  starts.sort((left, right) => nameRank[left] - nameRank[right]);
  const depth = new Int32Array(ids.length).fill(UNREACHED_DEPTH);
  const via = new Int32Array(ids.length).fill(NO_EDGE);
  const reached = new Int32Array(ids.length);
  let queued = FIRST_INDEX;
  visitItems(starts, (stateIndex) => {
    depth[stateIndex] = ROOT_DEPTH;
    reached[queued] = stateIndex;
    queued += INDEX_STEP;
  });
  let queueIndex = FIRST_INDEX;
  while (queueIndex < queued) {
    const source = reached[queueIndex];
    let slot = first[source];
    while (slot < first[source + INDEX_STEP]) {
      const stepIndex = next[slot];
      const target = to[stepIndex];
      if (!(depth[target] >= ROOT_DEPTH)) {
        depth[target] = depth[source] + INDEX_STEP;
        via[target] = stepIndex;
        reached[queued] = target;
        queued += INDEX_STEP;
      }
      slot += INDEX_STEP;
    }
    queueIndex += INDEX_STEP;
  }
  return {
    ids,
    states,
    index,
    nameOf,
    nameRank,
    from,
    to,
    action,
    depth,
    via,
    reached: reached.subarray(FIRST_INDEX, queued),
    starts,
  };
};

export const drawOrder = function drawOrder({ depth, nameRank }: Walk) {
  let deepest = ROOT_DEPTH;
  visitItems(depth, (distance) => {deepest = Math.max(deepest, distance);});
  const level = new Int32Array(depth.length);
  visitItems(level.keys(), (stateIndex) => {
    const distance = depth[stateIndex];
    level[stateIndex] = distance < ROOT_DEPTH ? deepest + INDEX_STEP : distance;
  });
  const order = sortBy(count(depth.length), [level, nameRank]);
  const rank = new Int32Array(depth.length);
  visitItems(order.keys(), (position) => {rank[order[position]] = position;});
  return { order, rank };
};

export const bugs = function bugs(graph: Graph, { ids, from, via, reached }: Walk = walk(graph)) {
  const ends = new Map<string, string>();
  visitItems(graph.states, ([id, state]) => {
    visitItems(state.ends ?? [], (rule) => {ends.set(ruleKey(rule), id);});
  });
  const first = new Map<string, { rule: Rule; stateIndex: number }>();
  visitItems(reached, (stateIndex) => {
    const id = ids[stateIndex];
    const state = must(graph.states, id);
    visitItems(state.past ? state.ends : state.breaks, (rule) => {
      const ruleId = ruleKey(rule);
      if (!first.has(ruleId) && (ends.get(ruleId) ?? id) === id) {first.set(ruleId, { rule, stateIndex });}
    });
  });
  const found: Bug[] = [];
  visitItems(first.values(), ({ rule, stateIndex }) => {
    const path: PathStep[] = [];
    let start = stateIndex;
    let stepIndex = via[start];
    while (stepIndex >= FIRST_INDEX) {
      const step = graph.steps[stepIndex];
      path.unshift({ action: step.action, state: step.to, step });
      start = from[stepIndex];
      stepIndex = via[start];
    }
    found.push({ rule, start: ids[start], path });
  });
  return found;
};
