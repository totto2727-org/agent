// oxlint-disable eslint/max-lines -- This pass keeps state grouping and arrow projection together so it depends only on the shared statechart IR.
import { append, byText, hasRule, holds, loopOf, matchesUndefined, must, ruleKey, seqOf, tupleKey, unkey, visitItems } from "#statechart/ir.ts";
import type { Arrow, Bug, Chart, ChartState, ChartStep, Condition, Labels, Region, Rule, View, Walk } from "#statechart/ir.ts";

const FIRST_PATH_POSITION = 0;
const SINGLE_REGION = 1;
const FLAG_SET = 1;
const SINGLE_CHOICE = 1;


interface RegionStates {
  keyOf: string[];
  objectOf: ChartState[];
  position: Int32Array;
  states: Map<string, ChartState>;
}

interface StateFlags {
  clean: Uint8Array;
  lead: Uint8Array;
  looped: Uint8Array;
}

interface RegionStateInput {
  labels: Labels;
  order: Int32Array;
  walk: Walk;
}

interface RegionMember {
  key: string;
  kind: number;
  name: string;
  stateIndex: number;
}

const chartState = (path: string[]): ChartState =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve established chart-state field order for renderers and snapshots.
  ({ path, start: false, members: [], works: false, lead: false, repeats: false, breaks: [], group: undefined });

const collectMember = ({ key, kind, name, stateIndex }: RegionMember, region: RegionStates, labels: Labels): ChartState => {
  const existing = region.objectOf[kind];
  if (!matchesUndefined(existing)) {return existing;}
  const state = chartState(labels.shapes[stateIndex][name]);
  region.objectOf[kind] = state;
  region.keyOf[kind] = key;
  region.position[kind] = region.states.size;
  region.states.set(key, state);
  return state;
};

const markMember = (state: ChartState, entry: { index: number; start: boolean }, { clean, lead, looped }: StateFlags): void => {
  state.start ||= entry.start;
  state.works ||= clean[entry.index] === FLAG_SET;
  state.lead ||= lead[entry.index] === FLAG_SET;
  state.repeats ||= looped[entry.index] === FLAG_SET;
  state.members.push(entry.index);
};

const parentPaths = (states: Iterable<ChartState>): Set<string> => {
  const parents = new Set<string>();
  visitItems(states, (state) => {
    visitItems(state.path.keys(), (depth) => {
      if (depth > FIRST_PATH_POSITION) {parents.add(tupleKey(state.path.slice(FIRST_PATH_POSITION, depth)));}
    });
  });
  return parents;
};

const stateRules = (state: ChartState, input: Walk["states"]): Rule[] => {
  const rules = new Map<string, Rule>();
  visitItems(state.members, (stateIndex) => {
    visitItems(input[stateIndex].breaks, (rule) => {rules.set(ruleKey(rule), rule);});
  });
  return [...rules.values()].toSorted((left, right) => byText(left.name, right.name) || byText(left.kind, right.kind));
};

const stateGroup = (state: ChartState, group: Labels["group"]): unknown => {
  const groups = new Set<unknown>();
  visitItems(state.members, (stateIndex) => {groups.add(group(stateIndex));});
  return groups.size === SINGLE_CHOICE ? groups.values().next().value : undefined;
};

const decorateStates = (name: string, states: Map<string, ChartState>, { labels, walk }: RegionStateInput): void => {
  const parents = parentPaths(states.values());
  visitItems(states.values(), (state) => {
    if (parents.size && parents.has(tupleKey(state.path))) {
      // oxlint-disable-next-line rules/require-tagged-error -- The standalone chart command exposes the existing synchronous view-validation error.
      throw new Error(`The view's state() returned ${state.path.join(" / ")} both as a state and as a parent state${name ? ` in ${name}` : ""}. Give that state a child name of its own.`);
    }
    state.breaks = stateRules(state, walk.states).map((rule) => {
      const always = state.members.every((stateIndex) => hasRule(walk.states[stateIndex].breaks, rule));
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of each rule and its occurrence flag.
      return { rule, always };
    });
    state.group = stateGroup(state, labels.group);
  });
};

