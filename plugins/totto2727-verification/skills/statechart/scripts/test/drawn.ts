import { matchesUndefined, visitItems } from "#statechart/ir.ts";

const LAST_BLOCK = -1;
const START = "[*]";
const STATE_LABEL = /^ *(?:state "(?<groupLabel>.*)" as (?<groupId>s\d+) \{|(?<stateId>s\d+): (?<stateLabel>.*))$/gmu;
const OPEN_BLOCK = /^ *state ".*" as (?<block>\w+) \{$/u;
const CLOSE_BLOCK = /^ *\}$/u;
const ARROW = /^ *(?<from>s\d+|\[\*\]) --> (?<to>s\d+)(?:: (?<label>.*))?$/u;

const shown = (text: string): string =>
  text.replaceAll(/#(?<point>\d+);/gu, (_match, point: unknown) => String.fromCodePoint(Number(point)));

const namesIn = (chart: string): Map<string, string> => {
  const names = new Map<string, string>();
  visitItems(chart.matchAll(STATE_LABEL), ({ groups }) => {
    const id = groups?.groupId ?? groups?.stateId;
    const label = groups?.groupLabel ?? groups?.stateLabel;
    if (!matchesUndefined(id) && !matchesUndefined(label)) {names.set(id, shown(label));}
  });
  return names;
};

const arrowIn = (line: string, names: ReadonlyMap<string, string>, blocks: Readonly<string[]>): string | undefined => {
  const match = ARROW.exec(line)?.groups;
  if (matchesUndefined(match)) {return undefined;}
  const parent = names.get(blocks.at(LAST_BLOCK) ?? "");
  if (match.from === START && matchesUndefined(parent)) {return undefined;}
  const from = match.from === START ? `${parent} start` : names.get(match.from);
  const suffix = matchesUndefined(match.label) ? "" : `: ${shown(match.label)}`;
  return `${from} --> ${names.get(match.to)}${suffix}`;
};

export const drawn = (chart: string): { arrows: string[]; states: string[] } => {
  const names = namesIn(chart);
  const arrows: string[] = [];
  const blocks: string[] = [];
  visitItems(chart.split("\n"), (line) => {
    const block = OPEN_BLOCK.exec(line)?.groups?.block;
    if (!matchesUndefined(block)) {blocks.push(block);}
    if (CLOSE_BLOCK.test(line)) {blocks.pop();}
    const arrow = arrowIn(line, names, blocks);
    if (!matchesUndefined(arrow)) {arrows.push(arrow);}
  });
  return { arrows, states: [...names.values()] };
};
