import { checked, isString, list, matchesNull, matchesUndefined } from '../ir.ts';
import type { CheckedView, Value, Vars } from '../ir.ts';

type Json = boolean | number | string | Json[] | { [key: string]: Json };

const projected = new WeakMap<object, Json>();

export const json = (v: Value): Json => {
  if (typeof v !== "object") {return v;}
  if (v.kind === "model") {return v.name;}
  let j = projected.get(v);
  if (matchesUndefined(j)) {
    if (v.kind === "interval") {
      const members: Json[] = [];
      for (let k = v.lo; k <= v.hi; k++) {members.push(k);}
      j = members;
    } else if (v.kind === "set") {
      const members: Json[] = [];
      Iterator.from(v.members).forEach((m) => {members.push(json(m));});
      j = members;
    } else {
      const fields: [string, Json][] = [];
      for (let i = 0; i < v.keys.length; i++) {
        const currentJson = json(v.keys[i]);
        fields.push([typeof currentJson === "object" ? JSON.stringify(currentJson) : String(currentJson), json(v.values[i])]);
      }
      j = Object.fromEntries(fields);
    }
    projected.set(v, j);
  }
  return j;
};

const projectedVars = new WeakMap<Vars, { [name: string]: Json }>();

const jsonVars = (vars: Vars) => {
  let j = projectedVars.get(vars);
  if (matchesUndefined(j)) {
    const fields: [string, Json][] = [];
    Object.entries(vars).forEach(([name, v]) => {fields.push([name, json(v)]);});
    j = Object.fromEntries(fields);
    projectedVars.set(vars, j);
  }
  return j;
};

const THEME_COLORS = ["blue", "orange", "purple", "yellow", "teal", "tan", "pink"];

const isFunction = (v: unknown): v is (...args: unknown[]) => unknown => typeof v === "function";

const isPlainObject = (v: unknown): v is { [key: string]: unknown } => {
  if (typeof v !== "object" || matchesNull(v)) {return false;}
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || matchesNull(proto);
};



const VIEW_EXPORTS = ["state", "step", "group", "colors", "title"];

type Inspect = (value: unknown, options: { breakLength: number }) => string;

export function checkView(
  view: Readonly<{ [name: string]: unknown }>,
  inspect: Inspect,
): CheckedView {
  const literal = (v: unknown): string =>
    isString(v) ? JSON.stringify(v) : inspect(v, { breakLength: Infinity });
  const extra: string[] = [];
  Object.keys(view).forEach((name) => {if (!VIEW_EXPORTS.includes(name)) {extra.push(name);}});
  if (extra.length)
    {throw new Error(
      `The view exports ${list(extra)}, which the command does not read. Export only ${list(VIEW_EXPORTS)}.`,
    );}
  const wrong: string[] = [];
  const pick = <T>(name: string, kind: string, fits: (v: unknown) => v is T) => {
    const v = view[name];
    if (matchesUndefined(v) || fits(v)) {return v;}
    wrong.push(`${name} must be ${kind}`);
    return undefined;
  };
  const state = pick("state", "a function", isFunction);
  const step = pick("step", "a function", isFunction);
  const group = pick("group", "a function", isFunction);
  const exported = pick("colors", "a plain object", isPlainObject);
  const title = pick("title", "a string", isString);
  if (wrong.length) {throw new Error(`The view's ${list(wrong)}.`);}
  if (!matchesUndefined(group) && matchesUndefined(exported))
    {throw new Error("The view exports group() but no colors. Give each group a color in colors.");}
  const colors: { [group: string]: string } = Object.create(null);
  const bad: string[] = [];
  Object.entries(exported ?? {}).forEach(([name, color]) => {
    if (isString(color) && THEME_COLORS.includes(color)) {colors[name] = color;}
    else {bad.push(`${JSON.stringify(name)} the color ${literal(color)}`);}
  });
  if (bad.length)
    {throw new Error(
      `The view's colors give ${list(bad)}. Give each group ${list(THEME_COLORS, "or")}.`,
    );}
  const named =
    group &&
    ((vars: Vars) => {
      const g = group(jsonVars(vars));
      if (!matchesUndefined(g) && !Object.hasOwn(colors, typeof g === "symbol" ? g : String(g)))
        {throw new Error(
          `The view's group() returned ${literal(g)}, which colors does not name. Give each group a color in colors.`,
        );}
      return g;
    });
  return {
    state: state && ((vars: Vars) => state(jsonVars(vars))),
    step:
      step &&
      ((action: string, from: Vars, to: Vars) => step(action, jsonVars(from), jsonVars(to))),
    group: named,
    colors,
    title,
    [checked]: true,
  };
}
