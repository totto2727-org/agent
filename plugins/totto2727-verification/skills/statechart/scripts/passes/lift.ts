import { append, matchesUndefined, must, tupleKey, unkey } from '../ir.ts';
import type { Chart, ChartState, ChartStep, Region } from '../ir.ts';

export function liftToParents(states: ChartState[], steps: ChartStep[]) {
  const depths = new Map<string, number>();
  const leaves = new Map<string, number>();
  Iterator.from(states.values()).forEach((state) => {for (let i = 1; i < state.path.length; i++) {
      const prefix = tupleKey(state.path.slice(0, i));
      depths.set(prefix, i);
      leaves.set(prefix, (leaves.get(prefix) ?? 0) + 1);
    }});
  if (!depths.size) {return steps;}
  const leaving = new Map<string, ChartStep[]>();
  for (const step of steps) {
    let same = 0;
    while (same < step.from.length && step.from[same] === step.to[same]) {same++;}
    for (let i = 1; i < step.from.length; i++) {
      if (i <= same && i < step.to.length) {continue;}
      const prefix = tupleKey(step.from.slice(0, i));
      if (depths.has(prefix)) {append(leaving, prefix, step);}
    }
  }
  const removed = new Set<ChartStep>();
  const lifted: ChartStep[] = [];
  for (const [prefix] of [...depths].sort((left, right) => left[1] - right[1])) {
    const groups = new Map<string, ChartStep[]>();
    Iterator.from(leaving.get(prefix) ?? []).forEach((s) => {if (!removed.has(s)) {append(groups, tupleKey([s.label, s.when, s.to]), s);}});
    const under = must(leaves, prefix);
    for (const group of groups.values()) {
      if (under < 2 || group.length < under) {continue;}
      Iterator.from(group).forEach((s) => {removed.add(s);});
      lifted.push({ ...group[0], from: unkey(prefix) });
    }
  }
  const kept: ChartStep[] = [];
  Iterator.from(steps).forEach((step) => {if (!removed.has(step)) {kept.push(step);}});
  Iterator.from(lifted).forEach((s) => {kept.push(s);});
  return kept;
}

export function lift(chart: Chart): Chart {
  const regions: Region[] = [];
  Iterator.from(chart.regions).forEach((region) => {
    const known = new Map<string[], number>();
    for (const state of region.states) {known.set(state.path, known.size);}
    let numbers: Map<string, number> | undefined;
    const pathIndex = (path: string[]): number => {
      let i = known.get(path);
      if (!matchesUndefined(i)) {return i;}
      if (!numbers) {
        numbers = new Map();
        for (const state of region.states) {numbers.set(tupleKey(state.path), numbers.size);}
      }
      const k = tupleKey(path);
      i = numbers.get(k);
      if (matchesUndefined(i)) {numbers.set(k, (i = numbers.size));}
      known.set(path, i);
      return i;
    };
    const merged = new Map<number | string, ChartStep>();
    for (const currentStep of liftToParents(region.states, region.steps)) {
      const f = pathIndex(currentStep.from);
      const t = pathIndex(currentStep.to);
      const k =
        matchesUndefined(currentStep.when) && f < 2 ** 26 && t < 2 ** 26
          ? f * 2 ** 26 + t
          : `${f},${t}:${currentStep.when}`;
      const prior = merged.get(k);
      if (prior) {prior.label += ` or ${currentStep.label}`;}
      else {merged.set(k, { ...currentStep });}
    }
    regions.push({ ...region, steps: [...merged.values()] });
  });
  return { ...chart, regions };
}
