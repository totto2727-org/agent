import { append, byText, hasRule, holds, loopOf, matchesUndefined, must, ruleKey, seqOf, tupleKey, unkey, visitItems } from '#statechart/ir.ts';
import type { Arrow, Bug, Chart, ChartState, ChartStep, Condition, Labels, Region, Rule, View, Walk } from '#statechart/ir.ts';

const anyRest: Condition = { kind: "and", otherKeys: [] };

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
  const n = shapes.length;
  const m = drawnLabels.length;
  const R = names.length;
  const lead = new Uint8Array(n);
  const looped = new Uint8Array(n);
  visitItems(found, (bug) => {
    visitItems(seqOf(bug, index).slice(0, bug.loop), (i) => {lead[i] = 1;});
    visitItems(loopOf(bug, index), (i) => {looped[i] = 1;});
  });
  const loop = (j: number): boolean => R === 1 && pathSteps[j] === 1;
  const stays = (j: number): boolean => {
    for (let r = 0; r < R; r++) {if (kinds[r][from[j]] !== kinds[r][to[j]]) {return false;}}
    return true;
  };
  let inside = 0;
  visitItems(sorted, (j) => {if (stays(j) && !loop(j)) {inside++;}});
  const comboOf =
    R === 1
      ? (i: number) => kinds[0][i]
      : (i: number) => {
          let c = "";
          for (let r = 0; r < R; r++) {c += (r ? "," : "") + kinds[r][i];}
          return c;
        };
  const dirty = new Map<number | string, number>();
  visitItems(order, (i) => {if (tla[i].breaks.length) {
      const c = comboOf(i);
      if (!dirty.has(c)) {dirty.set(c, i);}
    }});
  const clean = new Uint8Array(n);
  if (dirty.size) {for (let i = 0; i < n; i++) {clean[i] = dirty.has(comboOf(i)) ? 0 : 1;}}
  else {clean.fill(1);}
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
      stateItem.works ||= clean[i] === 1;
      stateItem.lead ||= lead[i] === 1;
      stateItem.repeats ||= looped[i] === 1;
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
    for (let o = 0; o < R; o++) {if (o !== index) {others.push(o);}}
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
      if (R > 1) {move.group.push(j);}
    });
    const tuplesAt = new Map<number, number[]>();
    const seenAt = new Map<number, string[][]>();
    if (R > 1) {visitItems(order, (i) => {append(tuplesAt, kind[i], i);});}
    const arrows: Arrow[] = [];
    visitItems(moves, (move) => {
      const fromKey = keyOf[move.f];
      const toKey = keyOf[move.t];
      if (R === 1) {
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
  visitItems(dirty.values(), (i) => {
    const ps: ChartState[] = [];
    for (let r = 0; r < R; r++) {ps.push(objects[r][kinds[r][i]]);}
    let works = true;
    visitItems(ps, (currentState) => {works &&= currentState.works;});
    if (works) {hidden.push(ps);}
  });
  visitItems(hidden, (ps) => {visitItems(ps, (currentState) => {currentState.works = false;});});
  const paths: string[] = [];
  const loops: string[] = [];
  visitItems(found, (bug) => {
    if (bug.loop !== 0) {paths.push(bug.rule.name);}
    if (!matchesUndefined(bug.loop)) {loops.push(bug.rule.name);}
  });
  return {
    title: view.title,
    regions,
    notes,
    inside,
    quiet: m - sorted.length,
    colors: view.colors ?? {},
    paths,
    loops,
  };
};
