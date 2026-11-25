import { list, loopOf, matchesNull, matchesUndefined, must, sortBy, tupleKey, visitItems } from "#statechart/ir.ts";
import type { Answers, Bug, Graph, Labels, Step, Story, Walk } from "#statechart/ir.ts";

import { unlabeled } from "./label-view.ts";

export { ask, asParents } from "./label-view.ts";

const LEAF_PATH_LENGTH = 1;
const FIRST_LABEL_INDEX = 0;
const NO_STEP_INDEX = -1;
const FLAG_SET = 1;
const MULTIPLE_REGIONS = 2;

const pathIndices = (graph: Graph, stepLabels: Answers["labels"], found: Bug[]): Map<Step, number> => {
  const onPath = new Set<Step>();
  visitItems(found, (bug) => {visitItems(bug.path, (pathStep) => {onPath.add(pathStep.step);});});
  const indices = new Map<Step, number>();
  if (onPath.size) {
    visitItems(stepLabels.keys(), (stepIndex) => {
      const step = graph.steps[stepIndex];
      if (onPath.has(step)) {indices.set(step, stepIndex);}
    });
  }
  return indices;
};

interface LabelPaths {
  keyOf: string[];
  nested: Map<string, number>;
  tops: Map<string, number>;
}

const pathKind = (path: string[], { keyOf, nested, tops }: LabelPaths): number => {
  const top = path.length === LEAF_PATH_LENGTH;
  const seen = top ? tops : nested;
  const pathKey = top ? path[FIRST_LABEL_INDEX] : tupleKey(path);
  const cached = seen.get(pathKey);
  if (!matchesUndefined(cached)) {return cached;}
  const shapeIndex = keyOf.length;
  seen.set(pathKey, shapeIndex);
  keyOf.push(top ? tupleKey(path) : pathKey);
  return shapeIndex;
};

interface RegionKeys {
  keys: string[][];
  kinds: Int32Array[];
  sizes: number[];
}

const regionKeys = ({ names, shapes }: Answers): RegionKeys => {
  const result: RegionKeys = { keys: [], kinds: [], sizes: [] };
  const stateCount = shapes.length;
  visitItems(names, (name) => {
    const kind = new Int32Array(stateCount);
    const paths: LabelPaths = { keyOf: [], nested: new Map(), tops: new Map() };
    const keys = Array.from({ length: stateCount }, (_unused, stateIndex) => {
      const shapeIndex = pathKind(shapes[stateIndex][name], paths);
      kind[stateIndex] = shapeIndex;
      return paths.keyOf[shapeIndex];
    });
    result.keys.push(keys);
    result.kinds.push(kind);
    result.sizes.push(paths.keyOf.length);
  });
  return result;
};

interface BugPaths {
  graph: Graph;
  pathStepIndex: Map<Step, number>;
  stepLabels: Answers["labels"];
  walk: Walk;
}

const hiddenStep = (bug: Bug, { graph, pathStepIndex, stepLabels, walk }: BugPaths): Step | undefined => {
  const hidden = bug.path.find((item) => matchesNull(stepLabels[must(pathStepIndex, item.step)]));
  if (!matchesUndefined(hidden)) {return hidden.step;}
  const inLoop = loopOf(bug, walk.index);
  if (!inLoop.size) {return undefined;}
  const { from, to } = walk;
  const leaving = stepLabels.findIndex((label, stepIndex) =>
    inLoop.has(from[stepIndex]) && !inLoop.has(to[stepIndex]) && matchesNull(label),
  );
  return leaving === NO_STEP_INDEX ? undefined : graph.steps[leaving];
};

const validatePathLabels = (found: Bug[], paths: BugPaths): void => {
  visitItems(found, (bug) => {
    const hidden = hiddenStep(bug, paths);
    if (!matchesUndefined(hidden)) {
      const { action } = hidden;
      const before = must(paths.graph.states, hidden.from).vars;
      const after = must(paths.graph.states, hidden.to).vars;
      unlabeled(action, { after, before }, bug);
    }
  });
};

interface RankedSteps {
  drawnLabels: string[];
  sorted: Int32Array;
}

const rankSteps = ({ from, to, action }: Walk, rank: Int32Array, stepLabels: Answers["labels"]): RankedSteps => {
  const drawn: number[] = [];
  const drawnLabels: string[] = [];
  drawnLabels.length = stepLabels.length;
  visitItems(stepLabels.keys(), (stepIndex) => {
    const label = stepLabels[stepIndex];
    if (!matchesNull(label)) {
      drawn.push(stepIndex);
      drawnLabels[stepIndex] = label;
    }
  });
  const fromRank = new Int32Array(stepLabels.length);
  const toRank = new Int32Array(stepLabels.length);
  visitItems(fromRank.keys(), (stepIndex) => {
    fromRank[stepIndex] = rank[from[stepIndex]];
    toRank[stepIndex] = rank[to[stepIndex]];
  });
  return { drawnLabels, sorted: sortBy(Int32Array.from(drawn), [fromRank, toRank, action]) };
};

