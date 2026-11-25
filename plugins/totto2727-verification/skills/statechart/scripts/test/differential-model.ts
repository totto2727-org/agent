import fc from "fast-check";

const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];
const NAMES = [
  ...PROTOTYPE_KEYS,
  "x",
  "y",
  "phase",
  "mode",
  "Go",
  "Stop",
  "Undo",
  "Tick",
  "Reset",
  "Flip",
  "Ok",
  "Safe",
  "Bound",
  "Live",
  "NoJump",
  "red",
  "green",
  "blue",
  "idle",
  "busy",
  "done",
];
const LABELS = ["a b", ...PROTOTYPE_KEYS, "Lease held, write pending", "Ünï ✓"];
const STEPS = ["you press play", ...PROTOTYPE_KEYS, "the connect fails [while offline]"];
const GROUPS = ["paying", "a b", ...PROTOTYPE_KEYS];
export const COLORS = ["blue", "orange", "purple", "yellow"];

const MIN_SCALAR = -3;
const MAX_SCALAR = 3;
const MIN_DOMAIN_VALUES = 1;
const MAX_DOMAIN_VALUES = 4;
const BOOLEAN_VALUES = 2;
const MAX_COLLECTION_VALUES = 2;
const VARIABLE_INDEX = 2;
const VALUE_INDEX = 3;
const MIN_ASSIGNMENTS = 1;
const MAX_ASSIGNMENTS = 2;
const MIN_VARIABLES = 1;
const MAX_VARIABLES = 3;
const MIN_ACTIONS = 1;
const MAX_ACTIONS = 6;
const MAX_GUARDS = 2;
const MAX_INVARIANTS = 2;
const OPTIONAL_CONSTRAINT_FREQUENCY = 2;
const PROPERTY_FORM = 3;
const FAIR_ACTION = 5;
const MAX_REGIONS = 3;
const MAX_GROUPS = 3;

const INT = fc.integer({ max: MAX_SCALAR, min: MIN_SCALAR }).map(String);
const STRING = fc.constantFrom(
  String.raw`""`,
  String.raw`"a b"`,
  String.raw`"say \"hi\""`,
  String.raw`"back\\slash"`,
  String.raw`"tab\tstop"`,
  String.raw`"two\nlines"`,
  String.raw`"__proto__"`,
);
const values = (value: fc.Arbitrary<string>, maxLength = MAX_DOMAIN_VALUES): fc.Arbitrary<string[]> =>
  fc.uniqueArray(value, { maxLength, minLength: MIN_DOMAIN_VALUES });
const tuple = (items: string[]): string => `<<${items.join(", ")}>>`;

type Domain = string[] | { modelValues: number };
const RECORD_FIELDS = fc.tuple(INT, STRING);
const TUPLE_SET = fc.uniqueArray(fc.tuple(INT, STRING), { maxLength: MAX_COLLECTION_VALUES })
  .map((tuples) => `{${tuples.map((items) => tuple(items)).join(", ")}}`);
const TUPLE_VALUES = fc.array(INT, { maxLength: MAX_COLLECTION_VALUES }).map((items) => tuple(items));

const DOMAIN: fc.Arbitrary<Domain> = fc.oneof(
  values(INT),
  values(STRING),
  values(fc.constantFrom("TRUE", "FALSE"), BOOLEAN_VALUES),
  fc.integer({ max: MAX_DOMAIN_VALUES, min: MIN_DOMAIN_VALUES }).map((modelValues) => ({ modelValues })),
  values(RECORD_FIELDS.map(([number, text]) => `[constructor |-> ${number}, __proto__ |-> ${text}]`)),
  values(TUPLE_SET),
  values(TUPLE_VALUES),
);

// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const ATOM = fc.record({ v: fc.nat(VARIABLE_INDEX), i: fc.nat(VALUE_INDEX), not: fc.boolean() });
export interface Atom { v: number; i: number; not: boolean }

