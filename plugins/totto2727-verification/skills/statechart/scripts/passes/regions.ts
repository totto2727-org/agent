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

interface RegionMove {
  f: number;
  t: number;
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
  for (const [index, name] of names.entries()) {
    const key = keys[index];
    const kind = kinds[index];
    const states = new Map<string, ChartState>();
    const objectOf = new Array<ChartState>(sizes[index]);
    const keyOf = new Array<string>(sizes[index]);
    const position = new Int32Array(sizes[index]);
    visitItems(order, (i) => {
      const currentState = tla[i];
      let stateItem = objectOf[kind[i]];
      if (!stateItem) {
        stateItem = {
          path: shapes[i][name],
          start: false,
          members: [],
          works: false,
          lead: false,
          repeats: false,
          breaks: [],
          group: undefined,
        };
        objectOf[kind[i]] = stateItem;
        keyOf[kind[i]] = key[i];
        position[kind[i]] = states.size;
        states.set(key[i], stateItem);
      }
      stateItem.start ||= currentState.start;
      stateItem.works ||= clean[i] === FLAG_SET;
      stateItem.lead ||= lead[i] === FLAG_SET;
      stateItem.repeats ||= looped[i] === FLAG_SET;
      stateItem.members.push(i);
    });
    const parents = new Set<string>();
    visitItems(states.values(), (state) => {for (let i = 1; i < state.path.length; i++) {parents.add(tupleKey(state.path.slice(0, i)));}});
    visitItems(states.values(), (state) => {
      if (parents.size && parents.has(tupleKey(state.path)))
        {throw new Error(
          `The view's state() returned ${state.path.join(" / ")} both as a state and as a parent state${name ? ` in ${name}` : ""}. Give that state a child name of its own.`,
        );}
      const rules = new Map<string, Rule>();
      visitItems(state.members, (i) => {for (const rule of tla[i].breaks) {rules.set(ruleKey(rule), rule);}});
      state.breaks = [];
      visitItems([...rules.values()].sort(
        (left, right) => byText(left.name, right.name) || byText(left.kind, right.kind),
      ), (rule) => {
        let always = true;
        for (const i of state.members) {always &&= hasRule(tla[i].breaks, rule);}
        state.breaks.push({ rule, always });
      });
      const groups = new Set<unknown>();
      visitItems(state.members, (i) => {groups.add(group(i));});
      state.group = groups.size === 1 ? [...groups][0] : undefined;
    });
    const others: number[] = [];
    for (let o = 0; o < regionCount; o++) {if (o !== index) {others.push(o);}}
    const tuple = (i: number): string[] => {
      const t: string[] = [];
      visitItems(others, (o) => {t.push(keys[o][i]);});
      return t;
    };
    const two = others.length === 1;
    const words = (vs: Iterable<string>): string => {
      const texts: string[] = [];
      visitItems(vs, (v) => {texts.push(unkey(v).join(" / "));});
      return texts.sort(byText).join(two ? " or " : ", ");
    };
    const is = (o: number, vs: Set<string>): string =>
      two ? `when ${words(vs)}` : `${names[o]} is ${vs.size > 1 ? "one of " : ""}${words(vs)}`;
    const isNot = (o: number, vs: string[]): string =>
      two
        ? `unless ${words(vs)}`
        : `${names[o]} is ${vs.length > 1 ? "none of" : "not"} ${words(vs)}`;
    const moves: RegionMove[] = [];
    const pairs = new Map<number, RegionMove>();
    const size = sizes[index];
    visitItems(sorted, (j) => {
      const f = kind[from[j]];
      const t = kind[to[j]];
      if (f === t && !loop(j)) {return;}
      const text = drawnLabels[j];
      const pair = position[f] * size + position[t];
      let move = pairs.get(pair);
      while (move && move.text !== text) {move = move.other;}
      if (!move) {
        move = { f, t, text, group: [], other: pairs.get(pair) };
        pairs.set(pair, move);
        moves.push(move);
      }
      if (regionCount > SINGLE_REGION) {move.group.push(j);}
    });
    const tuplesAt = new Map<number, number[]>();
    const seenAt = new Map<number, string[][]>();
    if (regionCount > SINGLE_REGION) {visitItems(order, (i) => {append(tuplesAt, kind[i], i);});}
    const arrows: Arrow[] = [];
    visitItems(moves, (move) => {
      const fromKey = keyOf[move.f];
      const toKey = keyOf[move.t];
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
      visitItems(move.group, (j) => {ok.add(tupleKey(tuple(from[j])));});
      const takes = (t: string[]): boolean => ok.has(tupleKey(t));
      let seen = seenAt.get(move.f);
      if (!seen) {
        const uniqueTuples: string[][] = [];
        seen = uniqueTuples;
        const seenKeys = new Set<string>();
        visitItems(must(tuplesAt, move.f), (i) => {
          const t = tuple(i);
          const k = tupleKey(t);
          if (seenKeys.has(k)) {return;}
          seenKeys.add(k);
          uniqueTuples.push(t);
        });
        seenAt.set(move.f, seen);
      }
      const all: Set<string>[] = [];
      const and: Set<string>[] = [];
      const or: Set<string>[] = [];
      for (let j = 0; j < others.length; j++) {
        const values = new Set<string>();
        const taken = new Set<string>();
        const untaken = new Set<string>();
        visitItems(seen, (t) => {
          values.add(t[j]);
          if (takes(t)) {taken.add(t[j]);}
          else {untaken.add(t[j]);}
        });
        const only = new Set<string>();
        visitItems(values, (value) => {if (!untaken.has(value)) {only.add(value);}});
        all.push(values);
        and.push(taken);
        or.push(only);
      }
      const fits = (condition: Condition): boolean => {
        for (const t of seen) {if (holds(condition, t) !== takes(t)) {return false;}}
        return true;
      };
      const andHolds: Condition = { kind: "and", otherKeys: and };
      const orHolds: Condition = { kind: "or", otherKeys: or };
      const {text} = move;
      if (fits(andHolds)) {
        const parts: string[] = [];
        for (let j = 0; j < others.length; j++) {
          const no: string[] = [];
          visitItems(all[j], (v) => {if (!and[j].has(v)) {no.push(v);}});
          if (no.length)
            {parts.push(and[j].size <= no.length ? is(others[j], and[j]) : isNot(others[j], no));}
        }
        arrows.push({
          from: fromKey,
          to: toKey,
          label: text,
          condition: andHolds,
          when: parts.length ? (two ? parts[0] : `when ${parts.join(" and ")}`) : undefined,
        });
      } else if (fits(orHolds)) {
        const parts: string[] = [];
        for (let j = 0; j < others.length; j++) {if (or[j].size) {parts.push(is(others[j], or[j]));}}
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
        from: objectOf[moves[itemIndex].f].path,
        to: objectOf[moves[itemIndex].t].path,
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
