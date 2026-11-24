import { EC, isString } from '../ir.ts';
import type { Part } from '../ir.ts';
import { textOf } from "./messages.ts";

export type Break =
  | { kind: "deadlock" }
  | { kind: "temporal" }
  | { kind: "invariant" | "property"; name: string };

const NAMED = new Map<number, ["invariant" | "property", RegExp]>([
  [EC.TLC_INVARIANT_VIOLATED_INITIAL, ["invariant", /^Invariant (.+) is violated by the initial/]],
  [EC.TLC_INVARIANT_VIOLATED_BEHAVIOR, ["invariant", /^Invariant (.+) is violated\.$/m]],
  [EC.TLC_PROPERTY_VIOLATED_INITIAL, ["property", /^Property (.+) is violated by the initial/]],
  [EC.TLC_ACTION_PROPERTY_VIOLATED_BEHAVIOR, ["property", /^Action property (.+) is violated\.$/m]],
]);

const DISTINCT = new Map<number, RegExp>([
  [EC.TLC_INIT_GENERATED1, /(\d+) distinct states? generated/u],
  [EC.TLC_INIT_GENERATED2, /with (\d+) of them distinct/u],
  [EC.TLC_STATS, /(\d+) distinct states found/u],
]);

export function readVerdict(messages: Iterable<Part>) {
  let broke: Break | undefined;
  let distinct = 0;
  let initial = 0;
  Iterator.from(messages).forEach((message) => {
    if (isString(message)) {return;}
    const count = DISTINCT.get(message.code)?.exec(textOf(message));
    if (count) {distinct = Math.max(distinct, Number(count[1]));}
    if (message.code === EC.TLC_INIT_GENERATED1 || message.code === EC.TLC_INIT_GENERATED2)
      {initial = Number(/(\d+) (?:distinct )?states? generated/u.exec(textOf(message))?.[1] ?? 0);}
    if (broke) {return;}
    if (message.code === EC.TLC_DEADLOCK_REACHED) {broke = { kind: "deadlock" };}
    else if (message.code === EC.TLC_TEMPORAL_PROPERTY_VIOLATED) {broke = { kind: "temporal" };}
    const named = NAMED.get(message.code);
    const name = named?.[1].exec(textOf(message))?.[1];
    if (named && name) {broke = { kind: named[0], name };}
  });
  return { broke, distinct, initial };
}