const INITIAL_VALUES = fc.array(fc.nat(VALUE_INDEX), { maxLength: MAX_ASSIGNMENTS, minLength: MIN_ASSIGNMENTS });
const VARIABLES = fc.array(fc.record({ domain: DOMAIN, init: INITIAL_VALUES }), { maxLength: MAX_VARIABLES, minLength: MIN_VARIABLES });
const TARGET_VALUES = fc.array(fc.nat(VALUE_INDEX), { maxLength: MAX_ASSIGNMENTS, minLength: MIN_ASSIGNMENTS });
// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const ASSIGNMENT = fc.record({ v: fc.nat(VARIABLE_INDEX), to: TARGET_VALUES });
const ASSIGNMENTS = fc.array(ASSIGNMENT, { maxLength: MAX_ASSIGNMENTS, minLength: MIN_ASSIGNMENTS });
const GUARDS = fc.array(ATOM, { maxLength: MAX_GUARDS });
const ACTIONS = fc.array(fc.record({ guard: GUARDS, set: ASSIGNMENTS }), { maxLength: MAX_ACTIONS, minLength: MIN_ACTIONS });
const INVARIANT = fc.array(ATOM, { maxLength: MAX_GUARDS, minLength: MIN_ASSIGNMENTS });
const INVARIANTS = fc.array(INVARIANT, { maxLength: MAX_INVARIANTS });

// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const ACTION_CONSTRAINT = fc.record({ v: fc.nat(VARIABLE_INDEX), from: fc.nat(VALUE_INDEX), to: fc.nat(VALUE_INDEX) });
const FAIR_ACTION_OPTION = fc.option(fc.nat(FAIR_ACTION));
// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const FAIRNESS = fc.record({ strong: fc.boolean(), on: FAIR_ACTION_OPTION });
const FAIRNESS_OPTION = fc.option(FAIRNESS);
const PROPERTY_ATOMS = fc.tuple(ATOM, ATOM);
// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const PROPERTY = fc.record({ form: fc.nat(PROPERTY_FORM), atoms: PROPERTY_ATOMS, fairness: FAIRNESS_OPTION });

const VIEW_LABELS = fc.uniqueArray(fc.constantFrom(...LABELS), { maxLength: MAX_DOMAIN_VALUES, minLength: MIN_DOMAIN_VALUES });
const VIEW_REGIONS = fc.uniqueArray(fc.constantFrom("Session", ...LABELS), { maxLength: MAX_REGIONS, minLength: MIN_DOMAIN_VALUES });
const STEP_LABEL = fc.option(fc.constantFrom(...STEPS));
const VIEW_STEPS = fc.array(STEP_LABEL, { maxLength: MAX_ACTIONS });
const VIEW_GROUPS = fc.uniqueArray(fc.constantFrom(...GROUPS), { maxLength: MAX_GROUPS, minLength: MIN_DOMAIN_VALUES });
const VIEW_TITLE = fc.constantFrom("A b c", "constructor");

// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
const VIEW = fc.record({
  form: fc.constantFrom("string", "parents", "regions"),
  labels: VIEW_LABELS,
  regions: VIEW_REGIONS,
  steps: fc.option(VIEW_STEPS),
  title: fc.option(VIEW_TITLE),
  groups: fc.option(VIEW_GROUPS),
});

// oxlint-disable-next-line eslint/sort-keys -- Fast-check samples fields in order. Keep existing seed replay and shrinking.
export const MODEL = fc.record({
  module: fc.constantFrom("Model", "prototype"),
  names: fc.shuffledSubarray(NAMES, { minLength: NAMES.length }),
  vars: VARIABLES,
  actions: ACTIONS,
  invariants: INVARIANTS,
  deadlock: fc.boolean(),
  initNext: fc.boolean(),
  constraint: fc.option(ATOM, { freq: OPTIONAL_CONSTRAINT_FREQUENCY }),
  actionConstraint: fc.option(ACTION_CONSTRAINT, { freq: OPTIONAL_CONSTRAINT_FREQUENCY }),
  property: fc.option(PROPERTY),
  view: fc.option(VIEW),
});

export type Model = typeof MODEL extends fc.Arbitrary<infer Sample> ? Sample : never;
