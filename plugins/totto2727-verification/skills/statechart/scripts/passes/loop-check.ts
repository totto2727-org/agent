// oxlint-disable-next-line import/no-relative-parent-imports -- The standalone skill loads the adjacent IR module without an alias resolver.
import { append, holds, loopOf, matchesUndefined, must, tupleKey, unkey } from "#statechart/ir.ts";
// oxlint-disable-next-line import/no-relative-parent-imports -- Share the pipeline's IR types within the standalone skill.
import type { Arrow, Bug, Chart, Labels, Walk } from "#statechart/ir.ts";

interface LoopMoves {
  arrowsFrom: Map<string, Arrow[]>[];
  stepsFrom: Map<number, number[]>;
}

const indexMoves = ({ regions, loops }: Chart, { sorted }: Labels, { from }: Walk): LoopMoves => {
  const stepsFrom = new Map<number, number[]>();
  if (!loops.length) {
    return { arrowsFrom: [], stepsFrom };
  }

  sorted.forEach((step) => { append(stepsFrom, from[step], step); });
  const arrowsFrom = regions.map(({ arrows }) => {
    const bySource = new Map<string, Arrow[]>();
    arrows.forEach((arrow) => { append(bySource, arrow.from, arrow); });
    return bySource;
  });
  return { arrowsFrom, stepsFrom };
};

interface RegionLoop {
  arrows: Arrow[];
  name: string;
  otherKeys: string[];
  regionIndex: number;
}

interface LoopState {
  bug: Bug;
  combinations: Map<string, number[]>;
  parts: string[];
}

const checkRegion = (
  { labels, moves, to }: { labels: Labels; moves: LoopMoves; to: Walk["to"] },
  { bug, combinations, parts }: LoopState,
  { arrows, name, otherKeys, regionIndex }: RegionLoop,
): void => {
  const twins = must(combinations, tupleKey(parts));
  const takes = (arrow: Arrow): boolean =>
    twins.some((state) => (moves.stepsFrom.get(state) ?? []).some((step) =>
      labels.drawnLabels[step] === arrow.label && labels.keys[regionIndex][to[step]] === arrow.to
    ));

  const impossible = arrows.find((arrow) => {
    if (!holds(arrow.condition, otherKeys)) {
      return false;
    }
    const next = parts.map((part, position) => position === regionIndex ? arrow.to : part);
    return !combinations.has(tupleKey(next)) && !takes(arrow);
  });
  if (matchesUndefined(impossible)) {
    return;
  }

  // oxlint-disable-next-line rules/require-tagged-error -- This standalone plugin exposes the existing synchronous validation error.
  throw new Error(
    `The chart draws the step ${impossible.label} out of ${name ? `${name} ` : ""}${unkey(impossible.from).join(" / ")}, but the ${bug.rule.name} loop cannot take it there. Show in a label what stops it.`,
  );
};

export const loopCheck = (
  chart: Chart,
  labels: Labels,
  { found, walk }: { found: Bug[]; walk: Walk },
): void => {
  const moves = indexMoves(chart, labels, walk);
  found.filter((bug) => !matchesUndefined(bug.loop)).forEach((bug) => {
    const combinations = new Map<string, number[]>();
    const partsList = Array.from(loopOf(bug, walk.index), (state) => {
      const parts = labels.names.map((_name, index) => labels.keys[index][state]);
      append(combinations, tupleKey(parts), state);
      return parts;
    });
    partsList.forEach((parts) => {
      labels.names.forEach((name, regionIndex) => {
        const arrows = moves.arrowsFrom[regionIndex].get(parts[regionIndex]) ?? [];
        const otherKeys = parts.filter((_part, index) => index !== regionIndex);
        checkRegion({ labels, moves, to: walk.to }, { bug, combinations, parts }, { arrows, name, otherKeys, regionIndex });
      });
    });
  });
};
