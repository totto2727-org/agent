import { matchesUndefined, visitItems } from "#statechart/ir.ts";

const SAMPLES = 64;
const ENDPOINTS = 1;
const ORIGIN = 0;
const TWO_AXES = 2;
const CUBIC_ORDER = 3;
const FIRST_CONTROL_X = 0;
const FIRST_CONTROL_Y = 1;
const SECOND_CONTROL_X = 2;
const SECOND_CONTROL_Y = 3;

type Point = [horizontal: number, vertical: number];
interface Bar { bottom: number; id: string; left: number; right: number; top: number }

const PATH_COMMAND = /(?<command>[MLC])(?<positions>[^MLC]*)/gu;
const TITLE_BAR = /<g class="pele-cluster [^"]*" data-id="(?<id>[^"]*)"><rect x="(?<left>[\d.]+)" y="(?<top>[\d.]+)" width="(?<width>[\d.]+)"[^>]*\/><path d="M[\d.]+,(?<bottom>[\d.]+)H/gu;
const TRANSITION = /<g class="pele-edge pele-transition" data-id="(?<id>[^"]*)"><path d="(?<path>[^"]*)"/gu;

const cubic = ([start, first, second, end]: number[], fraction: number): number => {
  const remaining = ENDPOINTS - fraction;
  return remaining ** CUBIC_ORDER * start + CUBIC_ORDER * remaining * remaining * fraction * first
    + CUBIC_ORDER * remaining * fraction * fraction * second + fraction ** CUBIC_ORDER * end;
};

const segment = (
  start: Point, end: Point, { command, values }: { command: string; values: number[] },
): Point[] => Array.from({ length: SAMPLES + ENDPOINTS }, (_unused, sample) => {
  const fraction = sample / SAMPLES;
  const [left, top] = start;
  const [right, bottom] = end;
  return command === "L"
    ? [left + (right - left) * fraction, top + (bottom - top) * fraction]
    : [
        cubic([left, values[FIRST_CONTROL_X], values[SECOND_CONTROL_X], right], fraction),
        cubic([top, values[FIRST_CONTROL_Y], values[SECOND_CONTROL_Y], bottom], fraction),
      ];
});

export const pathPoints = (commands: string): Point[] => {
  const points: Point[] = [];
  const cursor: { point: Point } = { point: [ORIGIN, ORIGIN] };
  visitItems(commands.matchAll(PATH_COMMAND), ({ groups }) => {
    if (matchesUndefined(groups)) {return;}
    const { command, positions } = groups;
    const values = positions.split(/[ ,]/u).filter(Boolean).map(Number);
    const [horizontal, vertical] = values.slice(-TWO_AXES);
    const next: Point = [horizontal, vertical];
    if (command !== "M") {points.push(...segment(cursor.point, next, { command, values }));}
    cursor.point = next;
  });
  return points;
};

export const titleBars = (svg: string): Bar[] => {
  const bars: Bar[] = [];
  visitItems(svg.matchAll(TITLE_BAR), ({ groups }) => {
    if (matchesUndefined(groups)) {return;}
    const left = Number(groups.left);
    bars.push({ bottom: Number(groups.bottom), id: groups.id, left, right: left + Number(groups.width), top: Number(groups.top) });
  });
  return bars;
};

export const crossedTitleBars = (svg: string, bars: Bar[]): string[] => {
  const crossings: string[] = [];
  visitItems(svg.matchAll(TRANSITION), ({ groups }) => {
    if (matchesUndefined(groups)) {return;}
    const points = pathPoints(groups.path);
    visitItems(bars, (bar) => {
      if (points.some(([horizontal, vertical]) =>
        horizontal > bar.left && horizontal < bar.right && vertical > bar.top && vertical < bar.bottom)) {
        crossings.push(`${groups.id} crosses the title bar of ${bar.id}`);
      }
    });
  });
  return crossings;
};
