import type { Graph, State, Step, Value, Vars } from "#statechart/ir.ts";
import { parseValue } from "./value.ts";
import { isString, matchesUndefined, visitItems } from "#statechart/ir.ts";

const FIRST_OFFSET = 0;
const CODE_UNIT_WIDTH = 1;
const CONJUNCTION = String.raw`/\ `;
const DOT_ESCAPE = /\\(?<character>.)/gu;

const unescapeDot = (text: string): string =>
  text.replaceAll(DOT_ESCAPE, (_match, character: string) => character === "n" ? "\n" : character);

export const parseState = (label: string, parsed = new Map<string, [string, Value]>()): Vars => {
  const pairs: [string, Value][] = [];
  const state = label.startsWith(CONJUNCTION) ? label.slice(CONJUNCTION.length) : label;
  visitItems(state.split(`\n${CONJUNCTION}`), (part) => {
    const cached = parsed.get(part);
    if (cached) {
      pairs.push(cached);
      return;
    }
    const assignment = /^(?<name>\w+)\s*=\s*(?<value>[\s\S]*)$/u.exec(part)?.groups;
    if (matchesUndefined(assignment)) {
      // oxlint-disable-next-line rules/require-tagged-error -- The standalone DOT parser reports malformed input with the native Error consumed by Statechart.
      throw new Error(`cannot read the TLC state line "${part}"`);
    }
    const pair: [string, Value] = [assignment.name, parseValue(assignment.value)];
    parsed.set(part, pair);
    pairs.push(pair);
  });
  return Object.fromEntries(pairs);
};

export type Lines = string | Iterable<string>;

export const splitLines = (text: string): string[] =>
  (text.endsWith("\r") ? text.slice(FIRST_OFFSET, -CODE_UNIT_WIDTH) : text).split(/\r?\n/u);

export const linesOf = (input: Lines): string[] | Iterable<string> => (isString(input) ? splitLines(input) : input);

export const parseDot = function parseDot(input: Lines): Graph {
  const states = new Map<string, State>();
  const steps = new Map<string, Step>();
  const parsed = new Map<string, [string, Value]>();
  const owned = new Map<string, string>();
  const own = (text: string): string => {
    const cached = owned.get(text);
    if (!matchesUndefined(cached)) {return cached;}
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Reparse the string to detach captured identifiers from the much larger DOT input.
    const copy = String(JSON.parse(JSON.stringify(text)));
    owned.set(copy, copy);
    return copy;
  };
  visitItems(linesOf(input), (line) => {
    const edge = /^(?<from>-?\d+) -> (?<to>-?\d+) \[label="(?<action>[^"]*)"/u.exec(line)?.groups;
    if (!matchesUndefined(edge)) {
      const { from, to, action } = edge;
      // oxlint-disable-next-line eslint/sort-keys -- Retain the edge field order used in serialized Statechart graphs.
      steps.set(`${from} ${to} ${action}`, { from: own(from), to: own(to), action: own(action) });
      return;
    }
    const node = /^(?<id>-?\d+) \[label="(?<state>(?:[^"\\]|\\.)*)"(?<start>,style = filled)?/u.exec(line)?.groups;
    if (!matchesUndefined(node)) {
      // oxlint-disable-next-line eslint/sort-keys -- Retain the state field order used in serialized Statechart graphs.
      states.set(own(node.id), { vars: parseState(unescapeDot(node.state), parsed), start: !matchesUndefined(node.start), breaks: [] });
    }
  });
  visitItems(steps.values(), (loose) => {
    if (!states.has(loose.from) || !states.has(loose.to)) {
      // oxlint-disable-next-line rules/require-tagged-error -- The standalone DOT parser reports a missing graph endpoint through its native error boundary.
      throw new Error(`The TLC graph dump has a step ${loose.action} to or from a state that it does not list.`);
    }
  });
  return { states, steps: [...steps.values()] };
};