const flagsOfPath = (stepCount: number, indices: Map<Step, number>): Uint8Array => {
  const flags = new Uint8Array(stepCount);
  visitItems(indices.values(), (stepIndex) => {flags[stepIndex] = FLAG_SET;});
  return flags;
};

interface ChangedRegions {
  changed: Uint8Array;
  sets: Set<string>;
}

interface RegionNotes {
  notes: string[];
  together: Set<string>;
}

const regionsByStep = ({ from, to }: Walk, regions: { kinds: Int32Array[]; names: string[] }, { drawnLabels, sorted }: RankedSteps): Map<string, ChangedRegions> => {
  const { kinds, names } = regions;
  const byLabel = new Map<string, ChangedRegions>();
  if (names.length < MULTIPLE_REGIONS) {return byLabel;}
  visitItems(sorted, (stepIndex) => {
    const label = drawnLabels[stepIndex];
    const existing = byLabel.get(label);
    const entry = existing ?? { changed: new Uint8Array(names.length), sets: new Set<string>() };
    if (matchesUndefined(existing)) {byLabel.set(label, entry);}
    const changed: string[] = [];
    visitItems(names.keys(), (regionIndex) => {
      if (kinds[regionIndex][from[stepIndex]] !== kinds[regionIndex][to[stepIndex]]) {
        changed.push(names[regionIndex]);
        entry.changed[regionIndex] = FLAG_SET;
      }
    });
    if (changed.length >= MULTIPLE_REGIONS) {entry.sets.add(list(changed));}
  });
  return byLabel;
};

const describeNotes = (byLabel: Map<string, ChangedRegions>, names: string[]): RegionNotes => {
  const together = new Set<string>();
  visitItems(byLabel, ([text, { sets }]) => {if (sets.size) {together.add(text);}});
  const notes: string[] = [];
  visitItems(byLabel, ([text, entry]) => {
    const changed: string[] = [];
    visitItems(entry.changed.keys(), (regionIndex) => {
      if (entry.changed[regionIndex]) {changed.push(names[regionIndex]);}
    });
    if (changed.length < MULTIPLE_REGIONS) {return;}
    if (!together.has(text)) {
      notes.push(`The step ${text} changes only one of ${list(changed)} at a time.`);
      return;
    }
    const sets = [...entry.sets];
    const wording = sets.length >= MULTIPLE_REGIONS ? `${sets.join(", or ")},` : sets[FIRST_LABEL_INDEX];
    notes.push(`The step ${text} changes ${wording} at the same time.`);
  });
  return { notes, together };
};

// oxlint-disable-next-line eslint/max-params -- Preserve the existing graph labelling entry point used by Statechart's standalone pipeline.
export const labelGraph = function labelGraph(graph: Graph, walk: Walk, answers: Answers, rank: Int32Array, found: Bug[]): Labels {
  const { labels: stepLabels, names } = answers;
  const stepCount = stepLabels.length;
  const pathStepIndex = pathIndices(graph, stepLabels, found);
  const { keys, kinds, sizes } = regionKeys(answers);
  validatePathLabels(found, { graph, pathStepIndex, stepLabels, walk });
  const ranked = rankSteps(walk, rank, stepLabels);
  const pathSteps = flagsOfPath(stepCount, pathStepIndex);
  const { notes, together } = describeNotes(regionsByStep(walk, { kinds, names }, ranked), names);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve serialized answers and derived labels in their existing order.
  return { ...answers, drawnLabels: ranked.drawnLabels, keys, kinds, sizes, sorted: ranked.sorted, pathStepIndex, pathSteps, together, notes };
};

interface StoryInput {
  graph: Graph;
  index: Walk["index"];
  labels: Labels;
}

const storyOf = (bug: Bug, { graph, index, labels }: StoryInput): Story => {
  const { shapes, drawnLabels, pathStepIndex } = labels;
  const shapeAt = (id: string): Answers["shapes"][number] => shapes[must(index, id)];
  const story: Story = [{ state: shapeAt(bug.start) }];
  const cursor = { from: bug.start };
  visitItems(bug.path, (item) => {
    const label = drawnLabels[must(pathStepIndex, item.step)];
    if (matchesNull(label)) {
      const { action } = item;
      const before = must(graph.states, cursor.from).vars;
      const after = must(graph.states, item.state).vars;
      unlabeled(action, { after, before }, bug);
    }
    // oxlint-disable-next-line eslint/sort-keys -- Preserve step then state in serialized counterexample stories.
    story.push({ step: label, state: shapeAt(item.state) });
    cursor.from = item.state;
  });
  return story;
};

// oxlint-disable-next-line eslint/max-params -- Preserve the established story construction entry point.
export const storiesOf = (graph: Graph, found: Bug[], { index }: Walk, labels: Labels): Map<Bug, Story> => {
  const stories = new Map<Bug, Story>();
  visitItems(found, (bug) => {stories.set(bug, storyOf(bug, { graph, index, labels }));});
  return stories;
};
