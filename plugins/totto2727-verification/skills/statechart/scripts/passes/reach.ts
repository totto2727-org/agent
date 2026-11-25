import { byText, count, defaultState, matchesUndefined, must, ruleKey, sortBy, visitItems } from "#statechart/ir.ts";
import type { Bug, Graph, PathStep, Rule, State, Walk } from "#statechart/ir.ts";

const FIRST_INDEX = 0;
const INDEX_STEP = 1;
const ROOT_DEPTH = 0;
const UNREACHED_DEPTH = -1;
const NO_EDGE = -1;

interface StateIndex {
  ids: string[];
  index: Map<string, number>;
  nameOf: string[];
  nameRank: Int32Array;
  starts: number[];
  states: State[];
}

const ranks = (names: Iterable<string>): Map<string, number> => {
  const result = new Map<string, number>();
  const ordered = [...names].toSorted(byText);
  ordered.forEach((name, index) => {result.set(name, index);});
  return result;
};

const indexStates = (graph: Graph): StateIndex => {
  const ids: string[] = [];
  const states: State[] = [];
  const nameOf: string[] = [];
  const starts: number[] = [];
  const unique = new Set<string>();
  const index = new Map<string, number>();
  visitItems(graph.states, ([id, state]) => {
    const name = defaultState(state.vars);
    if (state.start) {starts.push(ids.length);}
    index.set(id, ids.length);
    ids.push(id);
    states.push(state);
    nameOf.push(name);
    unique.add(name);
  });
  const rankOf = ranks(unique);
  return {
    ids,
    index,
    nameOf,
    nameRank: Int32Array.from(nameOf, (name) => must(rankOf, name)),
    starts,
    states,
  };
};

interface StepIndex {
  action: Int32Array;
  from: Int32Array;
  to: Int32Array;
  toName: Int32Array;
}

const actionIndex = (actions: Map<string, number>, name: string): number => {
  const existing = actions.get(name);
  if (!matchesUndefined(existing)) {return existing;}
  const added = actions.size;
  actions.set(name, added);
  return added;
};

const normalizeActions = (action: Int32Array, actions: Map<string, number>): void => {
  const ranking = ranks(actions.keys());
  const actionRank = new Int32Array(actions.size);
  visitItems(actions, ([name, index]) => {actionRank[index] = must(ranking, name);});
  visitItems(action.keys(), (index) => {action[index] = actionRank[action[index]];});
};

const indexSteps = (steps: Graph["steps"], { index, nameRank }: StateIndex): StepIndex => {
  const stepCount = steps.length;
  const from = new Int32Array(stepCount);
  const to = new Int32Array(stepCount);
  const action = new Int32Array(stepCount);
  const toName = new Int32Array(stepCount);
  const actions = new Map<string, number>();
  visitItems(from.keys(), (stepIndex) => {
    const step = steps[stepIndex];
    from[stepIndex] = must(index, step.from);
    to[stepIndex] = must(index, step.to);
    action[stepIndex] = actionIndex(actions, step.action);
    toName[stepIndex] = nameRank[to[stepIndex]];
  });
  normalizeActions(action, actions);
  return { action, from, to, toName };
};

interface Adjacency {
  first: Int32Array;
  next: Int32Array;
}

const adjacency = (stateCount: number, { action, from, toName }: StepIndex): Adjacency => {
  const first = new Int32Array(stateCount + INDEX_STEP);
  visitItems(from, (source) => {first[source + INDEX_STEP] += INDEX_STEP;});
  visitItems(first.subarray(INDEX_STEP).keys(), (index) => {first[index + INDEX_STEP] += first[index];});
  const fill = first.slice(FIRST_INDEX, stateCount);
  const next = new Int32Array(from.length);
  visitItems(sortBy(count(from.length), [action, toName]), (stepIndex) => {
    const source = from[stepIndex];
    const slot = fill[source];
    fill[source] += INDEX_STEP;
    next[slot] = stepIndex;
  });
  return { first, next };
};

interface Reachability {
  depth: Int32Array;
  reached: Int32Array;
  via: Int32Array;
}

class BreadthFirst {
  #depth: Int32Array;
  #reached: Int32Array;
  #via: Int32Array;
  #queued = FIRST_INDEX;
  #edges: Adjacency;
  #to: Int32Array;

  public constructor(stateCount: number, edges: Adjacency, to: Int32Array) {
    this.#depth = new Int32Array(stateCount).fill(UNREACHED_DEPTH);
    this.#via = new Int32Array(stateCount).fill(NO_EDGE);
    this.#reached = new Int32Array(stateCount);
    this.#edges = edges;
    this.#to = to;
  }

