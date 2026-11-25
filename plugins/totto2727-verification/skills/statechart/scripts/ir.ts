import type { Bug, Condition, Find, PastState, Rule, Spec, Trace, TraceState, Value, Vars } from "./ir-model.ts";
import { FIRST_INDEX, NEXT_INDEX, isStrings, matchesUndefined, visitItems } from "./ir-primitives.ts";

export { CHART_STATES, EC, LEVEL, RERUN_STATES, checked } from "./ir-model.ts";
export type {
  Answers,
  Arrow,
  Bug,
  Chart,
  ChartState,
  ChartStep,
  CheckResult,
  CheckedView,
  Condition,
  Config,
  ConfigSection,
  Find,
  Graph,
  Hidden,
  Labels,
  Lasso,
  Line,
  Mark,
  Message,
  Outcome,
  Output,
  Part,
  Past,
  PastState,
  PathStep,
  Property,
  Region,
  Rule,
  Shape,
  Spec,
  State,
  Step,
  Stop,
  Story,
  Trace,
  TraceState,
  Value,
  Vars,
  Verdict,
  View,
  Walk,
} from "./ir-model.ts";
export { byText, hasObjectType, isNumber, isRecord, isString, isStrings, matchesNull, matchesUndefined, visitItems } from "./ir-primitives.ts";
export { defaultState, key, show, stateKey, stateText } from "./ir-values.ts";

// Native stream reads use 16 MiB slices.
export const PART = 16_777_216;

const LAST_INDEX = -1;
const LIST_PAIR = 2;

export const list = (items: string[], and = "and"): string =>
  items.length < LIST_PAIR ? items.join("") : `${items.slice(FIRST_INDEX, LAST_INDEX).join(", ")} ${and} ${items.at(LAST_INDEX)}`;

export const must = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
  const value = map.get(key);
  // oxlint-disable-next-line rules/require-tagged-error -- Report the native graph lookup error without loading Effect.
  if (matchesUndefined(value)) {throw new Error(`The chart lost track of ${JSON.stringify(key)}.`);}
  return value;
};

export const append = <K, V>(groups: Map<K, V[]>, key: K, item: V): void => {
  const group = groups.get(key);
  if (group) {group.push(item);}
  else {groups.set(key, [item]);}
};

export const seqOf = (bug: Bug, index: ReadonlyMap<string, number>): number[] => {
  const seq = [must(index, bug.start)];
  visitItems(bug.path, (step) => {seq.push(must(index, step.state));});
  return seq;
};

export const loopOf = (bug: Bug, index: ReadonlyMap<string, number>): Set<number> =>
  new Set(matchesUndefined(bug.loop) ? [] : seqOf(bug, index).slice(bug.loop));

export const count = (length: number): Int32Array => {
  const items = new Int32Array(length);
  const cursor = { index: FIRST_INDEX };
  while (cursor.index < items.length) {
    items[cursor.index] = cursor.index;
    cursor.index += NEXT_INDEX;
  }
  return items;
};

const bucketCount = (items: Int32Array, keys: Int32Array): number => {
  const cursor = { highest: FIRST_INDEX, index: FIRST_INDEX };
  while (cursor.index < items.length) {
    const bucket = keys[items[cursor.index]];
    if (bucket >= cursor.highest) {cursor.highest = bucket + NEXT_INDEX;}
    cursor.index += NEXT_INDEX;
  }
  return cursor.highest;
};

const bucketStarts = (items: Int32Array, keys: Int32Array): Int32Array => {
  const total = bucketCount(items, keys);
  const starts = new Int32Array(total + NEXT_INDEX);
  const cursor = { bucket: FIRST_INDEX, index: FIRST_INDEX };
  while (cursor.index < items.length) {
    starts[keys[items[cursor.index]] + NEXT_INDEX] += NEXT_INDEX;
    cursor.index += NEXT_INDEX;
  }
  while (cursor.bucket < total) {
    starts[cursor.bucket + NEXT_INDEX] += starts[cursor.bucket];
    cursor.bucket += NEXT_INDEX;
  }
  return starts;
};

const sortByKey = (items: Int32Array, keys: Int32Array): Int32Array => {
  const starts = bucketStarts(items, keys);
  const sorted = new Int32Array(items.length);
  const cursor = { index: FIRST_INDEX };
  while (cursor.index < items.length) {
    const bucket = keys[items[cursor.index]];
    const offset = starts[bucket];
    starts[bucket] = offset + NEXT_INDEX;
    sorted[offset] = items[cursor.index];
    cursor.index += NEXT_INDEX;
  }
  return sorted;
};

export const sortBy = (items: Int32Array, keyColumns: Int32Array[]): Int32Array => {
  const pass = { index: keyColumns.length, items };
  // Apply the least significant keys first. The counting pass keeps equal keys in input order.
  while (pass.index > FIRST_INDEX) {
    pass.index -= NEXT_INDEX;
    pass.items = sortByKey(pass.items, keyColumns[pass.index]);
  }
  return pass.items;
};

export const tupleKey = (parts: unknown[]): string => JSON.stringify(parts);
export const unkey = (keyText: string): string[] => {
  const parts: unknown = JSON.parse(keyText);
  // oxlint-disable-next-line rules/require-tagged-error -- Keep the native diagnostic for an invalid key in the standalone chart.
  if (!isStrings(parts)) {throw new Error(`The chart cannot read the key ${keyText}.`);}
  return parts;
};

