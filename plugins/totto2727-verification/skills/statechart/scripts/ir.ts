export type Value =
  | boolean
  | number
  | string
  | { kind: "model"; name: string }
  | { kind: "set"; members: Value[] }
  | { kind: "interval"; lo: number; hi: number }
  | { kind: "function"; printedAs: "tuple" | "record" | "pairs"; keys: Value[]; values: Value[] };

export type Vars = Record<string, Value>;

export type Rule = { kind: "invariant" | "deadlock" | "property"; name: string };

interface StateBase { vars: Vars; start: boolean; breaks: Rule[] }

export type PastState = StateBase & { ends: Rule[]; past: true; excluded: boolean };

export type State =
  | (StateBase & { ends?: Rule[]; past?: undefined; excluded?: undefined })
  | PastState;

export type Step = { from: string; to: string; action: string };

export type Graph = { states: Map<string, State>; steps: Step[] };

export type PathStep = { action: string; state: string; step: Step };

export type Output = Iterable<Uint8Array>;

export type Lasso = {
  start: string;
  path: PathStep[];
  loop: number | undefined;
  stutters: boolean;
};

export type Mark = { values: Value[]; broken: string[] };

export type Past = Map<string, Set<Rule>>;

export type TraceState = { action: string; vars: Vars };

export type Trace = {
  seq: { action: string; vars: Vars | undefined }[];
  loop: number | undefined;
};

export type Find<Id> = (values: Value[]) => Id | undefined;

export type Bug = {
  rule: Rule;
  start: string;
  path: PathStep[];
  loop?: number;
  stutters?: boolean;
};

export type ConfigSection = { key: string; line: number; tokens: string[] };

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

export type Spec = {
  module: string;
  variables: string[];
  invariants: string[];
  properties: string[];
  deadlock: boolean;
  written: ConfigSection[];
};

export type Message = { code: number; level: number; body: Part[]; beforeMarker?: string };

export type Line = string;

export type Part = Line | Message;

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

export const LEVEL = { NONE: 0, ERROR: 1, TLCBUG: 2, WARNING: 3, STATE: 4 } as const;

export type Outcome = "broken" | "holds" | "not checked";

export type Verdict = {
  rule: Rule;
  outcome: Outcome;
  messages: Iterable<Part> | undefined;
};

export type Property = Verdict & { bug: Lasso | undefined; initialOnly: boolean };

export type Stop = { status: number | null; message: string };

export type CheckResult = {
  spec: Spec & { folder: string };
  graph: Graph;
  paths: Bug[] | undefined;
  rules: Verdict[];
  properties: Property[];
  exit: 0 | 1 | 2;
  stop: Stop | undefined;
  drawing: { status: number | null } | undefined;
  states: { distinct: number; initial: number; complete: boolean; cut: boolean };
  messages: Iterable<Part>;
};

export const RERUN_STATES = 100_000;

export const CHART_STATES = 500;

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

export type Answers = {
  names: string[];
  shapes: Shape[];
  labels: (string | Hidden)[];
  group: (i: number) => unknown;
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

export type Arrow = {
  from: string;
  to: string;
  label: string;
  condition: Condition;
  when?: string;
};

export type ChartStep = {
  from: string[];
  to: string[];
  label: string;
  when: string | undefined;
};

export type Region = {
  name: string;
  states: ChartState[];
  steps: ChartStep[];
  arrows: Arrow[];
};

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

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  hasObjectType(v) && !matchesNull(v) && !Array.isArray(v);

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native type guard for the standalone skill.
export const isString = (value: unknown) => typeof value === "string";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native number guard in the standalone tool without loading Effect.
export const isNumber = (value: unknown) => typeof value === "number";

export const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => isString(s));

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesNull = (value: unknown) => value === null;

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesUndefined = (value: unknown) => value === undefined;

export const visitItems = <Item>(source: Iterable<Item>, visit: (item: Item) => void): void => {
  // oxlint-disable-next-line rules/no-for-loops -- The standalone wrapper supports Bun 1.1.5, which lacks iterator helpers.
  for (const item of source) {visit(item);}
};

// Native stream reads use 16 MiB slices.
export const PART = 16_777_216;

const PRECEDES = -1;
const SAME_POSITION = 0;
const FOLLOWS = 1;
const FIRST_INDEX = 0;
const NEXT_INDEX = 1;
const LAST_INDEX = -1;
const LIST_PAIR = 2;

type TextOrder = typeof PRECEDES | typeof SAME_POSITION | typeof FOLLOWS;

export const byText = (left: string, right: string): TextOrder => {
  if (left < right) {return PRECEDES;}
  if (left > right) {return FOLLOWS;}
  return SAME_POSITION;
};

export const list = (items: string[], and = "and"): string =>
  items.length < LIST_PAIR ? items.join("") : `${items.slice(FIRST_INDEX, LAST_INDEX).join(", ")} ${and} ${items.at(LAST_INDEX)}`;

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

export const must = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
  const value = map.get(key);
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

export const loopOf = (bug: Bug, index: ReadonlyMap<string, number>) =>
  new Set(matchesUndefined(bug.loop) ? [] : seqOf(bug, index).slice(bug.loop));

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
export const unkey = (k: string): string[] => {
  const parts: unknown = JSON.parse(k);
  if (!isStrings(parts)) {throw new Error(`The chart cannot read the key ${k}.`);}
  return parts;
};

export const holds = function holds(condition: Condition, others: string[]): boolean {
  switch (condition.kind) {
    case "and": {
      for (let j = 0; j < others.length; j++)
        {if (!condition.otherKeys[j].has(others[j])) {return false;}}
      return true;
    }
    case "or": {
      for (let j = 0; j < others.length; j++)
        {if (condition.otherKeys[j].has(others[j])) {return true;}}
      return false;
    }
    case "tuples": {
      return condition.otherTuples.has(tupleKey(others));
    }
  }
};