  #enqueue(target: number, depth: number, via: number): void {
    this.#depth[target] = depth;
    this.#via[target] = via;
    this.#reached[this.#queued] = target;
    this.#queued += INDEX_STEP;
  }

  #expand(source: number): void {
    const { first, next } = this.#edges;
    // oxlint-disable-next-line rules/no-let -- Walk one adjacency slice in place without allocating per reached state.
    let slot = first[source];
    while (slot < first[source + INDEX_STEP]) {
      const stepIndex = next[slot];
      const target = this.#to[stepIndex];
      if (!(this.#depth[target] >= ROOT_DEPTH)) {this.#enqueue(target, this.#depth[source] + INDEX_STEP, stepIndex);}
      slot += INDEX_STEP;
    }
  }

  public walk(starts: number[]): Reachability {
    visitItems(starts, (stateIndex) => {this.#enqueue(stateIndex, ROOT_DEPTH, NO_EDGE);});
    // oxlint-disable-next-line rules/no-let -- The BFS queue grows as states are reached and must be read through its final entry.
    let queueIndex = FIRST_INDEX;
    while (queueIndex < this.#queued) {
      this.#expand(this.#reached[queueIndex]);
      queueIndex += INDEX_STEP;
    }
    return { depth: this.#depth, reached: this.#reached.subarray(FIRST_INDEX, this.#queued), via: this.#via };
  }
}

export const walk = function walk(graph: Graph): Walk {
  const statesByIndex = indexStates(graph);
  const { ids, index, nameOf, nameRank, states } = statesByIndex;
  const steps = indexSteps(graph.steps, statesByIndex);
  const { action, from, to } = steps;
  const starts = statesByIndex.starts.toSorted((left, right) => nameRank[left] - nameRank[right]);
  const { depth, reached, via } = new BreadthFirst(ids.length, adjacency(ids.length, steps), to).walk(starts);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the established field order for serialized Statechart walks.
  return { ids, states, index, nameOf, nameRank, from, to, action, depth, via, reached, starts };
};

export const drawOrder = function drawOrder({ depth, nameRank }: Walk): { order: Int32Array; rank: Int32Array<ArrayBuffer> } {
  const longest = { depth: ROOT_DEPTH };
  visitItems(depth, (distance) => {longest.depth = Math.max(longest.depth, distance);});
  const level = Int32Array.from(depth, (distance) => distance < ROOT_DEPTH ? longest.depth + INDEX_STEP : distance);
  const order = sortBy(count(depth.length), [level, nameRank]);
  const rank = new Int32Array(depth.length);
  visitItems(order.keys(), (position) => {rank[order[position]] = position;});
  return { order, rank };
};

const endsOf = (graph: Graph): Map<string, string> => {
  const ends = new Map<string, string>();
  visitItems(graph.states, ([id, state]) => {
    visitItems(state.ends ?? [], (rule) => {ends.set(ruleKey(rule), id);});
  });
  return ends;
};

interface BrokenState {
  rule: Rule;
  stateIndex: number;
}

const firstBreaks = (graph: Graph, { ids, reached }: Walk): Map<string, BrokenState> => {
  const ends = endsOf(graph);
  const first = new Map<string, BrokenState>();
  visitItems(reached, (stateIndex) => {
    const id = ids[stateIndex];
    const state = must(graph.states, id);
    visitItems(state.past ? state.ends : state.breaks, (rule) => {
      const ruleId = ruleKey(rule);
      if (!first.has(ruleId) && (ends.get(ruleId) ?? id) === id) {first.set(ruleId, { rule, stateIndex });}
    });
  });
  return first;
};

const bugPath = ({ rule, stateIndex }: BrokenState, graph: Graph, { from, ids, via }: Walk): Bug => {
  const path: PathStep[] = [];
  const position = { index: stateIndex, step: via[stateIndex] };
  while (position.step >= FIRST_INDEX) {
    const step = graph.steps[position.step];
    path.unshift({ action: step.action, state: step.to, step });
    position.index = from[position.step];
    position.step = via[position.index];
  }
  // oxlint-disable-next-line eslint/sort-keys -- Preserve serialized bug field order for chart and report consumers.
  return { rule, start: ids[position.index], path };
};

export const bugs = function bugs(graph: Graph, traversal: Walk = walk(graph)): Bug[] {
  return Array.from(firstBreaks(graph, traversal).values(), (broken) => bugPath(broken, graph, traversal));
};