const checkOthers = (keys: Set<string>[], values: string[], requireAll: boolean): boolean => {
  const cursor = { index: FIRST_INDEX };
  while (cursor.index < values.length) {
    const present = keys[cursor.index].has(values[cursor.index]);
    if (present !== requireAll) {return !requireAll;}
    cursor.index += NEXT_INDEX;
  }
  return requireAll;
};

// oxlint-disable-next-line typescript/consistent-return -- The condition union is exhaustive. Preserve fallthrough for a malformed runtime kind.
export const holds = function holds(condition: Condition, others: string[]): boolean {
  // oxlint-disable-next-line eslint/default-case -- All supported chart conditions have an explicit evaluator.
  switch (condition.kind) {
    case "and": {return checkOthers(condition.otherKeys, others, true);}
    case "or": {return checkOthers(condition.otherKeys, others, false);}
    case "tuples": {return condition.otherTuples.has(tupleKey(others));}
  }
};

export const ruleKey = (rule: Rule): string => tupleKey([rule.kind, rule.name]);

export const hasRule = (rules: Rule[], rule: Rule): boolean => {
  // oxlint-disable-next-line rules/no-for-loops -- Stop at the first matching native rule, including callers with a custom iterator.
  for (const currentRule of rules) {if (currentRule.kind === rule.kind && currentRule.name === rule.name) {return true;}}
  return false;
};

const DEFAULT_CACHE_LIMIT = 65_536;

export const memo = <CacheKey, Result>(
  make: (input: CacheKey) => Result,
  limit = DEFAULT_CACHE_LIMIT,
): (input: CacheKey) => Result => {
  const cache = new Map<CacheKey, Result>();
  return (input: CacheKey): Result => {
    const cached = cache.get(input);
    if (!matchesUndefined(cached)) {return cached;}
    if (cache.size >= limit) {cache.clear();}
    const result = make(input);
    cache.set(input, result);
    return result;
  };
};

export const valuesOf = (vars: Vars, names: string[]): Value[] => {
  const values: Value[] = [];
  visitItems(names, (currentName) => {values.push(vars[currentName]);});
  return values;
};

type LocatedTraceState<Identifier> = TraceState & { values: Value[]; id: Identifier | undefined };

// oxlint-disable-next-line eslint/max-params -- Keep the existing trace lookup signature for graph consumers.
export const findTrace = <Identifier>(
  counterexample: TraceState[],
  names: string[],
  rule: Rule,
  find: Find<Identifier>,
): LocatedTraceState<Identifier>[] => {
  const trace: LocatedTraceState<Identifier>[] = [];
  visitItems(counterexample, ({ action, vars }) => {
    const values = valuesOf(vars, names);
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the public trace state's field order.
    trace.push({ action, vars, values, id: find(values) });
  });
  const lastIndex = trace.length - NEXT_INDEX;
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native error for an empty TLC trace.
  if (lastIndex < FIRST_INDEX) {throw new Error(`TLC's trace for ${rule.name} has no states.`);}
  if (trace.some((step, index) => index < lastIndex && matchesUndefined(step.id))) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native error for an incomplete TLC trace.
    throw new Error(`TLC's trace for ${rule.name} has a state before its last that the dump does not list.`);
  }
  return trace;
};

interface LocatedLoop<Identifier> {
  loop: Trace["loop"];
  seq: { action: string; id: Identifier | undefined }[];
}

export const findLoop = <Identifier>({ seq, loop }: Trace, names: string[], find: Find<Identifier>): LocatedLoop<Identifier> => {
  const found: LocatedLoop<Identifier>["seq"] = [];
  visitItems(seq, ({ action, vars }) => {found.push({ action, id: vars && find(valuesOf(vars, names)) });});
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public loop record's field order.
  return { seq: found, loop };
};

// oxlint-disable-next-line eslint/max-params -- Keep the existing graph annotation signature for graph consumers.
export const pastState = (
  vars: Vars,
  start: boolean,
  marked: Iterable<Rule>,
  excluded: boolean,
): PastState => {
  const breaks: Rule[] = [];
  visitItems(marked, (rule) => {if (!hasRule(breaks, rule)) {breaks.push(rule);}});
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the past state's public field order.
  return { vars, start, breaks, ends: [], past: true, excluded };
};

export const CHECK_DEADLOCK = "CHECK_DEADLOCK";

const deadlockRule = ({ invariants, properties }: Spec): Rule => ({
  kind: "deadlock",
  name:
    invariants.includes("NoDeadlock") || properties.includes("NoDeadlock")
      ? CHECK_DEADLOCK
      : "NoDeadlock",
});

export const hasSection = ({ written }: Spec, ...keys: string[]): boolean => {
  // oxlint-disable-next-line rules/no-for-loops -- Stop reading the native configuration iterator as soon as a matching section is found.
  for (const section of written) {if (keys.includes(section.key)) {return true;}}
  return false;
};

export const stateRules = (spec: Spec): Rule[] => {
  const rules: Rule[] = [];
  visitItems(spec.invariants, (name) => {rules.push({ kind: "invariant", name });});
  if (spec.deadlock) {rules.push(deadlockRule(spec));}
  return rules;
};
