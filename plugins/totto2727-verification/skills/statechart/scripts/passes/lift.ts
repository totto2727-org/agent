import { append, matchesUndefined, must, tupleKey, unkey, visitItems } from '#statechart/ir.ts';
import type { Chart, ChartState, ChartStep, Region } from '#statechart/ir.ts';

export const liftToParents = function liftToParents(states: ChartState[], steps: ChartStep[]) {
  const depths = new Map<string, number>();
  const leaves = new Map<string, number>();
  visitItems(states.values(), (state) => {for (let i = 1; i < state.path.length; i++) {
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
    visitItems(leaving.get(prefix) ?? [], (chartStep) => {if (!removed.has(chartStep)) {append(groups, tupleKey([chartStep.label, chartStep.when, chartStep.to]), chartStep);}});
    const under = must(leaves, prefix);
    visitItems(groups.values(), (group) => {
      if (under < 2 || group.length < under) {return;}
      visitItems(group, (chartStep) => {removed.add(chartStep);});
      lifted.push({ ...group[0], from: unkey(prefix) });
    });
  }
  const kept: ChartStep[] = [];
  visitItems(steps, (step) => {if (!removed.has(step)) {kept.push(step);}});
  visitItems(lifted, (chartStep) => {kept.push(chartStep);});
  return kept;
};

export const lift = function lift(chart: Chart): Chart {
  const regions: Region[] = [];
  visitItems(chart.regions, (region) => {
    const known = new Map<string[], number>();
    visitItems(region.states, (state) => {known.set(state.path, known.size);});
    let numbers: Map<string, number> | undefined;
    const pathIndex = (path: string[]): number => {
      let i = known.get(path);
      if (!matchesUndefined(i)) {return i;}
      if (!numbers) {
        const indices = new Map<string, number>();
        numbers = indices;
        visitItems(region.states, (state) => {indices.set(tupleKey(state.path), indices.size);});
      }
      const k = tupleKey(path);
      i = numbers.get(k);
      if (matchesUndefined(i)) {numbers.set(k, (i = numbers.size));}
      known.set(path, i);
      return i;
    };
    const merged = new Map<number | string, ChartStep>();
    visitItems(liftToParents(region.states, region.steps), (currentStep) => {
      const f = pathIndex(currentStep.from);
      const t = pathIndex(currentStep.to);
      const k =
        matchesUndefined(currentStep.when) && f < 2 ** 26 && t < 2 ** 26
          ? f * 2 ** 26 + t
          : `${f},${t}:${currentStep.when}`;
      const prior = merged.get(k);
      if (prior) {prior.label += ` or ${currentStep.label}`;}
      else {merged.set(k, { ...currentStep });}
    });
    regions.push({ ...region, steps: [...merged.values()] });
  });
  return { ...chart, regions };
};
