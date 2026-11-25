import { isRecord, isString, key, list, loopOf, matchesNull, matchesUndefined, must, sortBy, stateText, tupleKey, visitItems } from '#statechart/ir.ts';
import type { Answers, Bug, Graph, Hidden, Labels, Rule, Shape, Step, Story, Vars, View, Walk } from '#statechart/ir.ts';

const readLabel = (value: unknown): string | undefined =>
  isString(value) && value !== "" && !/\bundefined\b|\bNaN\b|\[object Object\]/u.test(value) ? value : undefined;

const shapeOf = (shape: unknown, vars: Vars): Shape => {
  const fail = function (): never {
    throw new Error(
      `The view's state() returned ${JSON.stringify(shape) ?? "undefined"} for the state ${stateText(vars)}. Return a string, an array of strings, or an object of those.`,
    );
  };
  const path = (value: unknown): string[] => {
    const labels: string[] = [];
    visitItems([value].flat(), (label) => {
      labels.push(readLabel(label) ?? fail());
    });
    if (!labels.length) {fail();}
    return labels;
  };
  const regions: [string, unknown][] = isRecord(shape) ? Object.entries(shape) : [["", shape]];
  const pairs: [string, string[]][] = [];
  visitItems(regions, ([name, value]) => {pairs.push([name, path(value)]);});
  return pairs.length ? Object.fromEntries(pairs) : fail();
};

const stepOf = (view: View) => (action: string, from: Vars, to: Vars): string | Hidden => {
  const label = (view.step ?? ((actionName: string) => actionName))(action, from, to);
  if (matchesNull(label)) {return label;}
  const text = readLabel(label);
  if (!matchesUndefined(text)) {return text;}
  throw new Error(
    `The view's step() returned ${JSON.stringify(label) ?? "undefined"} for the step ${action}.`,
  );
};

const unlabeled = function (
  action: string,
  before: Vars,
  after: Vars,
  bug: { rule: Rule; loop?: number },
): never {
  const changed: string[] = [];
  Object.keys(after).forEach((currentKey) => {if (key(before[currentKey]) !== key(after[currentKey])) {changed.push(currentKey);}});
  throw new Error(
    `The view's step() returned null for the step ${action} that changes ${changed.join(", ") || "nothing"}. It is on the path to the ${bug.rule.name} bug${matchesUndefined(bug.loop) ? "" : " or leaves its loop"}, so label it.`,
  );
};

const FIRST_STATE_INDEX = 0;
const GROUP_CACHED = 1;

export const ask = function ask(graph: Graph, { states: tla, nameOf, from, to }: Walk, view: View): Answers {
  const stateCount = nameOf.length;
  const stepCount = from.length;
  const { state } = view;
  const shapes = Array.from({ length: stateCount }, (_, stateIndex) =>
    shapeOf(state ? state(tla[stateIndex].vars) : nameOf[stateIndex], tla[stateIndex].vars),
  );
  const names = Object.keys(shapes[FIRST_STATE_INDEX] ?? { "": [] });
  const regionsKey = tupleKey(names);
  visitItems(shapes.keys(), (stateIndex) => {
    const regions = Object.keys(shapes[stateIndex]);
    if (tupleKey(regions) !== regionsKey) {
      throw new Error(
        `The view's state() returned the regions ${names.join(", ")} for one state and ${regions.join(", ")} for the state ${stateText(tla[stateIndex].vars)}. Return the same regions for every state.`,
      );
    }
  });
  const step = stepOf(view);
  const labels = Array.from({ length: stepCount }, (_, stepIndex) =>
    step(graph.steps[stepIndex].action, tla[from[stepIndex]].vars, tla[to[stepIndex]].vars),
  );
  const groups = new Array<unknown>(stateCount);
  const asked = new Uint8Array(stateCount);
  const group = (stateIndex: number): unknown => {
    if (view.group && asked[stateIndex] !== GROUP_CACHED) {
      groups[stateIndex] = view.group(tla[stateIndex].vars);
      asked[stateIndex] = GROUP_CACHED;
    }
    return groups[stateIndex];
  };
  return { names, shapes, labels, group };
};

export const asParents = function asParents(
  { states: tla }: Walk,
  { names, shapes, labels, group }: Answers,
): Answers {
  const parents = Array.from({ length: shapes.length }, (_, stateIndex) => {
    const path: string[] = [];
    visitItems(names, (name) => {
      visitItems(shapes[stateIndex][name], (label) => {path.push(`${name} ${label}`);});
    });
    return shapeOf(path, tla[stateIndex].vars);
  });
  return { names: [""], shapes: parents, labels, group };
};

const LEAF_PATH_LENGTH = 1;
const FIRST_LABEL_INDEX = 0;
const NO_STEP_INDEX = -1;
const FLAG_SET = 1;
const MULTIPLE_REGIONS = 2;

