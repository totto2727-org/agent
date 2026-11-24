// oxlint-disable-next-line import/no-relative-parent-imports -- The standalone skill loads the adjacent IR module without an alias resolver.
import { append, holds, matchesUndefined, tupleKey, unkey } from "../ir.ts";
// oxlint-disable-next-line import/no-relative-parent-imports -- Share the pipeline's IR types within the standalone skill.
import type { Arrow, Labels, Region, Walk } from "../ir.ts";

interface Move {
  from: string[];
  text: string;
  to: string[];
}

interface Enabled {
  arrow: Arrow;
  regionIndex: number;
}

interface CheckInput {
  labels: Labels;
  order: Int32Array;
  regions: Region[];
  walk: Walk;
}

const combo = ({ names, keys }: Labels, state: number): string[] =>
  names.map((_name, index) => keys[index][state]);

const words = ({ names }: Labels, parts: string[]): string =>
  names.map((name, index) => `${name} ${unkey(parts[index]).join(" / ")}`).join(", ");

const addMove = (moves: Map<string, Move>, move: Move): void => {
  moves.set(tupleKey([move.from, move.text, move.to]), move);
};

const extendChoices = <Choice>(combinations: Choice[][], options: Choice[]): Choice[][] => {
  const extended: Choice[][] = [];
  combinations.forEach((combination) => {
    options.forEach((option) => { extended.push([...combination, option]); });
  });
  return extended;
};

const firstFalseStart = ({ labels, regions, walk }: CheckInput): string[] | undefined => {
  // oxlint-disable-next-line unicorn/no-array-reduce -- Each region extends the combinations from the preceding region.
  const expected = regions.reduce<string[][]>(
    (product, region) => {
      const paths = region.states.filter((state) => state.start).map((state) => tupleKey(state.path));
      return extendChoices(product, paths);
    },
    [[]],
  );
  const real = new Set(walk.starts.map((state) => tupleKey(combo(labels, state))));
  return expected.find((parts) => !real.has(tupleKey(parts)));
};

const firstTupleCondition = ({ labels, regions }: CheckInput): string | undefined => {
  // oxlint-disable-next-line rules/no-for-loops -- Stop at the first unsupported condition on all supported runtimes.
  for (const [index, region] of regions.entries()) {
    const arrow = region.arrows.find(({ condition }) => condition.kind === "tuples");
    if (arrow) {
      return `In ${labels.names[index]}, ${arrow.label} from ${unkey(arrow.from).join(" / ")} depends on the other regions in a way that one "and" or "or" condition cannot say.`;
    }
  }
  return undefined;
};

const realMoves = ({ labels, walk }: CheckInput): Map<string, Move> => {
  const real = new Map<string, Move>();
  labels.sorted.forEach((step) => {
    const before = combo(labels, walk.from[step]);
    const after = combo(labels, walk.to[step]);
    if (tupleKey(before) === tupleKey(after)) {
      return;
    }
    addMove(real, { from: before, text: labels.drawnLabels[step], to: after });
  });
  return real;
};

const enabledMoves = (regions: Region[], parts: string[]): Map<string, Enabled[]> => {
  const enabled = new Map<string, Enabled[]>();
  regions.forEach((region, regionIndex) => {
    const rest = parts.filter((_part, index) => index !== regionIndex);
    region.arrows.forEach((arrow) => {
      if (arrow.from === parts[regionIndex] && holds(arrow.condition, rest)) {
        append(enabled, arrow.label, { arrow, regionIndex });
      }
    });
  });
  return enabled;
};

const groupMoves = (moves: Enabled[], together: boolean): Enabled[][] => {
  if (!together) {
    return moves.map((move) => [move]);
  }
  const byRegion = new Map<number, Enabled[]>();
  moves.forEach((move) => { append(byRegion, move.regionIndex, move); });
  // oxlint-disable-next-line unicorn/no-array-reduce -- Each participating region extends the simultaneous move combinations.
  return [...byRegion.values()].reduce<Enabled[][]>((groups, options) => extendChoices(groups, options), [[]]);
};

const drawnMoves = ({ labels, order, regions }: CheckInput): Map<string, Move> => {
  const combinations = new Map<string, string[]>();
  order.forEach((state) => {
    const parts = combo(labels, state);
    combinations.set(tupleKey(parts), parts);
  });
  const drawn = new Map<string, Move>();
  combinations.forEach((parts) => {
    enabledMoves(regions, parts).forEach((moves, text) => {
      groupMoves(moves, labels.together.has(text)).forEach((group) => {
        const next = [...parts];
        group.forEach(({ arrow, regionIndex }) => { next[regionIndex] = arrow.to; });
        addMove(drawn, { from: parts, text, to: next });
      });
    });
  });
  return drawn;
};

const MIN_PARALLEL_REGIONS = 2;

const firstExtra = (candidate: Map<string, Move>, expected: Map<string, Move>): Move | undefined => {
  // oxlint-disable-next-line rules/no-for-loops -- Stop at the first differing move without copying a potentially large graph.
  for (const [key, move] of candidate) {
    if (!expected.has(key)) {
      return move;
    }
  }
  return undefined;
};

const firstMoveMismatch = (labels: Labels, real: Map<string, Move>, drawn: Map<string, Move>): string | undefined => {
  const extra = firstExtra(drawn, real);
  if (extra) {
    return `The regions chart lets ${words(labels, extra.from)} go to ${words(labels, extra.to)} by ${extra.text}, which the model never does.`;
  }
  const missing = firstExtra(real, drawn);
  return missing
    ? `The model goes from ${words(labels, missing.from)} to ${words(labels, missing.to)} by ${missing.text}, which the regions chart cannot show.`
    : undefined;
};

export const regionsLie = (input: CheckInput): string | undefined => {
  const { labels } = input;
  if (labels.names.length < MIN_PARALLEL_REGIONS) {
    return undefined;
  }

  const falseStart = firstFalseStart(input);
  if (falseStart) {
    return `The regions chart starts at ${words(labels, falseStart)}, where the model never starts.`;
  }

  const condition = firstTupleCondition(input);
  return matchesUndefined(condition) ? firstMoveMismatch(labels, realMoves(input), drawnMoves(input)) : condition;
};