const statesOfRegion = (regionIndex: number, input: RegionStateInput, flags: StateFlags): RegionStates => {
  const { labels, order, walk } = input;
  const name = labels.names[regionIndex];
  const kind = labels.kinds[regionIndex];
  const keys = labels.keys[regionIndex];
  const region: RegionStates = { keyOf: [], objectOf: [], position: new Int32Array(labels.sizes[regionIndex]), states: new Map() };
  visitItems(order, (stateIndex) => {
    const state = collectMember({ key: keys[stateIndex], kind: kind[stateIndex], name, stateIndex }, region, labels);
    markMember(state, { index: stateIndex, start: walk.states[stateIndex].start }, flags);
  });
  decorateStates(name, region.states, input);
  return region;
};

const FIRST_PART = 0;
const ANY_REST: Condition = { kind: "and", otherKeys: [] };

interface RegionMove {
  fromKind: number;
  group: number[];
  other: RegionMove | undefined;
  text: string;
  toKind: number;
}

interface ArrowInput {
  from: Walk["from"];
  keyOf: string[];
  labels: Labels;
  moves: RegionMove[];
  order: Int32Array;
}

interface Edge {
  from: string;
  label: string;
  to: string;
}

const edgeOf = (move: RegionMove, keys: string[]): Edge =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain from, to and label order in chart arrows.
  ({ from: keys[move.fromKind], to: keys[move.toKind], label: move.text });

type Takes = (candidate: string[]) => boolean;

interface Options {
  all: Set<string>[];
  and: Set<string>[];
  or: Set<string>[];
}

interface OtherOptions {
  all: Set<string>;
  and: Set<string>;
  or: Set<string>;
}

const optionsAt = (seen: string[][], takes: Takes, otherIndex: number): OtherOptions => {
  const values = new Set<string>();
  const taken = new Set<string>();
  const untaken = new Set<string>();
  visitItems(seen, (candidate) => {
    const value = candidate[otherIndex];
    values.add(value);
    if (takes(candidate)) {taken.add(value);}
    else {untaken.add(value);}
  });
  const only = new Set<string>();
  visitItems(values, (value) => {if (!untaken.has(value)) {only.add(value);}});
  return { all: values, and: taken, or: only };
};

const optionsIn = (others: number[], seen: string[][], takes: Takes): Options => {
  const options: Options = { all: [], and: [], or: [] };
  visitItems(others.keys(), (index) => {
    const { all, and, or } = optionsAt(seen, takes, index);
    options.all.push(all);
    options.and.push(and);
    options.or.push(or);
  });
  return options;
};

class OtherRegions {
  #labels: Labels;
  #others: number[];
  #two: boolean;
  #states = new Map<number, number[]>();
  #seen = new Map<number, string[][]>();

