import { append, byText, holds, matchesUndefined, must, tupleKey, unkey, visitItems } from "#statechart/ir.ts";
import type { Arrow, Condition, Labels, Walk } from "#statechart/ir.ts";

const FIRST_PART = 0;
const SINGLE_REGION = 1;
const SINGLE_CHOICE = 1;
const ANY_REST: Condition = { kind: "and", otherKeys: [] };

export interface RegionMove {
  fromKind: number;
  group: number[];
  other: RegionMove | undefined;
  text: string;
  toKind: number;
}

interface ArrowInput {
  from: Walk["from"];
  keyOf: string[];
  labels: Labels;
  moves: RegionMove[];
  order: Int32Array;
}

interface Edge {
  from: string;
  label: string;
  to: string;
}

const edgeOf = (move: RegionMove, keys: string[]): Edge =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain from, to and label order in chart arrows.
  ({ from: keys[move.fromKind], to: keys[move.toKind], label: move.text });

type Takes = (candidate: string[]) => boolean;

interface Options {
  all: Set<string>[];
  and: Set<string>[];
  or: Set<string>[];
}

interface OtherOptions {
  all: Set<string>;
  and: Set<string>;
  or: Set<string>;
}

const optionsAt = (seen: string[][], takes: Takes, otherIndex: number): OtherOptions => {
  const values = new Set<string>();
  const taken = new Set<string>();
  const untaken = new Set<string>();
  visitItems(seen, (candidate) => {
    const value = candidate[otherIndex];
    values.add(value);
    if (takes(candidate)) {taken.add(value);}
    else {untaken.add(value);}
  });
  const only = new Set<string>();
  visitItems(values, (value) => {if (!untaken.has(value)) {only.add(value);}});
  return { all: values, and: taken, or: only };
};

const optionsIn = (others: number[], seen: string[][], takes: Takes): Options => {
  const options: Options = { all: [], and: [], or: [] };
  visitItems(others.keys(), (index) => {
    const { all, and, or } = optionsAt(seen, takes, index);
    options.all.push(all);
    options.and.push(and);
    options.or.push(or);
  });
  return options;
};

class OtherRegions {
  #labels: Labels;
  #others: number[];
  #two: boolean;
  #states = new Map<number, number[]>();
  #seen = new Map<number, string[][]>();

  public constructor(labels: Labels, regionIndex: number, order: Int32Array) {
    this.#labels = labels;
    this.#others = [...labels.names.keys()].filter((index) => index !== regionIndex);
    this.#two = this.#others.length === SINGLE_REGION;
    const kind = labels.kinds[regionIndex];
    visitItems(order, (stateIndex) => {append(this.#states, kind[stateIndex], stateIndex);});
  }

  #tuple(stateIndex: number): string[] {
    return this.#others.map((index) => this.#labels.keys[index][stateIndex]);
  }

  #candidates(kind: number): string[][] {
    const existing = this.#seen.get(kind);
    if (!matchesUndefined(existing)) {return existing;}
    const seen: string[][] = [];
    const known = new Set<string>();
    visitItems(must(this.#states, kind), (stateIndex) => {
      const candidate = this.#tuple(stateIndex);
      const tuple = tupleKey(candidate);
      if (known.has(tuple)) {return;}
      known.add(tuple);
      seen.push(candidate);
    });
    this.#seen.set(kind, seen);
    return seen;
  }

  #words(values: Iterable<string>): string {
    const paths = Array.from(values, (value) => unkey(value).join(" / "));
    return paths.toSorted(byText).join(this.#two ? " or " : ", ");
  }

  #include(regionIndex: number, values: Set<string>): string {
    const words = this.#words(values);
    if (this.#two) {return `when ${words}`;}
    const choice = values.size > SINGLE_CHOICE ? "one of " : "";
    return `${this.#labels.names[regionIndex]} is ${choice}${words}`;
  }

  #exclude(regionIndex: number, values: string[]): string {
    const words = this.#words(values);
    if (this.#two) {return `unless ${words}`;}
    const choice = values.length > SINGLE_CHOICE ? "none of" : "not";
    return `${this.#labels.names[regionIndex]} is ${choice} ${words}`;
  }

  #andWords({ all, and }: Options): string | undefined {
    const parts: string[] = [];
    visitItems(this.#others.keys(), (index) => {
      const regionIndex = this.#others[index];
      const taken = and[index];
      const excluded = [...all[index]].filter((value) => !taken.has(value));
      if (excluded.length) {
        parts.push(taken.size <= excluded.length ? this.#include(regionIndex, taken) : this.#exclude(regionIndex, excluded));
      }
    });
    if (!parts.length) {return undefined;}
    return this.#two ? parts[FIRST_PART] : `when ${parts.join(" and ")}`;
  }

  #orWords({ or }: Options): string {
    const parts: string[] = [];
    visitItems(this.#others.keys(), (index) => {
      const taken = or[index];
      if (taken.size) {parts.push(this.#include(this.#others[index], taken));}
    });
    return `when ${parts.join(" or ")}`;
  }

  public arrow(move: RegionMove, edge: Edge, from: Walk["from"]): Arrow {
    const ok = new Set<string>();
    visitItems(move.group, (stepIndex) => {ok.add(tupleKey(this.#tuple(from[stepIndex])));});
    const takes = (candidate: string[]): boolean => ok.has(tupleKey(candidate));
    const seen = this.#candidates(move.fromKind);
    const options = optionsIn(this.#others, seen, takes);
    return this.#condition(edge, { ok, options, seen, takes });
  }

  #condition(edge: Edge, { ok, options, seen, takes }: { ok: Set<string>; options: Options; seen: string[][]; takes: Takes }): Arrow {
    const fits = (condition: Condition): boolean => seen.every((candidate) => holds(condition, candidate) === takes(candidate));
    const and: Condition = { kind: "and", otherKeys: options.and };
    if (fits(and)) {return { ...edge, condition: and, when: this.#andWords(options) };}
    const or: Condition = { kind: "or", otherKeys: options.or };
    if (fits(or)) {return { ...edge, condition: or, when: this.#orWords(options) };}
    return { ...edge, condition: { kind: "tuples", otherTuples: ok } };
  }
}

export const arrowsOfRegion = (regionIndex: number, { from, keyOf, labels, moves, order }: ArrowInput): Arrow[] => {
  if (labels.names.length === SINGLE_REGION) {
    return moves.map((move) => ({ ...edgeOf(move, keyOf), condition: ANY_REST, when: undefined }));
  }
  const others = new OtherRegions(labels, regionIndex, order);
  return moves.map((move) => others.arrow(move, edgeOf(move, keyOf), from));
};
