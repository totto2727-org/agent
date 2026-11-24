import { append, byText, hasRule, holds, loopOf, matchesUndefined, must, ruleKey, seqOf, tupleKey, unkey } from '../ir.ts';
import type { Arrow, Bug, Chart, ChartState, ChartStep, Condition, Labels, Region, Rule, View, Walk } from '../ir.ts';

const anyRest: Condition = { kind: "and", otherKeys: [] };

type RegionMove = {
  f: number;
  t: number;
  text: string;
  group: number[];
  other: RegionMove | undefined;
};

export function drawRegions(
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
  Iterator.from(found).forEach((b) => {
    for (const i of seqOf(b, index).slice(0, b.loop)) {lead[i] = 1;}
    for (const i of loopOf(b, index)) {looped[i] = 1;}
  });
  const loop = (j: number): boolean => R === 1 && pathSteps[j] === 1;
  const stays = (j: number): boolean => {
    for (let r = 0; r < R; r++) {if (kinds[r][from[j]] !== kinds[r][to[j]]) {return false;}}
    return true;
  };
  let inside = 0;
  Iterator.from(sorted).forEach((j) => {if (stays(j) && !loop(j)) {inside++;}});
  const comboOf =
    R === 1
      ? (i: number) => kinds[0][i]
      : (i: number) => {
          let c = "";
          for (let r = 0; r < R; r++) {c += (r ? "," : "") + kinds[r][i];}
          return c;
        };
  const dirty = new Map<number | string, number>();
  Iterator.from(order).forEach((i) => {if (tla[i].breaks.length) {
      const c = comboOf(i);
      if (!dirty.has(c)) {dirty.set(c, i);}
    }});
  const clean = new Uint8Array(n);
  if (dirty.size) {for (let i = 0; i < n; i++) {clean[i] = dirty.has(comboOf(i)) ? 0 : 1;}}
  else {clean.fill(1);}
  const regions: Region[] = [];
  const objects: ChartState[][] = [];
  for (const [r, name] of names.entries()) {
    const key = keys[r];
    const kind = kinds[r];
    const states = new Map<string, ChartState>();
    const objectOf = new Array<ChartState>(sizes[r]);
    const keyOf = new Array<string>(sizes[r]);
    const position = new Int32Array(sizes[r]);
    Iterator.from(order).forEach((i) => {
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
    Iterator.from(states.values()).forEach((state) => {for (let i = 1; i < state.path.length; i++) {parents.add(tupleKey(state.path.slice(0, i)));}});
    Iterator.from(states.values()).forEach((state) => {
      if (parents.size && parents.has(tupleKey(state.path)))
        {throw new Error(
          `The view's state() returned ${state.path.join(" / ")} both as a state and as a parent state${name ? ` in ${name}` : ""}. Give that state a child name of its own.`,
        );}
      const rules = new Map<string, Rule>();
      for (const i of state.members) {for (const rule of tla[i].breaks) {rules.set(ruleKey(rule), rule);}}
      state.breaks = [];
      for (const rule of [...rules.values()].sort(
        (a, b) => byText(a.name, b.name) || byText(a.kind, b.kind),
      )) {
        let always = true;
        for (const i of state.members) {always &&= hasRule(tla[i].breaks, rule);}
        state.breaks.push({ rule, always });
      }
      const groups = new Set<unknown>();
      for (const i of state.members) {groups.add(group(i));}
      state.group = groups.size === 1 ? [...groups][0] : undefined;
    });
    const others: number[] = [];
    for (let o = 0; o < R; o++) {if (o !== r) {others.push(o);}}
    const tuple = (i: number): string[] => {
      const t: string[] = [];
      Iterator.from(others).forEach((o) => {t.push(keys[o][i]);});
      return t;
    };
    const two = others.length === 1;
    const words = (vs: Iterable<string>): string => {
      const texts: string[] = [];
      Iterator.from(vs).forEach((v) => {texts.push(unkey(v).join(" / "));});
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
    const size = sizes[r];
    Iterator.from(sorted).forEach((j) => {
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
    if (R > 1) {Iterator.from(order).forEach((i) => {append(tuplesAt, kind[i], i);});}
    const arrows: Arrow[] = [];
    for (const move of moves) {
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
        continue;
      }
      const ok = new Set<string>();
      Iterator.from(move.group).forEach((j) => {ok.add(tupleKey(tuple(from[j])));});
      const takes = (t: string[]): boolean => ok.has(tupleKey(t));
      let seen = seenAt.get(move.f);
      if (!seen) {
        const uniqueTuples: string[][] = [];
        seen = uniqueTuples;
        const seenKeys = new Set<string>();
        Iterator.from(must(tuplesAt, move.f)).forEach((i) => {
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
        Iterator.from(seen).forEach((t) => {
          values.add(t[j]);
          if (takes(t)) {taken.add(t[j]);}
          else {untaken.add(t[j]);}
        });
        const only = new Set<string>();
        Iterator.from(values).forEach((value) => {if (!untaken.has(value)) {only.add(value);}});
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
          Iterator.from(all[j]).forEach((v) => {if (!and[j].has(v)) {no.push(v);}});
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
    }
    const steps: ChartStep[] = [];
    Iterator.from(arrows.entries()).forEach(([k, a]) => {steps.push({
        from: objectOf[moves[k].f].path,
        to: objectOf[moves[k].t].path,
        label: a.label,
        when: a.label.endsWith("]") ? undefined : a.when,
      });});
    regions.push({ name, states: [...states.values()], steps, arrows });
    objects.push(objectOf);
  }
  const hidden: ChartState[][] = [];
  Iterator.from(dirty.values()).forEach((i) => {
    const ps: ChartState[] = [];
    for (let r = 0; r < R; r++) {ps.push(objects[r][kinds[r][i]]);}
    let works = true;
    for (const currentState of ps) {works &&= currentState.works;}
    if (works) {hidden.push(ps);}
  });
  Iterator.from(hidden).forEach((ps) => {for (const currentState of ps) {currentState.works = false;}});
  const paths: string[] = [];
  const loops: string[] = [];
  Iterator.from(found).forEach((b) => {
    if (b.loop !== 0) {paths.push(b.rule.name);}
    if (!matchesUndefined(b.loop)) {loops.push(b.rule.name);}
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
}
