import { append, byText, hasRule, holds, loopOf, matchesUndefined, must, ruleKey, seqOf, tupleKey, unkey, visitItems } from '#statechart/ir.ts';
import type { Arrow, Bug, Chart, ChartState, ChartStep, Condition, Labels, Region, Rule, View, Walk } from '#statechart/ir.ts';

const anyRest: Condition = { kind: "and", otherKeys: [] };
const FIRST_REGION_INDEX = 0;
const FIRST_PATH_POSITION = 0;
const REGION_INDEX_STEP = 1;
const SINGLE_REGION = 1;
const NO_INSIDE_STEPS = 0;
const INSIDE_STEP_INCREMENT = 1;
const FLAG_SET = 1;
const FLAG_CLEAR = 0;
const SINGLE_CHOICE = 1;

interface RegionMove {
  fromKind: number;
  toKind: number;
  text: string;
  group: number[];
  other: RegionMove | undefined;
}

export const drawRegions = function drawRegions(
  { states: tla, index, from, to }: Walk,
  { names, shapes, drawnLabels, group, keys, kinds, sizes, sorted, pathSteps, notes }: Labels,
  order: Int32Array,
  found: Bug[],
  view: View,
): Chart {
  const stateCount = shapes.length;
  const stepCount = drawnLabels.length;
  const regionCount = names.length;
  const lead = new Uint8Array(stateCount);
  const looped = new Uint8Array(stateCount);
  visitItems(found, (bug) => {
    visitItems(seqOf(bug, index).slice(FIRST_PATH_POSITION, bug.loop), (stateIndex) => {lead[stateIndex] = FLAG_SET;});
    visitItems(loopOf(bug, index), (stateIndex) => {looped[stateIndex] = FLAG_SET;});
  });
  const loop = (stepIndex: number): boolean => regionCount === SINGLE_REGION && pathSteps[stepIndex] === FLAG_SET;
  const stays = (stepIndex: number): boolean => {
    let regionIndex = FIRST_REGION_INDEX;
    while (regionIndex < regionCount) {
      if (kinds[regionIndex][from[stepIndex]] !== kinds[regionIndex][to[stepIndex]]) {return false;}
      regionIndex += REGION_INDEX_STEP;
    }
    return true;
  };
  let inside = NO_INSIDE_STEPS;
  visitItems(sorted, (stepIndex) => {
    if (stays(stepIndex) && !loop(stepIndex)) {inside += INSIDE_STEP_INCREMENT;}
  });
  const comboOf = regionCount === SINGLE_REGION
    ? (stateIndex: number): number => kinds[FIRST_REGION_INDEX][stateIndex]
    : (stateIndex: number): string => {
        let combined = "";
        let regionIndex = FIRST_REGION_INDEX;
        while (regionIndex < regionCount) {
          const separator = regionIndex === FIRST_REGION_INDEX ? "" : ",";
          combined += separator + kinds[regionIndex][stateIndex];
          regionIndex += REGION_INDEX_STEP;
        }
        return combined;
      };
  const dirty = new Map<number | string, number>();
  visitItems(order, (stateIndex) => {
    if (tla[stateIndex].breaks.length) {
      const combined = comboOf(stateIndex);
      if (!dirty.has(combined)) {dirty.set(combined, stateIndex);}
    }
  });
  const clean = new Uint8Array(stateCount);
  if (dirty.size) {
    visitItems(clean.keys(), (stateIndex) => {
      clean[stateIndex] = dirty.has(comboOf(stateIndex)) ? FLAG_CLEAR : FLAG_SET;
    });
  } else {clean.fill(FLAG_SET);}
  const regions: Region[] = [];
  const objects: ChartState[][] = [];
  for (const [regionIndex, name] of names.entries()) {
    const regionKeys = keys[regionIndex];
    const kind = kinds[regionIndex];
    const states = new Map<string, ChartState>();
    const objectOf: ChartState[] = [];
    const keyOf: string[] = [];
    const position = new Int32Array(sizes[regionIndex]);
    visitItems(order, (stateIndex) => {
      const currentState = tla[stateIndex];
      const stateKind = kind[stateIndex];
      const existing = objectOf[stateKind];
      const stateItem = existing ?? {
        path: shapes[stateIndex][name],
        start: false,
        members: [],
        works: false,
        lead: false,
        repeats: false,
        breaks: [],
        group: undefined,
      };
      if (matchesUndefined(existing)) {
        objectOf[stateKind] = stateItem;
        keyOf[stateKind] = regionKeys[stateIndex];
        position[stateKind] = states.size;
        states.set(regionKeys[stateIndex], stateItem);
      }
      stateItem.start ||= currentState.start;
      stateItem.works ||= clean[stateIndex] === FLAG_SET;
      stateItem.lead ||= lead[stateIndex] === FLAG_SET;
      stateItem.repeats ||= looped[stateIndex] === FLAG_SET;
      stateItem.members.push(stateIndex);
    });
    const parents = new Set<string>();
    visitItems(states.values(), (state) => {
      visitItems(state.path.keys(), (depth) => {
        if (depth > FIRST_PATH_POSITION) {parents.add(tupleKey(state.path.slice(FIRST_PATH_POSITION, depth)));}
      });
    });
    visitItems(states.values(), (state) => {
      if (parents.size && parents.has(tupleKey(state.path)))
        {throw new Error(
          `The view's state() returned ${state.path.join(" / ")} both as a state and as a parent state${name ? ` in ${name}` : ""}. Give that state a child name of its own.`,
        );}
      const rules = new Map<string, Rule>();
      visitItems(state.members, (stateIndex) => {
        visitItems(tla[stateIndex].breaks, (rule) => {rules.set(ruleKey(rule), rule);});
      });
      state.breaks = [];
      visitItems([...rules.values()].sort(
        (left, right) => byText(left.name, right.name) || byText(left.kind, right.kind),
      ), (rule) => {
        const always = state.members.every((stateIndex) => hasRule(tla[stateIndex].breaks, rule));
        state.breaks.push({ rule, always });
      });
      const groups = new Set<unknown>();
      visitItems(state.members, (stateIndex) => {groups.add(group(stateIndex));});
      state.group = groups.size === SINGLE_CHOICE ? groups.values().next().value : undefined;
    });
    const others = [...names.keys()].filter((otherRegion) => otherRegion !== regionIndex);
    const tuple = (stateIndex: number): string[] => others.map((otherRegion) => keys[otherRegion][stateIndex]);
    const two = others.length === SINGLE_REGION;
    const words = (values: Iterable<string>): string => {
      const texts: string[] = [];
      visitItems(values, (value) => {texts.push(unkey(value).join(" / "));});
      return texts.sort(byText).join(two ? " or " : ", ");
    };
    const is = (otherRegion: number, values: Set<string>): string =>
      two ? `when ${words(values)}` : `${names[otherRegion]} is ${values.size > SINGLE_CHOICE ? "one of " : ""}${words(values)}`;
    const isNot = (otherRegion: number, values: string[]): string =>
      two
        ? `unless ${words(values)}`
        : `${names[otherRegion]} is ${values.length > SINGLE_CHOICE ? "none of" : "not"} ${words(values)}`;
    const moves: RegionMove[] = [];
    const pairs = new Map<number, RegionMove>();
    const size = sizes[regionIndex];
    visitItems(sorted, (stepIndex) => {
      const fromKind = kind[from[stepIndex]];
      const toKind = kind[to[stepIndex]];
      if (fromKind === toKind && !loop(stepIndex)) {return;}
      const text = drawnLabels[stepIndex];
      const pair = position[fromKind] * size + position[toKind];
      let move = pairs.get(pair);
      while (move && move.text !== text) {move = move.other;}
      if (!move) {
        move = { fromKind, toKind, text, group: [], other: pairs.get(pair) };
        pairs.set(pair, move);
        moves.push(move);
      }
      if (regionCount > SINGLE_REGION) {move.group.push(stepIndex);}
    });
    const tuplesAt = new Map<number, number[]>();
    const seenAt = new Map<number, string[][]>();
    if (regionCount > SINGLE_REGION) {visitItems(order, (stateIndex) => {append(tuplesAt, kind[stateIndex], stateIndex);});}
    const arrows: Arrow[] = [];
    visitItems(moves, (move) => {
      const fromKey = keyOf[move.fromKind];
      const toKey = keyOf[move.toKind];
      if (regionCount === SINGLE_REGION) {
        arrows.push({
          from: fromKey,
          to: toKey,
          label: move.text,
          condition: anyRest,
          when: undefined,
        });
        return;
      }
      const ok = new Set<string>();
      visitItems(move.group, (stepIndex) => {ok.add(tupleKey(tuple(from[stepIndex])));});
      const takes = (candidate: string[]): boolean => ok.has(tupleKey(candidate));
      const existing = seenAt.get(move.fromKind);
      const seen = existing ?? [];
      if (matchesUndefined(existing)) {
        const seenKeys = new Set<string>();
        visitItems(must(tuplesAt, move.fromKind), (stateIndex) => {
          const candidate = tuple(stateIndex);
          const tupleId = tupleKey(candidate);
          if (seenKeys.has(tupleId)) {return;}
          seenKeys.add(tupleId);
          seen.push(candidate);
        });
        seenAt.set(move.fromKind, seen);
      }
      const all: Set<string>[] = [];
      const and: Set<string>[] = [];
      const or: Set<string>[] = [];
      visitItems(others.keys(), (otherIndex) => {
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
        all.push(values);
        and.push(taken);
        or.push(only);
      });
      const fits = (condition: Condition): boolean =>
        seen.every((candidate) => holds(condition, candidate) === takes(candidate));
      const andHolds: Condition = { kind: "and", otherKeys: and };
      const orHolds: Condition = { kind: "or", otherKeys: or };
      const {text} = move;
      if (fits(andHolds)) {
        const parts: string[] = [];
        visitItems(others.keys(), (otherIndex) => {
          const excluded: string[] = [];
          const taken = and[otherIndex];
          visitItems(all[otherIndex], (value) => {if (!taken.has(value)) {excluded.push(value);}});
          if (excluded.length) {
            const otherRegion = others[otherIndex];
            parts.push(taken.size <= excluded.length ? is(otherRegion, taken) : isNot(otherRegion, excluded));
          }
        });
        arrows.push({
          from: fromKey,
          to: toKey,
          label: text,
          condition: andHolds,
          when: parts.length ? (two ? parts[FIRST_PATH_POSITION] : `when ${parts.join(" and ")}`) : undefined,
        });
      } else if (fits(orHolds)) {
        const parts: string[] = [];
        visitItems(others.keys(), (otherIndex) => {
          const taken = or[otherIndex];
          if (taken.size) {parts.push(is(others[otherIndex], taken));}
        });
        arrows.push({
          from: fromKey,
          to: toKey,
          label: text,
          condition: orHolds,
          when: `when ${parts.join(" or ")}`,
        });
      } else
        {arrows.push({
          from: fromKey,
          to: toKey,
          label: text,
          condition: { kind: "tuples", otherTuples: ok },
        });}
    });
    const steps: ChartStep[] = [];
    visitItems(arrows.entries(), ([itemIndex, item]) => {steps.push({
        from: objectOf[moves[itemIndex].fromKind].path,
        to: objectOf[moves[itemIndex].toKind].path,
        label: item.label,
        when: item.label.endsWith("]") ? undefined : item.when,
      });});
    regions.push({ name, states: [...states.values()], steps, arrows });
    objects.push(objectOf);
  }
  const hidden: ChartState[][] = [];
  visitItems(dirty.values(), (stateIndex) => {
    const matching = objects.map((states, regionIndex) => states[kinds[regionIndex][stateIndex]]);
    if (matching.every((state) => state.works)) {hidden.push(matching);}
  });
  visitItems(hidden, (matching) => {
    visitItems(matching, (currentState) => {currentState.works = false;});
  });
  const paths: string[] = [];
  const loops: string[] = [];
  visitItems(found, (bug) => {
    if (bug.loop !== FIRST_PATH_POSITION) {paths.push(bug.rule.name);}
    if (!matchesUndefined(bug.loop)) {loops.push(bug.rule.name);}
  });
  return {
    title: view.title,
    regions,
    notes,
    inside,
    quiet: stepCount - sorted.length,
    colors: view.colors ?? {},
    paths,
    loops,
  };
};
