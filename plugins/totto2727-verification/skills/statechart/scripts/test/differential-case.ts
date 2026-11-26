import { matchesNull, matchesUndefined, visitItems } from "#statechart/ir.ts";
import { COLORS } from "./differential-model.ts";
import type { Atom, Model } from "./differential-model.ts";

export interface Case {
  module: string;
  tla: string;
  view?: string;
  base: string[];
  invariants: string[];
  deadlock: boolean;
  property?: string;
}

type ModelView = NonNullable<Model["view"]>;
type ModelAction = Model["actions"][number];

const EMPTY = 0;
const NEXT_NAME = 1;
const AND = String.raw` /\ `;
const OR = String.raw` \/ `;

export const configOf = (fixture: Case): string => {
  const cfg = [...fixture.base];
  if (fixture.invariants.length > EMPTY) {cfg.push(`INVARIANTS ${fixture.invariants.join(" ")}`);}
  if (!fixture.deadlock) {cfg.push("CHECK_DEADLOCK FALSE");}
  if (!matchesUndefined(fixture.property) && fixture.property.length > EMPTY) {cfg.push(`PROPERTY ${fixture.property}`);}
  return `${cfg.join("\n")}\n`;
};

const stateSource = ({ form, regions }: ModelView): string => ({
  parents: "[pick(v[VARS[0]], 1), pick(VARS.map((n) => v[n]), 2)]",
  regions: `Object.fromEntries(${JSON.stringify(regions)}.map((r, k) => [r, pick(v[VARS[k % VARS.length]], k)]))`,
  string: "pick(VARS.map((n) => v[n]), 0)",
})[form];

const addSteps = (lines: string[], steps: ModelView["steps"], actions: string[]): void => {
  if (matchesNull(steps)) {return;}
  const labels = actions.map((action, index) => [action, index < steps.length ? steps[index] : action]);
  lines.push(
    `const STEPS = new Map(${JSON.stringify(labels)});`,
    "export const step = (action) => STEPS.get(action);",
  );
};

const addViewLabels = (lines: string[], { groups, title }: ModelView): void => {
  if (!matchesNull(title)) {lines.push(`export const title = ${JSON.stringify(title)};`);}
  if (matchesNull(groups)) {return;}
  const colors = groups.map((group, index) => [group, COLORS[index]]);
  lines.push(
    `export const colors = Object.fromEntries(${JSON.stringify(colors)});`,
    `export const group = (v) => pick(v[VARS[0]], 3, ${JSON.stringify(groups)});`,
  );
};

const viewOf = (view: ModelView, vars: string[], actions: string[]): string => {
  const lines = [
    `const VARS = ${JSON.stringify(vars)};`,
    `const LABELS = ${JSON.stringify(view.labels)};`,
    "const pick = (value, salt, from = LABELS) => {",
    "  let h = salt;",
    '  for (const c of JSON.stringify(value) ?? "") h = (h * 31 + c.codePointAt(0)) >>> 0;',
    "  return from[h % from.length];",
    "};",
    `export const state = (v) => ${stateSource(view)};`,
  ];
  addSteps(lines, view.steps, actions);
  addViewLabels(lines, view);
  return `${lines.join("\n")}\n`;
};

interface Symbols {
  atom: (atom: Atom) => string;
  name: () => string;
  modelValues: string[];
  set: (variable: number, items: number[]) => string;
  value: (variable: number, index: number) => string;
  vars: string[];
}

const allocate = (names: string[]): (() => string) => {
  const cursor = { index: EMPTY };
  return () => {
    const name = names[cursor.index];
    cursor.index += NEXT_NAME;
    return name;
  };
};

const symbolsOf = (model: Model): Symbols => {
  const name = allocate(model.names);
  const vars = model.vars.map(() => name());
  const domains = model.vars.map(({ domain }) =>
    Array.isArray(domain) ? domain : Array.from({ length: domain.modelValues }, () => name()));
  const modelValues = model.vars.flatMap(({ domain }, index) => Array.isArray(domain) ? [] : domains[index]);
  const value = (variable: number, index: number): string => {
    const entries = domains[variable % vars.length];
    return entries[index % entries.length];
  };
  const atom = ({ i: index, not, v: variable }: Atom): string =>
    `${vars[variable % vars.length]} ${not ? "#" : "="} ${value(variable, index)}`;
  const set = (variable: number, items: number[]): string => {
    const entries = new Set(items.map((index) => value(variable, index)));
    return `{${[...entries].join(", ")}}`;
  };
  return { atom, modelValues, name, set, value, vars };
};

const initial = ({ set, vars }: Symbols, model: Model): string => {
  const values = vars.map((variable, index) => `${variable} \\in ${set(index, model.vars[index].init)}`);
  return `Init == ${values.join(AND)}`;
};

