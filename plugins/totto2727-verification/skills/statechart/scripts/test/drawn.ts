const shown = (text: string) => text.replace(/#(\d+);/gu, (_, n) => String.fromCodePoint(Number(n)));

export const drawn = (chart: string) => {
  const names = new Map<string, string>();
  Iterator.from(chart.matchAll(/^ *(?:state "(.*)" as (s\d+) \{|(s\d+): (.*))$/gm)).forEach((m) => {names.set(m[2] ?? m[3], shown(m[1] ?? m[4]));});
  const arrows: string[] = [];
  const blocks: string[] = [];
  for (const line of chart.split("\n")) {
    const block = line.match(/^ *state ".*" as (\w+) \{$/);
    if (block) {blocks.push(block[1]);}
    if (/^ *\}$/u.test(line)) {blocks.pop();}
    const regexMatch = line.match(/^ *(s\d+|\[\*\]) --> (s\d+)(?:: (.*))?$/);
    const parent = names.get(blocks.at(-1) ?? "");
    if (!regexMatch || (regexMatch[1] === "[*]" && parent === undefined)) {continue;}
    const from = regexMatch[1] === "[*]" ? `${parent} start` : names.get(regexMatch[1]);
    arrows.push(`${from} --> ${names.get(regexMatch[2])}${regexMatch[3] === undefined ? "" : `: ${shown(regexMatch[3])}`}`);
  }
  return { states: [...names.values()], arrows };
};
