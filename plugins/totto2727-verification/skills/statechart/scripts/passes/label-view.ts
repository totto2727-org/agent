import { isRecord, isString, key, matchesNull, matchesUndefined, stateText, tupleKey, visitItems } from "#statechart/ir.ts";
import type { Answers, Graph, Hidden, Rule, Shape, Vars, View, Walk } from "#statechart/ir.ts";

const readLabel = (value: unknown): string | undefined =>
  isString(value) && Boolean(value) && !/\bundefined\b|\bNaN\b|\[object Object\]/u.test(value) ? value : undefined;

const describeJson = (value: unknown): string => {
  const encoded: unknown = JSON.stringify(value);
  return isString(encoded) ? encoded : "undefined";
};

const shapeOf = (shape: unknown, vars: Vars): Shape => {
  const fail = function (): never {
    // oxlint-disable-next-line rules/require-tagged-error -- The standalone view API preserves its synchronous validation errors.
    throw new Error(
      `The view's state() returned ${describeJson(shape)} for the state ${stateText(vars)}. Return a string, an array of strings, or an object of those.`,
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
  // oxlint-disable-next-line rules/require-tagged-error -- Report an invalid hook result at the native Statechart view boundary.
  throw new Error(
    `The view's step() returned ${describeJson(label)} for the step ${action}.`,
  );
};

export const unlabeled = function unlabeled(
  action: string,
  { before, after }: { before: Vars; after: Vars },
  bug: { rule: Rule; loop?: number },
): never {
  const changed: string[] = [];
  Object.keys(after).forEach((currentKey) => {if (key(before[currentKey]) !== key(after[currentKey])) {changed.push(currentKey);}});
  // oxlint-disable-next-line rules/require-tagged-error -- The command preserves its native synchronous error for a hidden bug path.
  throw new Error(
    `The view's step() returned null for the step ${action} that changes ${changed.join(", ") || "nothing"}. It is on the path to the ${bug.rule.name} bug${matchesUndefined(bug.loop) ? "" : " or leaves its loop"}, so label it.`,
  );
};

const FIRST_STATE_INDEX = 0;
const GROUP_CACHED = 1;

const regionNames = (shapes: Shape[], states: Walk["states"]): string[] => {
  const names = Object.keys(shapes[FIRST_STATE_INDEX] ?? { "": [] });
  const regionsKey = tupleKey(names);
  visitItems(shapes.keys(), (stateIndex) => {
    const regions = Object.keys(shapes[stateIndex]);
    if (tupleKey(regions) !== regionsKey) {
      // oxlint-disable-next-line rules/require-tagged-error -- Identify the first inconsistent state in the existing synchronous hook diagnostic.
      throw new Error(`The view's state() returned the regions ${names.join(", ")} for one state and ${regions.join(", ")} for the state ${stateText(states[stateIndex].vars)}. Return the same regions for every state.`);
    }
  });
  return names;
};

const cachedGroups = (view: View, states: Walk["states"], stateCount: number): Answers["group"] => {
  const groups: unknown[] = [];
  groups.length = stateCount;
  const asked = new Uint8Array(stateCount);
  return (stateIndex) => {
    if (view.group && asked[stateIndex] !== GROUP_CACHED) {
      groups[stateIndex] = view.group(states[stateIndex].vars);
      asked[stateIndex] = GROUP_CACHED;
    }
    return groups[stateIndex];
  };
};

export const ask = function ask(graph: Graph, { states, nameOf, from, to }: Walk, view: View): Answers {
  const stateCount = nameOf.length;
  const stepCount = from.length;
  const { state } = view;
  const shapes = Array.from({ length: stateCount }, (_unused, stateIndex) =>
    shapeOf(state ? state(states[stateIndex].vars) : nameOf[stateIndex], states[stateIndex].vars),
  );
  const names = regionNames(shapes, states);
  const step = stepOf(view);
  const labels = Array.from({ length: stepCount }, (_unused, stepIndex) =>
    step(graph.steps[stepIndex].action, states[from[stepIndex]].vars, states[to[stepIndex]].vars),
  );
  const group = cachedGroups(view, states, stateCount);
  // oxlint-disable-next-line eslint/sort-keys -- Maintain the established serialized answer order.
  return { names, shapes, labels, group };
};

export const asParents = function asParents(
  { states: tla }: Walk,
  { names, shapes, labels, group }: Answers,
): Answers {
  const parents = Array.from({ length: shapes.length }, (_unused, stateIndex) => {
    const path: string[] = [];
    visitItems(names, (name) => {
      visitItems(shapes[stateIndex][name], (label) => {path.push(`${name} ${label}`);});
    });
    return shapeOf(path, tla[stateIndex].vars);
  });
  // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized answer order after flattening regions into parents.
  return { names: [""], shapes: parents, labels, group };
};
