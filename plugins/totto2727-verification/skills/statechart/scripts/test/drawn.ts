import { matchesUndefined, visitItems } from "#statechart/ir.ts";

const shown = (text: string): string => text.replaceAll(/#(\d+);/gu, (_, n) => String.fromCodePoint(Number(n)));

export const drawn = (chart: string) => {
  const names = new Map<string, string>();
  visitItems(chart.matchAll(/^ *(?:state "(.*)" as (s\d+) \{|(s\d+): (.*))$/gm), (currentRegexMatch) => {names.set(currentRegexMatch[2] ?? currentRegexMatch[3], shown(currentRegexMatch[1] ?? currentRegexMatch[4]));});
  const arrows: string[] = [];
  const blocks: string[] = [];
  visitItems(chart.split("\n"), (line) => {
    const block = /^ *state ".*" as (\w+) \{$/.exec(line);
    if (block) {blocks.push(block[1]);}
    if (/^ *\}$/u.test(line)) {blocks.pop();}
    const regexMatch = /^ *(s\d+|\[\*\]) --> (s\d+)(?:: (.*))?$/.exec(line);
    const parent = names.get(blocks.at(-1) ?? "");
    if (!regexMatch || (regexMatch[1] === "[*]" && matchesUndefined(parent))) {return;}
    const from = regexMatch[1] === "[*]" ? `${parent} start` : names.get(regexMatch[1]);
    arrows.push(`${from} --> ${names.get(regexMatch[2])}${matchesUndefined(regexMatch[3]) ? "" : `: ${shown(regexMatch[3])}`}`);
  });
  return { states: [...names.values()], arrows };
};
