import { EC, isString, matchesUndefined, visitItems } from '#statechart/ir.ts';
import type { Message, Part } from '#statechart/ir.ts';
import { textOf } from "./messages.ts";

export type Break =
  | { kind: "deadlock" }
  | { kind: "temporal" }
  | { kind: "invariant" | "property"; name: string };

const NAMED = new Map<number, ["invariant" | "property", RegExp]>([
  [EC.TLC_INVARIANT_VIOLATED_INITIAL, ["invariant", /^Invariant (?<name>.+) is violated by the initial/u]],
  [EC.TLC_INVARIANT_VIOLATED_BEHAVIOR, ["invariant", /^Invariant (?<name>.+) is violated\.$/mu]],
  [EC.TLC_PROPERTY_VIOLATED_INITIAL, ["property", /^Property (?<name>.+) is violated by the initial/u]],
  [EC.TLC_ACTION_PROPERTY_VIOLATED_BEHAVIOR, ["property", /^Action property (?<name>.+) is violated\.$/mu]],
]);

const DISTINCT = new Map<number, RegExp>([
  [EC.TLC_INIT_GENERATED1, /(?<count>\d+) distinct states? generated/u],
  [EC.TLC_INIT_GENERATED2, /with (?<count>\d+) of them distinct/u],
  [EC.TLC_STATS, /(?<count>\d+) distinct states found/u],
]);

interface VerdictSummary {
  broke: Break | undefined;
  distinct: number;
  initial: number;
}

const NO_STATES = 0;
const INITIAL_STATES = /(?<count>\d+) (?:distinct )?states? generated/u;

const breakOf = (message: Message): Break | undefined => {
  if (message.code === EC.TLC_DEADLOCK_REACHED) {return { kind: "deadlock" };}
  if (message.code === EC.TLC_TEMPORAL_PROPERTY_VIOLATED) {return { kind: "temporal" };}
  const named = NAMED.get(message.code);
  if (matchesUndefined(named)) {return undefined;}
  const [kind, pattern] = named;
  const name = pattern.exec(textOf(message))?.groups?.name;
  return matchesUndefined(name) ? undefined : { kind, name };
};

export const readVerdict = function readVerdict(messages: Iterable<Part>): VerdictSummary {
  const result: VerdictSummary = { broke: undefined, distinct: NO_STATES, initial: NO_STATES };
  visitItems(messages, (message) => {
    if (isString(message)) {return;}
    const count = DISTINCT.get(message.code)?.exec(textOf(message))?.groups?.count;
    if (!matchesUndefined(count)) {result.distinct = Math.max(result.distinct, Number(count));}
    if (message.code === EC.TLC_INIT_GENERATED1 || message.code === EC.TLC_INIT_GENERATED2) {
      result.initial = Number(INITIAL_STATES.exec(textOf(message))?.groups?.count ?? NO_STATES);
    }
    result.broke ??= breakOf(message);
  });
  return result;
};
