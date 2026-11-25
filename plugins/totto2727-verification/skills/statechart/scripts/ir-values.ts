import type { Value, Vars } from "./ir-model.ts";
import { FIRST_INDEX, NEXT_INDEX, byText, isNumber, isString, matchesUndefined, visitItems } from "./ir-primitives.ts";

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
