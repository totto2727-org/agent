import { loopOf, matchesUndefined, seqOf, visitItems } from "#statechart/ir.ts";
import type { Arrow, Bug, Chart, ChartState, ChartStep, Labels, Region, View, Walk } from "#statechart/ir.ts";
import { arrowsOfRegion } from "./region-arrows.ts";
import type { RegionMove } from "./region-arrows.ts";
import { statesOfRegion } from "./region-states.ts";
import type { RegionStates, StateFlags } from "./region-states.ts";

const FIRST_REGION_INDEX = 0;
const FIRST_PATH_POSITION = 0;
const SINGLE_REGION = 1;
const NO_INSIDE_STEPS = 0;
const INSIDE_STEP_INCREMENT = 1;
const FLAG_SET = 1;
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
