import { checked, hasObjectType, isString, list, matchesNull, matchesUndefined, visitItems } from "#statechart/ir.ts";
import type { CheckedView, Value, Vars } from "#statechart/ir.ts";

type Json = boolean | number | string | Json[] | { [key: string]: Json };
type Projection = (value: Value) => Json;
type Collection = Extract<Value, { kind: "function" | "interval" | "set" }>;

const ONE_MEMBER = 1;
const FIRST_INDEX = 0;
const projected = new WeakMap<object, Json>();

const intervalMembers = ({ lo, hi }: Extract<Collection, { kind: "interval" }>): Json[] => {
  const members: Json[] = [];
  // oxlint-disable-next-line rules/no-let -- Traverse the native inclusive interval without rounding its endpoints or preallocating a range.
  let member = lo;
  while (member <= hi) {
    members.push(member);
    member += ONE_MEMBER;
  }
  return members;
};

const functionFields = (value: Extract<Collection, { kind: "function" }>, project: Projection): Record<string, Json> => {
  const fields: [string, Json][] = [];
  // oxlint-disable-next-line rules/no-let -- Traverse by index so sparse function keys and values are read in their existing order.
  let index = FIRST_INDEX;
  while (index < value.keys.length) {
    const key = project(value.keys[index]);
    fields.push([hasObjectType(key) ? JSON.stringify(key) : String(key), project(value.values[index])]);
    index += ONE_MEMBER;
  }
  return Object.fromEntries(fields);
};

const projectCollection = (value: Collection, project: Projection): Json => {
  if (value.kind === "interval") {return intervalMembers(value);}
  if (value.kind === "function") {return functionFields(value, project);}
  const members: Json[] = [];
  visitItems(value.members, (member) => {members.push(project(member));});
  return members;
};

export const json = (value: Value): Json => {
  if (!hasObjectType(value)) {return value;}
  if (value.kind === "model") {return value.name;}
  const cached = projected.get(value);
  if (!matchesUndefined(cached)) {return cached;}
  const result = projectCollection(value, json);
  projected.set(value, result);
  return result;
};

const projectedVars = new WeakMap<Vars, Record<string, Json>>();

const jsonVars = (vars: Vars): Record<string, Json> => {
  const cached = projectedVars.get(vars);
  if (!matchesUndefined(cached)) {return cached;}
  const fields = Object.entries(vars).map(([name, value]): [string, Json] => [name, json(value)]);
  const result = Object.fromEntries(fields);
  projectedVars.set(vars, result);
  return result;
};

const THEME_COLORS = ["blue", "orange", "purple", "yellow", "teal", "tan", "pink"];
const VIEW_EXPORTS = ["state", "step", "group", "colors", "title"];

type Hook = (...args: unknown[]) => unknown;
type Inspect = (value: unknown, options: { breakLength: number }) => string;
type RenderValue = (value: unknown) => string;

// oxlint-disable-next-line rules/force-predicate, rules/no-type-predicate -- The standalone viewer narrows to the callable signature used by its hooks.
const isFunction = (value: unknown): value is Hook => typeof value === "function";

// oxlint-disable-next-line rules/no-type-predicate -- The standalone viewer accepts native plain and null-prototype color records without loading Effect.
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!hasObjectType(value) || matchesNull(value)) {return false;}
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || matchesNull(prototype);
};

const failView = (message: string): never => {
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone view contract exposes the host Error and its native diagnostic message.
  throw new Error(message);
};

// oxlint-disable-next-line rules/no-type-predicate -- Export guards narrow each native view hook before it can be called.
type ViewGuard<Item> = (value: unknown) => value is Item;

interface ViewExports {
  colors: Record<string, unknown> | undefined;
  group: Hook | undefined;
  state: Hook | undefined;
  step: Hook | undefined;
  title: string | undefined;
}

const parseExports = (view: Readonly<Record<string, unknown>>): ViewExports => {
  const wrong: string[] = [];
  const pick = <Item>(name: string, kind: string, fits: ViewGuard<Item>): Item | undefined => {
    const value = view[name];
    const valid = matchesUndefined(value) || fits(value);
    if (!valid) {wrong.push(`${name} must be ${kind}`);}
    return valid ? value : undefined;
  };
  const state = pick("state", "a function", isFunction);
  const step = pick("step", "a function", isFunction);
  const group = pick("group", "a function", isFunction);
  const colors = pick("colors", "a plain object", isPlainObject);
  const title = pick("title", "a string", isString);
  if (wrong.length) {failView(`The view's ${list(wrong)}.`);}
  return { colors, group, state, step, title };
};

const themeColors = (supplied: Record<string, unknown> | undefined, literal: RenderValue): Record<string, string> => {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Object.create(null) creates an empty native dictionary for the checked color keys.
  const colors: Record<string, string> = Object.create(null);
  const bad: string[] = [];
  Object.entries(supplied ?? {}).forEach(([name, color]) => {
    if (isString(color) && THEME_COLORS.includes(color)) {colors[name] = color;}
    else {bad.push(`${JSON.stringify(name)} the color ${literal(color)}`);}
  });
  if (bad.length) {
    failView(`The view's colors give ${list(bad)}. Give each group ${list(THEME_COLORS, "or")}.`);
  }
  return colors;
};

const groupKey = (name: unknown): string | symbol =>
  // oxlint-disable-next-line rules/force-predicate -- Preserve a native symbol key when checking the standalone view's color names.
  typeof name === "symbol" ? name : String(name);

const namedGroup = (group: Hook, colors: Record<string, string>, literal: RenderValue) => (vars: Vars): unknown => {
  const name = group(jsonVars(vars));
  if (!matchesUndefined(name) && !Object.hasOwn(colors, groupKey(name))) {
    failView(`The view's group() returned ${literal(name)}, which colors does not name. Give each group a color in colors.`);
  }
  return name;
};

export const checkView = function checkView(view: Readonly<Record<string, unknown>>, inspect: Inspect): CheckedView {
  const extra = Object.keys(view).filter((name) => !VIEW_EXPORTS.includes(name));
  if (extra.length) {
    failView(`The view exports ${list(extra)}, which the command does not read. Export only ${list(VIEW_EXPORTS)}.`);
  }
  const literal = (value: unknown): string => isString(value) ? JSON.stringify(value) : inspect(value, { breakLength: Infinity });
  const { colors: supplied, group, state, step, title } = parseExports(view);
  if (!matchesUndefined(group) && matchesUndefined(supplied)) {
    failView("The view exports group() but no colors. Give each group a color in colors.");
  }
  const colors = themeColors(supplied, literal);
  // oxlint-disable-next-line eslint/sort-keys -- Retain the checked-view field order used by callers and the native marker after its string keys.
  return {
    state: state && ((vars: Vars) => state(jsonVars(vars))),
    step: step && ((action: string, from: Vars, to: Vars) => step(action, jsonVars(from), jsonVars(to))),
    group: group && namedGroup(group, colors, literal),
    colors,
    title,
    [checked]: true,
  };
};