  public constructor(labels: Labels, regionIndex: number, order: Int32Array) {
    this.#labels = labels;
    this.#others = [...labels.names.keys()].filter((index) => index !== regionIndex);
    this.#two = this.#others.length === SINGLE_REGION;
    const kind = labels.kinds[regionIndex];
    visitItems(order, (stateIndex) => {append(this.#states, kind[stateIndex], stateIndex);});
  }

  #tuple(stateIndex: number): string[] {
    return this.#others.map((index) => this.#labels.keys[index][stateIndex]);
  }

  #candidates(kind: number): string[][] {
    const existing = this.#seen.get(kind);
    if (!matchesUndefined(existing)) {return existing;}
    const seen: string[][] = [];
    const known = new Set<string>();
    visitItems(must(this.#states, kind), (stateIndex) => {
      const candidate = this.#tuple(stateIndex);
      const tuple = tupleKey(candidate);
      if (known.has(tuple)) {return;}
      known.add(tuple);
      seen.push(candidate);
    });
    this.#seen.set(kind, seen);
    return seen;
  }

  #words(values: Iterable<string>): string {
    const paths = Array.from(values, (value) => unkey(value).join(" / "));
    return paths.toSorted(byText).join(this.#two ? " or " : ", ");
  }

  #include(regionIndex: number, values: Set<string>): string {
    const words = this.#words(values);
    if (this.#two) {return `when ${words}`;}
    const choice = values.size > SINGLE_CHOICE ? "one of " : "";
    return `${this.#labels.names[regionIndex]} is ${choice}${words}`;
  }

  #exclude(regionIndex: number, values: string[]): string {
    const words = this.#words(values);
    if (this.#two) {return `unless ${words}`;}
    const choice = values.length > SINGLE_CHOICE ? "none of" : "not";
    return `${this.#labels.names[regionIndex]} is ${choice} ${words}`;
  }

  #andWords({ all, and }: Options): string | undefined {
    const parts: string[] = [];
    visitItems(this.#others.keys(), (index) => {
      const regionIndex = this.#others[index];
      const taken = and[index];
      const excluded = [...all[index]].filter((value) => !taken.has(value));
      if (excluded.length) {
        parts.push(taken.size <= excluded.length ? this.#include(regionIndex, taken) : this.#exclude(regionIndex, excluded));
      }
    });
    if (!parts.length) {return undefined;}
    return this.#two ? parts[FIRST_PART] : `when ${parts.join(" and ")}`;
  }

  #orWords({ or }: Options): string {
    const parts: string[] = [];
    visitItems(this.#others.keys(), (index) => {
      const taken = or[index];
      if (taken.size) {parts.push(this.#include(this.#others[index], taken));}
    });
    return `when ${parts.join(" or ")}`;
  }