export const labelGraph = function labelGraph(
  graph: Graph,
  { index, from, to, action }: Walk,
  answers: Answers,
  rank: Int32Array,
  found: Bug[],
): Labels {
  const { names, shapes, labels: stepLabels } = answers;
  const stateCount = shapes.length;
  const stepCount = stepLabels.length;
  const onPath = new Set<Step>();
  visitItems(found, (bug) => {visitItems(bug.path, (pathStep) => {onPath.add(pathStep.step);});});
  const pathStepIndex = new Map<Step, number>();
  if (onPath.size) {
    visitItems(stepLabels.keys(), (stepIndex) => {
      const step = graph.steps[stepIndex];
      if (onPath.has(step)) {pathStepIndex.set(step, stepIndex);}
    });
  }
  const regionCount = names.length;
  const keys: string[][] = [];
  const kinds: Int32Array[] = [];
  const sizes: number[] = [];
  visitItems(names, (name) => {
    const kind = new Int32Array(stateCount);
    const tops = new Map<string, number>();
    const nested = new Map<string, number>();
    const keyOf: string[] = [];
    const regionKeys = Array.from({ length: stateCount }, (_, stateIndex) => {
      const path = shapes[stateIndex][name];
      const top = path.length === LEAF_PATH_LENGTH;
      const seen = top ? tops : nested;
      const pathKey = top ? path[FIRST_LABEL_INDEX] : tupleKey(path);
      const cached = seen.get(pathKey);
      const shapeIndex = cached ?? keyOf.length;
      if (matchesUndefined(cached)) {
        seen.set(pathKey, shapeIndex);
        keyOf.push(top ? tupleKey(path) : pathKey);
      }
      kind[stateIndex] = shapeIndex;
      return keyOf[shapeIndex];
    });
    keys.push(regionKeys);
    kinds.push(kind);
    sizes.push(keyOf.length);
  });

  const hiddenStep = (bug: Bug): Step | undefined => {
    const hidden = bug.path.find((pathStep) => matchesNull(stepLabels[must(pathStepIndex, pathStep.step)]));
    if (!matchesUndefined(hidden)) {return hidden.step;}
    const inLoop = loopOf(bug, index);
    if (!inLoop.size) {return undefined;}
    const leaving = stepLabels.findIndex((label, stepIndex) =>
      inLoop.has(from[stepIndex]) && !inLoop.has(to[stepIndex]) && matchesNull(label),
    );
    return leaving === NO_STEP_INDEX ? undefined : graph.steps[leaving];
  };
  visitItems(found, (bug) => {
    const hidden = hiddenStep(bug);
    if (!matchesUndefined(hidden)) {unlabeled(hidden.action, must(graph.states, hidden.from).vars, must(graph.states, hidden.to).vars, bug);}
  });

  const drawn: number[] = [];
  const drawnLabels = new Array<string>(stepCount);
  visitItems(stepLabels.keys(), (stepIndex) => {
    const label = stepLabels[stepIndex];
    if (!matchesNull(label)) {
      drawn.push(stepIndex);
      drawnLabels[stepIndex] = label;
    }
  });
  const fromRank = new Int32Array(stepCount);
  const toRank = new Int32Array(stepCount);
  visitItems(fromRank.keys(), (stepIndex) => {
    fromRank[stepIndex] = rank[from[stepIndex]];
    toRank[stepIndex] = rank[to[stepIndex]];
  });
  const sorted = sortBy(Int32Array.from(drawn), [fromRank, toRank, action]);
  const pathSteps = new Uint8Array(stepCount);
  visitItems(pathStepIndex.values(), (stepIndex) => {pathSteps[stepIndex] = FLAG_SET;});
  const byLabel = new Map<string, { changed: Uint8Array; sets: Set<string> }>();
  if (regionCount >= MULTIPLE_REGIONS) {
    visitItems(sorted, (stepIndex) => {
      const label = drawnLabels[stepIndex];
      const existing = byLabel.get(label);
      const entry = existing ?? { changed: new Uint8Array(regionCount), sets: new Set<string>() };
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
  }
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
    notes.push(
      `The step ${text} changes ${sets.length >= MULTIPLE_REGIONS ? `${sets.join(", or ")},` : sets[FIRST_LABEL_INDEX]} at the same time.`,
    );
  });
  return {
    ...answers,
    drawnLabels,
    keys,
    kinds,
    sizes,
    sorted,
    pathStepIndex,
    pathSteps,
    together,
    notes,
  };
};

interface Told<Id> { rule: Rule; start: Id; path: { action: string; state: Id }[]; loop?: number }

const tell = function <Id, B extends Told<Id>>(
  states: ReadonlyMap<Id, { vars: Vars }>,
  found: B[],
  shapeAt: (id: Id) => Shape,
  labelAt: (bug: B, pathIndex: number, from: Id) => string | Hidden,
) {
  const vars = (id: Id) => must(states, id).vars;
  const stories = new Map<B, Story>();
  visitItems(found, (bug) => {
    const story: Story = [{ state: shapeAt(bug.start) }];
    let from: Id = bug.start;
    visitItems(bug.path.entries(), ([index, item]) => {
      const label = labelAt(bug, index, from);
      const step = matchesNull(label) ? unlabeled(item.action, vars(from), vars(item.state), bug) : label;
      story.push({ step, state: shapeAt(item.state) });
      from = item.state;
    });
    stories.set(bug, story);
  });
  return stories;
};

export const storiesOf = (
  graph: Graph,
  found: Bug[],
  { index }: Walk,
  { shapes, drawnLabels, pathStepIndex }: Labels,
) =>
  tell(
    graph.states,
    found,
    (id) => shapes[must(index, id)],
    (bug, pathIndex) => drawnLabels[must(pathStepIndex, bug.path[pathIndex].step)],
  );
