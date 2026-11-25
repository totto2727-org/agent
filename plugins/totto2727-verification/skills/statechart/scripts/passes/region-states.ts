import { byText, hasRule, matchesUndefined, ruleKey, tupleKey, visitItems } from "#statechart/ir.ts";
import type { ChartState, Labels, Rule, Walk } from "#statechart/ir.ts";

const FIRST_PATH_POSITION = 0;
const FLAG_SET = 1;
const SINGLE_CHOICE = 1;

export interface RegionStates {
  keyOf: string[];
  objectOf: ChartState[];
  position: Int32Array;
  states: Map<string, ChartState>;
}

export interface StateFlags {
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

export const statesOfRegion = (regionIndex: number, input: RegionStateInput, flags: StateFlags): RegionStates => {
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
