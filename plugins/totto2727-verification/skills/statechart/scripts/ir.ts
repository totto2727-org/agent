// oxlint-disable eslint/max-lines -- The statechart pipeline's shared IR is dependency-free so each pass can use the same model and primitives without any module edges beyond this file.

export type Value =
  | boolean
  | number
  | string
  | { kind: "model"; name: string }
  | { kind: "set"; members: Value[] }
  | { kind: "interval"; lo: number; hi: number }
  | { kind: "function"; printedAs: "tuple" | "record" | "pairs"; keys: Value[]; values: Value[] };

export type Vars = Record<string, Value>;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Rule = { kind: "invariant" | "deadlock" | "property"; name: string };

interface StateBase { vars: Vars; start: boolean; breaks: Rule[] }

export type PastState = StateBase & { ends: Rule[]; past: true; excluded: boolean };

export type State =
  | (StateBase & { ends?: Rule[]; past?: undefined; excluded?: undefined })
  | PastState;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Step = { from: string; to: string; action: string };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Graph = { states: Map<string, State>; steps: Step[] };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type PathStep = { action: string; state: string; step: Step };

export type Output = Iterable<Uint8Array>;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Lasso = {
  start: string;
  path: PathStep[];
  loop: number | undefined;
  stutters: boolean;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Mark = { values: Value[]; broken: string[] };

export type Past = Map<string, Set<Rule>>;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type TraceState = { action: string; vars: Vars };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Trace = {
  seq: { action: string; vars: Vars | undefined }[];
  loop: number | undefined;
};

export type Find<Id> = (values: Value[]) => Id | undefined;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Bug = {
  rule: Rule;
  start: string;
  path: PathStep[];
  loop?: number;
  stutters?: boolean;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type ConfigSection = { key: string; line: number; tokens: string[] };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Config = {
  sections: ConfigSection[];
  invariants: string[];
  properties: string[];
  constraints: string[];
  actionConstraints: string[];
  checkDeadlock?: boolean;
  init?: string;
  next?: string;
  spec?: string;
  view?: string;
  symmetry?: string;
  type?: string;
  typeConstraint?: string;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Spec = {
  module: string;
  variables: string[];
  invariants: string[];
  properties: string[];
  deadlock: boolean;
  written: ConfigSection[];
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Message = { code: number; level: number; body: Part[]; beforeMarker?: string };

export type Line = string;

export type Part = Line | Message;

// oxlint-disable-next-line eslint/sort-keys -- Preserve the published TLC message-code order.
export const EC = {
  TLC_INVARIANT_VIOLATED_INITIAL: 2107,
  TLC_PROPERTY_VIOLATED_INITIAL: 2108,
  TLC_INVARIANT_VIOLATED_BEHAVIOR: 2110,
  TLC_ACTION_PROPERTY_VIOLATED_BEHAVIOR: 2112,
  TLC_DEADLOCK_REACHED: 2114,
  TLC_TEMPORAL_PROPERTY_VIOLATED: 2116,
  TLC_BACK_TO_STATE: 2122,
  TLC_FINISHED: 2186,
  TLC_INIT_GENERATED1: 2190,
  TLC_INIT_GENERATED2: 2191,
  TLC_STATS: 2199,
  TLC_PROGRESS_STATS: 2200,
  TLC_STATE_PRINT2: 2217,
  TLC_STATE_PRINT3: 2218,
  TLC_SANY_END: 2219,
  TLC_SANY_START: 2220,
} as const;

// oxlint-disable-next-line eslint/sort-keys -- Keep the published severity levels in their native numeric order.
export const LEVEL = { NONE: 0, ERROR: 1, TLCBUG: 2, WARNING: 3, STATE: 4 } as const;

export type Outcome = "broken" | "holds" | "not checked";

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Verdict = {
  rule: Rule;
  outcome: Outcome;
  messages: Iterable<Part> | undefined;
};

export type Property = Verdict & { bug: Lasso | undefined; initialOnly: boolean };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Stop = { status: number | null; message: string };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type CheckResult = {
  spec: Spec & { folder: string };
  graph: Graph;
  paths: Bug[] | undefined;
  rules: Verdict[];
  properties: Property[];
  // oxlint-disable-next-line eslint/no-magic-numbers -- These literal exit codes are part of the standalone IR contract. The IR imports no driver modules.
  exit: 0 | 1 | 2;
  stop: Stop | undefined;
  drawing: { status: number | null } | undefined;
  states: { distinct: number; initial: number; complete: boolean; cut: boolean };
  messages: Iterable<Part>;
};

export const RERUN_STATES = 100_000;

export const CHART_STATES = 500;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type View = {
  state?: (vars: Vars) => unknown;
  step?: (action: string, from: Vars, to: Vars) => unknown;
  group?: (vars: Vars) => unknown;
  colors?: Record<string, string>;
  title?: string;
};

export const checked = Symbol("checked");

export type CheckedView = View & Readonly<{ [checked]: true }>;

export type Shape = Record<string, string[]>;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Walk = {
  ids: string[];
  states: State[];
  index: Map<string, number>;
  nameOf: string[];
  nameRank: Int32Array;
  from: Int32Array;
  to: Int32Array;
  action: Int32Array;
  depth: Int32Array;
  via: Int32Array;
  reached: Int32Array;
  starts: number[];
};

export type Hidden = null;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Answers = {
  names: string[];
  shapes: Shape[];
  labels: (string | Hidden)[];
  group: (index: number) => unknown;
};

export type Labels = Answers & {
  drawnLabels: string[];
  keys: string[][];
  kinds: Int32Array[];
  sizes: number[];
  sorted: Int32Array;
  pathStepIndex: Map<Step, number>;
  pathSteps: Uint8Array;
  together: Set<string>;
  notes: string[];
};

export type Story = { step?: string; state: Shape }[];

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type ChartState = {
  path: string[];
  start: boolean;
  members: number[];
  works: boolean;
  lead: boolean;
  repeats: boolean;
  breaks: { rule: Rule; always: boolean }[];
  group: unknown;
};

export type Condition =
  | { kind: "and" | "or"; otherKeys: Set<string>[] }
  | { kind: "tuples"; otherTuples: Set<string> };

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Arrow = {
  from: string;
  to: string;
  label: string;
  condition: Condition;
  when?: string;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type ChartStep = {
  from: string[];
  to: string[];
  label: string;
  when: string | undefined;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Region = {
  name: string;
  states: ChartState[];
  steps: ChartStep[];
  arrows: Arrow[];
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type Chart = {
  title: string | undefined;
  regions: Region[];
  notes: string[];
  inside: number;
  quiet: number;
  colors: Record<string, string>;
  paths: string[];
  loops: string[];
  lie?: string;
};

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer the standalone tool's native object check, including null.
export const hasObjectType = (value: unknown) => typeof value === "object";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native type guard for the standalone skill.
export const isString = (value: unknown) => typeof value === "string";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native number guard in the standalone tool without loading Effect.
export const isNumber = (value: unknown) => typeof value === "number";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesNull = (value: unknown) => value === null;

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesUndefined = (value: unknown) => value === undefined;

// oxlint-disable-next-line rules/no-type-predicate -- Keep the standalone view guard's structural record narrowing without loading Effect.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  hasObjectType(value) && !matchesNull(value) && !Array.isArray(value);

// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer the standalone input guard's string-array narrowing.
export const isStrings = (value: unknown) => Array.isArray(value) && value.every((item) => isString(item));

export const visitItems = <Item>(source: Iterable<Item>, visit: (item: Item) => void): void => {
  // oxlint-disable-next-line rules/no-for-loops -- The standalone wrapper supports Bun 1.1.5, which lacks iterator helpers.
  for (const item of source) {visit(item);}
};

const PRECEDES = -1;
const SAME_POSITION = 0;
const FOLLOWS = 1;
const FIRST_INDEX = 0;
const NEXT_INDEX = 1;

type TextOrder = typeof PRECEDES | typeof SAME_POSITION | typeof FOLLOWS;

export const byText = (left: string, right: string): TextOrder => {
  if (left < right) {return PRECEDES;}
  if (left > right) {return FOLLOWS;}
  return SAME_POSITION;
};

const ESCAPES: Record<string, string> = {
  "\t": String.raw`\t`,
  "\n": String.raw`\n`,
  "\f": String.raw`\f`,
  "\r": String.raw`\r`,
  '"': String.raw`\"`,
  "\\": String.raw`\\`,
};
const quote = (value: string): string => `"${value.replaceAll(/["\\\n\t\r\f]/gu, (character) => ESCAPES[character])}"`;

type ValuePrinter = (value: Value) => string;

const joined = (items: Value[], separator: string, print: ValuePrinter): string => {
  const cursor = { index: FIRST_INDEX, text: "" };
  while (cursor.index < items.length) {
    cursor.text += (cursor.index ? separator : "") + print(items[cursor.index]);
    cursor.index += NEXT_INDEX;
  }
  return cursor.text;
};

type TlcFunction = Extract<Value, { kind: "function" }>;

const TLA_RECORD = { close: "]", entry: ", ", open: "[", value: " |-> " };
const TLA_PAIRS = { close: ")", entry: " @@ ", open: "(", value: " :> " };

const showFunction = (value: TlcFunction, print: ValuePrinter): string => {
  const record = value.printedAs === "record";
  const format = record ? TLA_RECORD : TLA_PAIRS;
  const cursor = { index: FIRST_INDEX, text: format.open };
  while (cursor.index < value.keys.length) {
    const name = value.keys[cursor.index];
    // oxlint-disable-next-line typescript/no-base-to-string -- Preserve string coercion for keys in the existing TLC record representation.
    const keyText = record ? String(name) : print(name);
    cursor.text += `${cursor.index ? format.entry : ""}${keyText}${format.value}${print(value.values[cursor.index])}`;
    cursor.index += NEXT_INDEX;
  }
  return cursor.text + format.close;
};

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type -- Infer the standalone tool's native Boolean guard without loading Effect.
const isBoolean = (value: unknown) => typeof value === "boolean";

// oxlint-disable-next-line typescript/consistent-return -- The declared TLC variants are exhaustive. Retain the existing fallthrough for a malformed value.
const showObject = (value: Extract<Value, object>, print: ValuePrinter): string => {
  // oxlint-disable-next-line eslint/default-case -- Each supported TLC object variant has an explicit rendering.
  switch (value.kind) {
    case "model": {return value.name;}
    case "interval": {return `${value.lo}..${value.hi}`;}
    case "set": {return `{${joined(value.members, ", ", print)}}`;}
    case "function": {
      return value.printedAs === "tuple"
        ? `<<${joined(value.values, ", ", print)}>>`
        : showFunction(value, print);
    }
  }
};

export const show = (value: Value): string => {
  if (isBoolean(value)) {return value ? "TRUE" : "FALSE";}
  if (isNumber(value)) {return String(value);}
  if (isString(value)) {return quote(value);}
  return showObject(value, show);
};

const SINGLE_VARIABLE = 1;

export const defaultState = (vars: Vars): string => {
  const entries = Object.entries(vars);
  if (entries.length === SINGLE_VARIABLE) {
    const [[, value]] = entries;
    return show(value);
  }
  return entries.map(([name, value]) => `${name}=${show(value)}`).join(" ");
};

export const stateText = (vars: Vars): string =>
  Object.entries(vars).map(([name, value]) => `${name} = ${show(value)}`).join(String.raw` /\ `);

const hasReversedPair = <Item>(items: Item[], reversed: (left: Item, right: Item) => boolean): boolean => {
  const cursor = { index: NEXT_INDEX };
  while (cursor.index < items.length) {
    if (reversed(items[cursor.index - NEXT_INDEX], items[cursor.index])) {return true;}
    cursor.index += NEXT_INDEX;
  }
  return false;
};

const span = (low: number, high: number): string => high > low ? `${low}..${high}` : String(low);

const CONSECUTIVE_DISTANCE = 1;

const writeRanges = (integers: number[], write: (value: string) => void): void => {
  const cursor = { first: FIRST_INDEX, last: FIRST_INDEX };
  while (cursor.first < integers.length) {
    cursor.last = cursor.first;
    while (cursor.last + NEXT_INDEX < integers.length && integers[cursor.last + NEXT_INDEX] - integers[cursor.last] <= CONSECUTIVE_DISTANCE) {
      cursor.last += NEXT_INDEX;
    }
    write(span(integers[cursor.first], integers[cursor.last]));
    cursor.first = cursor.last + NEXT_INDEX;
  }
};

const SET_START = "{";

interface SetMembers {
  integers: number[];
  otherKeys: string[];
}

const orderedSetMembers = (members: Value[], print: ValuePrinter): SetMembers => {
  const integers: number[] = [];
  const otherKeys: string[] = [];
  visitItems(members, (value) => {
    if (isNumber(value)) {integers.push(value);}
    else {otherKeys.push(print(value));}
  });
  if (hasReversedPair(integers, (left, right) => left >= right)) {integers.sort((left, right) => left - right);}
  if (hasReversedPair(otherKeys, (left, right) => left > right)) {otherKeys.sort(byText);}
  return { integers, otherKeys };
};

const setKey = (members: Value[], print: ValuePrinter): string => {
  const { integers, otherKeys } = orderedSetMembers(members, print);
  const output = { text: SET_START };
  const write = (value: string): void => {
    output.text += (output.text.length > SET_START.length ? "," : "") + value;
  };
  writeRanges(integers, write);
  otherKeys.forEach((value, index) => {
    if (index === FIRST_INDEX || value !== otherKeys[index - NEXT_INDEX]) {write(value);}
  });
  return `${output.text}}`;
};

interface FunctionKeys {
  numeric: number;
  positions: number[];
  texts: string[];
}

const readFunctionKeys = (names: Value[], print: ValuePrinter): FunctionKeys => {
  const data: FunctionKeys = { numeric: FIRST_INDEX, positions: [], texts: [] };
  const cursor = { index: FIRST_INDEX };
  while (cursor.index < names.length) {
    data.positions.push(cursor.index);
    data.texts.push(print(names[cursor.index]));
    if (isNumber(names[cursor.index])) {data.numeric += NEXT_INDEX;}
    cursor.index += NEXT_INDEX;
  }
  return data;
};

const FIRST_TLA_TUPLE_KEY = 1;

const orderFunctionKeys = (names: Value[], print: ValuePrinter): FunctionKeys & { tuple: boolean } => {
  const data = readFunctionKeys(names, print);
  const { numeric, positions, texts } = data;
  const rank = (position: number): number => isNumber(names[position]) ? names[position] : Infinity;
  positions.sort((left, right) => rank(left) - rank(right) || byText(texts[left], texts[right]) || left - right);
  const tuple = numeric === names.length && positions.every((position, index) => names[position] === index + FIRST_TLA_TUPLE_KEY);
  return { ...data, tuple };
};

const TUPLE_KEY = { close: ">>", open: "<<", separator: "," };
const PAIRS_KEY = { close: ")", open: "(", separator: "@@" };

const functionKey = ({ keys, values }: TlcFunction, print: ValuePrinter): string => {
  const { positions, texts, tuple } = orderFunctionKeys(keys, print);
  const format = tuple ? TUPLE_KEY : PAIRS_KEY;
  const output = { entries: FIRST_INDEX, text: format.open };
  positions.forEach((position, index) => {
    const key = texts[position];
    if (index === FIRST_INDEX || key !== texts[positions[index - NEXT_INDEX]]) {
      const value = print(values[position]);
      const separator = output.entries ? format.separator : "";
      output.text += separator + (tuple ? value : `${key}:>${value}`);
      output.entries += NEXT_INDEX;
    }
  });
  return output.text + format.close;
};

const keyCache = new WeakMap<object, string>();

type CompoundValue = Exclude<Value, boolean | number | string | { kind: "model" }>;

const compoundKey = (value: CompoundValue, print: ValuePrinter): string => {
  if (value.kind === "interval") {return `{${value.lo > value.hi ? "" : span(value.lo, value.hi)}}`;}
  if (value.kind === "set") {return setKey(value.members, print);}
  return functionKey(value, print);
};

const cachedKey = (value: CompoundValue, print: ValuePrinter): string => {
  const cached = keyCache.get(value);
  if (!matchesUndefined(cached)) {return cached;}
  const result = compoundKey(value, print);
  keyCache.set(value, result);
  return result;
};

export const key = (value: Value): string => {
  if (isBoolean(value)) {return value ? "TRUE" : "FALSE";}
  if (isNumber(value)) {return String(value);}
  if (isString(value)) {return JSON.stringify(value);}
  if (value.kind === "model") {return value.name;}
  return cachedKey(value, key);
};

export const stateKey = (values: Value[]): string => joined(values, ",", key);

// Native stream reads use 16 MiB slices.
export const PART = 16_777_216;

const LAST_INDEX = -1;
const LIST_PAIR = 2;

export const list = (items: string[], and = "and"): string =>
  items.length < LIST_PAIR ? items.join("") : `${items.slice(FIRST_INDEX, LAST_INDEX).join(", ")} ${and} ${items.at(LAST_INDEX)}`;

export const must = <K, V>(map: ReadonlyMap<K, V>, searchKey: K): V => {
  const value = map.get(searchKey);
  // oxlint-disable-next-line rules/require-tagged-error -- Report the native graph lookup error without loading Effect.
  if (matchesUndefined(value)) {throw new Error(`The chart lost track of ${JSON.stringify(searchKey)}.`);}
  return value;
};

export const append = <K, V>(groups: Map<K, V[]>, groupKey: K, item: V): void => {
  const group = groups.get(groupKey);
  if (group) {group.push(item);}
  else {groups.set(groupKey, [item]);}
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