export const ruleKey = (rule: Rule): string => tupleKey([rule.kind, rule.name]);

export const hasRule = (rules: Rule[], rule: Rule): boolean => {
  for (const currentRule of rules) {if (currentRule.kind === rule.kind && currentRule.name === rule.name) {return true;}}
  return false;
};

const ascending = (keys: string[]): boolean => {
  for (let keyIndex = 1; keyIndex < keys.length; keyIndex++) {if (keys[keyIndex - 1] > keys[keyIndex]) {return false;}}
  return true;
};

const span = (lo: number, hi: number): string => (hi > lo ? `${lo}..${hi}` : String(lo));

const setKey = (members: Value[]): string => {
  const ints: number[] = [];
  let others: string[] = [];
  visitItems(members, (currentValue) => {if (isNumber(currentValue)) {ints.push(currentValue);}
    else {others.push(key(currentValue));}});
  for (let i = 1; i < ints.length; i++)
    {if (ints[i - 1] >= ints[i]) {
      ints.sort((left, right) => left - right);
      break;
    }}
  if (!ascending(others)) {others = others.sort(byText);}
  let s = "{";
  for (let i = 0; i < ints.length;) {
    let j = i;
    while (j + 1 < ints.length && ints[j + 1] - ints[j] <= 1) {j++;}
    s += `${s.length > 1 ? "," : ""}${span(ints[i], ints[j])}`;
    i = j + 1;
  }
  for (let i = 0; i < others.length; i++)
    {if (!i || others[i] !== others[i - 1]) {s += (s.length > 1 ? "," : "") + others[i];}}
  return `${s  }}`;
};

const functionKey = ({ keys, values }: { keys: Value[]; values: Value[] }): string => {
  const order: number[] = [];
  const keyTexts: string[] = [];
  let ints = 0;
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    order.push(keyIndex);
    keyTexts.push(key(keys[keyIndex]));
    if (isNumber(keys[keyIndex])) {ints++;}
  }
  const rank = (index: number): number => (isNumber(keys[index]) ? keys[index] : Infinity);
  order.sort((left, right) => rank(left) - rank(right) || byText(keyTexts[left], keyTexts[right]) || left - right);
  let tuple = ints === keys.length;
  for (let i = 0; tuple && i < order.length; i++) {tuple = keys[order[i]] === i + 1;}
  let s = tuple ? "<<" : "(";
  for (let i = 0, kept = 0; i < order.length; i++) {
    const k = order[i];
    if (i && keyTexts[k] === keyTexts[order[i - 1]]) {continue;}
    const v = key(values[k]);
    s += tuple ? `${kept++ ? "," : ""}${v}` : `${kept++ ? "@@" : ""}${keyTexts[k]}:>${v}`;
  }
  return s + (tuple ? ">>" : ")");
};

const keys = new WeakMap<object, string>();

export const key = (v: Value): string => {
  switch (typeof v) {
    case "boolean": {
      return v ? "TRUE" : "FALSE";
    }
    case "number": {
      return String(v);
    }
    case "string": {
      return JSON.stringify(v);
    }
  }
  if (v.kind === "model") {return v.name;}
  let k = keys.get(v);
  if (matchesUndefined(k)) {
    k =
      v.kind === "interval"
        ? `{${v.lo > v.hi ? "" : span(v.lo, v.hi)}}`
        : (v.kind === "set"
          ? setKey(v.members)
          : functionKey(v));
    keys.set(v, k);
  }
  return k;
};

export const stateKey = (values: Value[]): string => {
  let k = "";
  for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {k += (valueIndex ? "," : "") + key(values[valueIndex]);}
  return k;
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

export const valuesOf = (vars: Vars, names: string[]) => {
  const values: Value[] = [];
  visitItems(names, (currentName) => {values.push(vars[currentName]);});
  return values;
};

export const findTrace = <Id>(
  counterexample: TraceState[],
  names: string[],
  rule: Rule,
  find: Find<Id>,
) => {
  const trace: (TraceState & { values: Value[]; id: Id | undefined })[] = [];
  visitItems(counterexample, ({ action, vars }) => {
    const values = valuesOf(vars, names);
    trace.push({ action, vars, values, id: find(values) });
  });
  const end = trace.length - 1;
  if (end < 0) {throw new Error(`TLC's trace for ${rule.name} has no states.`);}
  for (let i = 0; i < end; i++)
    {if (matchesUndefined(trace[i].id))
      {throw new Error(
        `TLC's trace for ${rule.name} has a state before its last that the dump does not list.`,
      );}}
  return trace;
};

export const findLoop = <Id>({ seq, loop }: Trace, names: string[], find: Find<Id>) => {
  const found: { action: string; id: Id | undefined }[] = [];
  visitItems(seq, ({ action, vars }) => {found.push({ action, id: vars && find(valuesOf(vars, names)) });});
  return { seq: found, loop };
};

export const pastState = (
  vars: Vars,
  start: boolean,
  marked: Iterable<Rule>,
  excluded: boolean,
): PastState => {
  const breaks: Rule[] = [];
  visitItems(marked, (rule) => {if (!hasRule(breaks, rule)) {breaks.push(rule);}});
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
  for (const section of written) {if (keys.includes(section.key)) {return true;}}
  return false;
};

export const stateRules = (spec: Spec) => {
  const rules: Rule[] = [];
  visitItems(spec.invariants, (name) => {rules.push({ kind: "invariant", name });});
  if (spec.deadlock) {rules.push(deadlockRule(spec));}
  return rules;
};