  public arrow(move: RegionMove, edge: Edge, from: Walk["from"]): Arrow {
    const ok = new Set<string>();
    visitItems(move.group, (stepIndex) => {ok.add(tupleKey(this.#tuple(from[stepIndex])));});
    const takes = (candidate: string[]): boolean => ok.has(tupleKey(candidate));
    const seen = this.#candidates(move.fromKind);
    const options = optionsIn(this.#others, seen, takes);
    return this.#condition(edge, { ok, options, seen, takes });
  }

  #condition(edge: Edge, { ok, options, seen, takes }: { ok: Set<string>; options: Options; seen: string[][]; takes: Takes }): Arrow {
    const fits = (condition: Condition): boolean => seen.every((candidate) => holds(condition, candidate) === takes(candidate));
    const and: Condition = { kind: "and", otherKeys: options.and };
    if (fits(and)) {return { ...edge, condition: and, when: this.#andWords(options) };}
    const or: Condition = { kind: "or", otherKeys: options.or };
    if (fits(or)) {return { ...edge, condition: or, when: this.#orWords(options) };}
    return { ...edge, condition: { kind: "tuples", otherTuples: ok } };
  }
}

const arrowsOfRegion = (regionIndex: number, { from, keyOf, labels, moves, order }: ArrowInput): Arrow[] => {
  if (labels.names.length === SINGLE_REGION) {
    return moves.map((move) => ({ ...edgeOf(move, keyOf), condition: ANY_REST, when: undefined }));
  }
  const others = new OtherRegions(labels, regionIndex, order);
  return moves.map((move) => others.arrow(move, edgeOf(move, keyOf), from));
};

const FIRST_REGION_INDEX = 0;
const NO_INSIDE_STEPS = 0;
const INSIDE_STEP_INCREMENT = 1;
const FLAG_CLEAR = 0;

interface PathFlags {
  lead: Uint8Array;
  looped: Uint8Array;
}

const pathFlags = (stateCount: number, index: Walk["index"], found: Bug[]): PathFlags => {
  const lead = new Uint8Array(stateCount);
  const looped = new Uint8Array(stateCount);
  visitItems(found, (bug) => {
    visitItems(seqOf(bug, index).slice(FIRST_PATH_POSITION, bug.loop), (stateIndex) => {lead[stateIndex] = FLAG_SET;});
    visitItems(loopOf(bug, index), (stateIndex) => {looped[stateIndex] = FLAG_SET;});
  });
  return { lead, looped };
};

const loopingSteps = ({ names, pathSteps }: Labels): ((stepIndex: number) => boolean) => {
  const singleRegion = names.length === SINGLE_REGION;
  return (stepIndex) => singleRegion && pathSteps[stepIndex] === FLAG_SET;
};

const insideSteps = ({ from, to }: Walk, { kinds, names, sorted }: Labels, loop: (stepIndex: number) => boolean): number => {
  const totals = { inside: NO_INSIDE_STEPS };
  visitItems(sorted, (stepIndex) => {
    const source = from[stepIndex];
    const target = to[stepIndex];
    const stays = names.every((_name, regionIndex) => kinds[regionIndex][source] === kinds[regionIndex][target]);
    if (stays && !loop(stepIndex)) {totals.inside += INSIDE_STEP_INCREMENT;}
  });
  return totals.inside;
};

const combinationOf = ({ kinds, names }: Labels): ((stateIndex: number) => number | string) => {
  if (names.length === SINGLE_REGION) {return (stateIndex) => kinds[FIRST_REGION_INDEX][stateIndex];}
  return (stateIndex) => names.map((_name, regionIndex) => String(kinds[regionIndex][stateIndex])).join(",");
};

interface DrawStates {
  order: Int32Array;
  walk: Walk;
}

const firstBrokenCombinations = ({ order, walk }: DrawStates, combination: (stateIndex: number) => number | string): Map<number | string, number> => {
  const dirty = new Map<number | string, number>();
  visitItems(order, (stateIndex) => {
    if (walk.states[stateIndex].breaks.length) {
      const combined = combination(stateIndex);
      if (!dirty.has(combined)) {dirty.set(combined, stateIndex);}
    }
  });
  return dirty;
};

interface CleanStates {
  clean: Uint8Array;
  dirty: Map<number | string, number>;
}

const cleanStates = (states: DrawStates, labels: Labels): CleanStates => {
  const combination = combinationOf(labels);
  const dirty = firstBrokenCombinations(states, combination);
  const clean = new Uint8Array(labels.shapes.length);
  if (dirty.size) {
    visitItems(clean.keys(), (stateIndex) => {clean[stateIndex] = dirty.has(combination(stateIndex)) ? FLAG_CLEAR : FLAG_SET;});
  } else {clean.fill(FLAG_SET);}
  return { clean, dirty };
};

interface MoveInput {
  labels: Labels;
  loop: (stepIndex: number) => boolean;
  position: Int32Array;
  walk: Walk;
}

const findMove = (head: RegionMove | undefined, text: string): RegionMove | undefined => {
  // oxlint-disable-next-line rules/no-let -- Scan the pair's linked labels in place without allocating a new lookup for each pair.
  let move = head;
  while (move && move.text !== text) {move = move.other;}
  return move;
};

interface MoveCatalog {
  moves: RegionMove[];
  pairs: Map<number, RegionMove>;
}

const recordMove = (pair: number, details: { fromKind: number; text: string; toKind: number }, catalog: MoveCatalog): RegionMove => {
  const head = catalog.pairs.get(pair);
  const found = findMove(head, details.text);
  if (!matchesUndefined(found)) {return found;}
  const move = { ...details, group: [], other: head };
  catalog.pairs.set(pair, move);
  catalog.moves.push(move);
  return move;
};

const movesOfRegion = (regionIndex: number, { labels, loop, position, walk }: MoveInput): RegionMove[] => {
  const { drawnLabels, kinds, names, sizes, sorted } = labels;
  const { from, to } = walk;
  const kind = kinds[regionIndex];
  const size = sizes[regionIndex];
  const catalog: MoveCatalog = { moves: [], pairs: new Map() };
  visitItems(sorted, (stepIndex) => {
    const fromKind = kind[from[stepIndex]];
    const toKind = kind[to[stepIndex]];
    if (fromKind === toKind && !loop(stepIndex)) {return;}
    const pair = position[fromKind] * size + position[toKind];
    const move = recordMove(pair, { fromKind, text: drawnLabels[stepIndex], toKind }, catalog);
    if (names.length > SINGLE_REGION) {move.group.push(stepIndex);}
  });
  return catalog.moves;
};

const stepsOfRegion = (arrows: Arrow[], moves: RegionMove[], { objectOf }: RegionStates): ChartStep[] =>
  arrows.map((item, itemIndex) => {
    const move = moves[itemIndex];
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the emitted chart-step field order.
    return { from: objectOf[move.fromKind].path, to: objectOf[move.toKind].path, label: item.label, when: item.label.endsWith("]") ? undefined : item.when };
  });

interface RegionDraw {
  flags: StateFlags;
  labels: Labels;
  loop: (stepIndex: number) => boolean;
  order: Int32Array;
  walk: Walk;
}

const drawRegion = (name: string, regionIndex: number, { flags, labels, loop, order, walk }: RegionDraw): { objects: ChartState[]; region: Region } => {
  const states = statesOfRegion(regionIndex, { labels, order, walk }, flags);
  const moves = movesOfRegion(regionIndex, { labels, loop, position: states.position, walk });
  const arrows = arrowsOfRegion(regionIndex, { from: walk.from, keyOf: states.keyOf, labels, moves, order });
  const steps = stepsOfRegion(arrows, moves, states);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the emitted chart-region field order.
  return { objects: states.objectOf, region: { name, states: [...states.states.values()], steps, arrows } };
};

const drawAll = (context: RegionDraw): { objects: ChartState[][]; regions: Region[] } => {
  const objects: ChartState[][] = [];
  const regions: Region[] = [];
  visitItems(context.labels.names.entries(), ([regionIndex, name]) => {
    const drawing = drawRegion(name, regionIndex, context);
    regions.push(drawing.region);
    objects.push(drawing.objects);
  });
  return { objects, regions };
};

const hideBroken = (objects: ChartState[][], dirty: Map<number | string, number>, kinds: Labels["kinds"]): void => {
  const hidden: ChartState[][] = [];
  visitItems(dirty.values(), (stateIndex) => {
    const matching = objects.map((states, regionIndex) => states[kinds[regionIndex][stateIndex]]);
    if (matching.every((state) => state.works)) {hidden.push(matching);}
  });
  visitItems(hidden, (matching) => {
    visitItems(matching, (state) => {state.works = false;});
  });
};

const bugNames = (found: Bug[]): { loops: string[]; paths: string[] } => {
  const paths: string[] = [];
  const loops: string[] = [];
  visitItems(found, (bug) => {
    if (bug.loop !== FIRST_PATH_POSITION) {paths.push(bug.rule.name);}
    if (!matchesUndefined(bug.loop)) {loops.push(bug.rule.name);}
  });
  return { loops, paths };
};

// oxlint-disable-next-line eslint/max-params -- Preserve the existing region assembly entry point used by the chart pipeline and callers.
export const drawRegions = function drawRegions(walk: Walk, labels: Labels, order: Int32Array, found: Bug[], view: View): Chart {
  const { shapes, drawnLabels, kinds, sorted, notes } = labels;
  const stepCount = drawnLabels.length;
  const { lead, looped } = pathFlags(shapes.length, walk.index, found);
  const loop = loopingSteps(labels);
  const inside = insideSteps(walk, labels, loop);
  const { clean, dirty } = cleanStates({ order, walk }, labels);
  const { regions, objects } = drawAll({ flags: { clean, lead, looped }, labels, loop, order, walk });
  hideBroken(objects, dirty, kinds);
  const { paths, loops } = bugNames(found);
  // oxlint-disable-next-line eslint/sort-keys -- Retain the established field order in serialized charts and reports.
  return { title: view.title, regions, notes, inside, quiet: stepCount - sorted.length, colors: view.colors ?? {}, paths, loops };
};