const firstWrites = (action: ModelAction, variableCount: number): Map<number, number[]> => {
  const changed = new Map<number, number[]>();
  visitItems(action.set, ({ to, v: variable }) => {
    const index = variable % variableCount;
    if (!changed.has(index)) {changed.set(index, to);}
  });
  return changed;
};

const actionSource = (action: ModelAction, { atom, set, vars }: Symbols): string => {
  const changed = firstWrites(action, vars.length);
  const parts = action.guard.map((value) => atom(value));
  visitItems(changed, ([index, values]) => {parts.push(`${vars[index]}' \\in ${set(index, values)}`);});
  const kept = vars.filter((_variable, index) => !changed.has(index));
  if (kept.length > EMPTY) {parts.push(`UNCHANGED <<${kept.join(", ")}>>`);}
  return parts.join(AND);
};

const declareActions = (defs: string[], model: Model, symbols: Symbols): string[] =>
  model.actions.map((action) => {
    const source = actionSource(action, symbols);
    const identifier = symbols.name();
    defs.push(`${identifier} == ${source}`);
    return identifier;
  });

const fairnessSource = (property: Model["property"], actions: string[]): string => {
  const fairness = property?.fairness;
  if (matchesNull(fairness) || matchesUndefined(fairness)) {return "";}
  const action = matchesNull(fairness.on) ? "Next" : actions[fairness.on % actions.length];
  return ` /\\ ${fairness.strong ? "SF" : "WF"}_vars(${action})`;
};

const declareInvariants = (defs: string[], model: Model, { atom, name }: Symbols): string[] =>
  model.invariants.map((atoms) => {
    const rule = name();
    const condition = atoms.map((value) => atom(value)).join(AND);
    defs.push(`${rule} == ~(${condition})`);
    return rule;
  });

interface Clauses { base: string[]; defs: string[] }

const declareConstraints = ({ base, defs }: Clauses, model: Model, { atom, name, value, vars }: Symbols): void => {
  if (!matchesNull(model.constraint)) {
    const bound = name();
    defs.push(`${bound} == ~(${atom(model.constraint)})`);
    base.push(`CONSTRAINT ${bound}`);
  }
  if (!matchesNull(model.actionConstraint)) {
    const { from, to, v: variable } = model.actionConstraint;
    const symbol = vars[variable % vars.length];
    const bound = name();
    defs.push(`${bound} == ~(${symbol} = ${value(variable, from)} /\\ ${symbol}' = ${value(variable, to)})`);
    base.push(`ACTION_CONSTRAINT ${bound}`);
  }
};

const declareProperty = (defs: string[], property: Model["property"], { atom, name }: Symbols): string | undefined => {
  if (matchesNull(property)) {return undefined;}
  const [first, second] = property.atoms.map((value) => atom(value));
  const operator = name();
  const forms = [`<>(${first})`, `[]<>(${first})`, `(${first}) ~> (${second})`, `[](${first})`];
  defs.push(`${operator} == ${forms[property.form]}`);
  return operator;
};

interface Definitions extends Clauses {
  actions: string[];
  invariants: string[];
  property?: string;
}

const defineModel = (model: Model, symbols: Symbols): Definitions => {
  const defs = [`vars == <<${symbols.vars.join(", ")}>>`, initial(symbols, model)];
  const actions = declareActions(defs, model, symbols);
  defs.push(`Next == ${actions.join(OR)}`, `Spec == Init /\\ [][Next]_vars${fairnessSource(model.property, actions)}`);
  const base = symbols.modelValues.length > EMPTY
    ? [`CONSTANTS ${symbols.modelValues.map((value) => `${value} = ${value}`).join(" ")}`] : [];
  base.push(model.initNext && matchesNull(model.property) ? "INIT Init\nNEXT Next" : "SPECIFICATION Spec");
  const invariants = declareInvariants(defs, model, symbols);
  declareConstraints({ base, defs }, model, symbols);
  const property = declareProperty(defs, model.property, symbols);
  return { actions, base, defs, invariants, property };
};

export const caseOf = (model: Model): Case => {
  const symbols = symbolsOf(model);
  const { actions, base, defs, invariants, property } = defineModel(model, symbols);
  const { modelValues, vars } = symbols;
  const tla = [
    `---- MODULE ${model.module} ----`,
    "EXTENDS Integers",
    ...(modelValues.length > EMPTY ? [`CONSTANTS ${modelValues.join(", ")}`] : []),
    `VARIABLES ${vars.join(", ")}`,
    ...defs,
    "====",
    "",
  ].join("\n");
  // oxlint-disable-next-line eslint/sort-keys -- Fast-check reports cases as constructed, including their existing property order.
  return {
    module: model.module, tla, view: matchesNull(model.view) ? undefined : viewOf(model.view, vars, actions),
    base, invariants, deadlock: model.deadlock, property,
  };
};
