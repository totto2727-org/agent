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

export const CHECK_PASSED = 0;
export const CHECK_VIOLATION = 1;
export const CHECK_FAILED = 2;

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep this exported shape closed and assignable to structural record consumers.
export type CheckResult = {
  spec: Spec & { folder: string };
  graph: Graph;
  paths: Bug[] | undefined;
  rules: Verdict[];
  properties: Property[];
  exit: typeof CHECK_PASSED | typeof CHECK_VIOLATION | typeof CHECK_FAILED;
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
