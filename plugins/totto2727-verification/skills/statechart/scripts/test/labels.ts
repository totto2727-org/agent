// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { drawnEdges, mermaid as chartText } from "#statechart/backends/mermaid.ts";
import { checkView } from "#statechart/frontends/view.ts";
import type { Chart, ChartState, State, Step, View } from "#statechart/ir.ts";
import { walk } from "#statechart/passes/reach.ts";
import { project } from "#statechart/pipeline.ts";
import { count as indices, isString, matchesUndefined, visitItems } from "#statechart/ir.ts";

export type Render = (text: string) => { svg: string };

interface MermaidNode {
  id: string;
  label?: string;
  shape?: string;
  parentId?: string;
  isGroup?: boolean;
  dir?: string;
}

export type Mermaid = {
  parse: (text: string) => Promise<unknown>;
  mermaidAPI: {
    getDiagramFromText: (text: string) => Promise<{
      db: {
        getData: () => {
          nodes: MermaidNode[];
          edges: { start: string; end: string; label?: string }[];
          direction?: string;
        };
      };
    }>;
  };
};

export type Html = (markup: string) => string;

interface Tools { render: Render; mermaid: Mermaid; html: Html }

const THEME = ["blue", "orange", "purple", "yellow", "teal", "tan", "pink"];
const WORDS = ["Idle", "Run", "a", "b", "x1", "ok", "Done", "waiting", "on", "off", "p q"];
const SYNTAX = [
  "-->",
  "[*]",
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  ":",
  ";",
  "#",
  "%%",
  '"',
  "'",
  "`",
  "|",
  "\\",
  ":::",
  "::: x",
  "--",
  "---",
  "<<fork>>",
  "<<join>>",
  "<<choice>>",
  "[[fork]]",
  "[[join]]",
  "[[choice]]",
  "<br>",
  "<b>x</b>",
  "<a",
  "<a=",
  "=",
  "&amp;",
  "&lt;",
  "&#59;",
  "&quot;",
  "#quot;",
  "#59;",
  "#35;",
  "**",
  "__",
  "*",
  "_",
  "~~",
  "$$",
  "${x}",
  "state",
  "as",
  "note",
  "end",
  "class",
  "classDef",
  "style",
  "click",
  "direction LR",
  "direction TB",
  "Direction rl",
  "direction\tBT",
  "direction  LR",
  "accTitle: x",
  "accDescr: y",
  "title: t",
  "%%{",
  "}%%",
  "%%{init: {}}%%",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
  "&nbsp;",
  String.raw`\n`,
  "---\n",
  "`**b**`",
  "ﬂ°°65¶ß",
  "ﬂ°lt¶ß",
  'marker-end="url(a#',
  "<<",
  ">>",
  "<<a>>",
  "|->",
  ":>",
  "@@",
  "/\\",
  String.raw`\/`,
  "..",
  '"A"',
  'x="a"',
  "[a |-> 1]",
  "{1, 2}",
  String.raw`"\n"`,
  "&",
  "<",
  ">",
  "@",
  "~",
  "^",
  "$",
  "%",
];
const SPACE = [
  " ",
  "  ",
  "\t",
  "\n",
  "\r",
  "\r\n",
  "\v",
  "\f",
  "\u00A0",
  "\u2028",
  "\u2029",
  "\u0085",
  "\u200B",
  "\uFEFF",
  "\u3000",
];
const OTHER = [
  "é",
  "ü",
  "中文",
  "😀",
  "👩‍💻",
  "e\u0301",
  "\u202E",
  "\u200F",
  "ß",
  "Ω",
  "\uD800",
  "\x7F",
  "\u0080",
  "\x9F",
  "\x1B",
  "\u0000",
];
const COUNTER_STEP = 1;
const NON_STRING_COLOR = 7;
const BAD_COLORS: unknown[] = [
  "pink\n  s99: Ghost state",
  "blue\r\nclassDef x fill:#f00",
  "teal\r",
  " pink",
  "Pink",
  "red",
  "#00f",
  "breaks",
  "mayBreak",
  "bugPath",
  "repeats",
  "toString",
  "",
  null,
  NON_STRING_COLOR,
  ["blue"],
];

// Mulberry32 mixes a 32-bit state. Keep the step and shifts stable for replayable failures.
const UINT32_SHIFT = 0;
const UINT32_RANGE = 4_294_967_296;
const STATE_INCREMENT = 0x6D_2B_79_F5;
const FIRST_MIX_SHIFT = 15;
const FIRST_MIX_MASK = 1;
const SECOND_MIX_SHIFT = 7;
const SECOND_MIX_MASK = 61;
const FINAL_MIX_SHIFT = 14;
const INCLUSIVE_RANGE = 1;

const random = (seed: number) => {
  // oxlint-disable-next-line rules/no-let -- Each call advances the seeded generator before returning a sample.
  let state = seed >>> UINT32_SHIFT;
  const next = (): number => {
    state = (state + STATE_INCREMENT) >>> UINT32_SHIFT;
    const firstMix = Math.imul(state ^ (state >>> FIRST_MIX_SHIFT), state | FIRST_MIX_MASK);
    const secondMix = firstMix ^ (firstMix + Math.imul(firstMix ^ (firstMix >>> SECOND_MIX_SHIFT), firstMix | SECOND_MIX_MASK));
    return ((secondMix ^ (secondMix >>> FINAL_MIX_SHIFT)) >>> UINT32_SHIFT) / UINT32_RANGE;
  };
  const int = (upperBound: number): number => Math.floor(next() * upperBound);
  return {
    chance: (probability: number) => next() < probability,
    int,
    pick: <Item>(items: ReadonlyArray<Item>) => items[int(items.length)],
    range: (lower: number, upper: number) => lower + int(upper - lower + INCLUSIVE_RANGE),
  };
};

type Random = ReturnType<typeof random>;

const FRAGMENTS_MIN = 1;
const FRAGMENTS_MAX = 4;
const LABEL_CHOICES = 13;
const WORD_BOUND = 4;
const SYNTAX_BOUND = 7;
const SPACE_BOUND = 9;
const OTHER_BOUND = 11;
const FIRST_PRINTABLE_ASCII = 32;
const PRINTABLE_ASCII_COUNT = 95;

const labelFragment = (randomizer: Random): string | undefined => {
  const choice = randomizer.int(LABEL_CHOICES);
  if (choice < WORD_BOUND) {return randomizer.pick(WORDS);}
  if (choice < SYNTAX_BOUND) {return randomizer.pick(SYNTAX);}
  if (choice < SPACE_BOUND) {return randomizer.pick(SPACE);}
  if (choice < OTHER_BOUND) {return randomizer.pick(OTHER);}
  return String.fromCharCode(FIRST_PRINTABLE_ASCII + randomizer.int(PRINTABLE_ASCII_COUNT));
};

const several = <Item>(count: number, make: () => Item): Item[] =>
  Array.from({ length: count }, () => make());

const label = (randomizer: Random): string => {
  const count = randomizer.range(FRAGMENTS_MIN, FRAGMENTS_MAX);
  return several(count, () => String(labelFragment(randomizer))).join("");
};

const THEME_CHANCE = 0.85;
const OTHER_COLOR_CHOICES = 3;
const INVALID_COLOR_CHOICE = 0;
const COMPOSITE_COLOR_CHOICE = 1;

const color = (randomizer: Random): unknown => {
  if (randomizer.chance(THEME_CHANCE)) {return randomizer.pick(THEME);}
  const choice = randomizer.int(OTHER_COLOR_CHOICES);
  if (choice === INVALID_COLOR_CHOICE) {return randomizer.pick(BAD_COLORS);}
  if (choice === COMPOSITE_COLOR_CHOICE) {return randomizer.pick(THEME) + randomizer.pick(SPACE) + label(randomizer);}
  return label(randomizer);
};

type Shape =
  | { mode: "flat"; leaf: number[] }
  | { mode: "parents"; leaf: number[]; parents: number[]; parentOf: number[] }
  | { mode: "regions"; regions: number[]; pools: number[][]; values: number[][] };

type Groups =
  | { groups?: undefined; colors?: undefined; groupOf?: undefined }
  | { groups: number[]; colors: unknown[]; groupOf: number[] };

type Case = Shape &
  Groups & { stateCount: number; labels: string[]; actions: number[]; steps: number[][]; title?: number };

const SHAPE_CHOICES = 10;
const FLAT_SHAPE_BOUND = 4;
const PARENT_SHAPE_BOUND = 7;
const MIN_STATES = 2;
const MAX_STATES = 4;
const REGION_POOL_SIZE = 2;
const TWO_PARENTS_CHANCE = 0.5;
const HAS_PARENT_CHANCE = 0.75;
const NO_PARENT = -1;
const MIN_ACTIONS = 1;
const MAX_ACTIONS = 3;
const MIN_STEPS = 1;
const MAX_STEPS = 5;
const HAS_GROUPS_CHANCE = 0.4;
const MIN_GROUPS = 1;
const MAX_GROUPS = 2;
const MEMBER_OF_GROUP_CHANCE = 0.8;
const NO_GROUP = -1;
const HAS_TITLE_CHANCE = 0.3;
const PUSHED_LABEL_POSITION = 1;

const generate = function (randomizer: Random): Case {
  const labels: string[] = [];
  const slot = (): number => labels.push(label(randomizer)) - PUSHED_LABEL_POSITION;
  const choice = randomizer.int(SHAPE_CHOICES);
  const mode = choice < FLAT_SHAPE_BOUND ? "flat" : (choice < PARENT_SHAPE_BOUND ? "parents" : "regions");
  const stateCount = randomizer.range(MIN_STATES, MAX_STATES);
  let shape: Shape;
  if (mode === "regions") {
    shape = {
      mode,
      regions: [slot(), slot()],
      pools: [
        [slot(), slot()],
        [slot(), slot()],
      ],
      values: several(stateCount, () => [randomizer.int(REGION_POOL_SIZE), randomizer.int(REGION_POOL_SIZE)]),
    };
  } else {
    const leaf = several(stateCount, slot);
    if (mode === "parents") {
      const parents = randomizer.chance(TWO_PARENTS_CHANCE) ? [slot(), slot()] : [slot()];
      const parentOf = several(stateCount, () => (randomizer.chance(HAS_PARENT_CHANCE) ? randomizer.int(parents.length) : NO_PARENT));
      shape = { mode, leaf, parents, parentOf };
    } else {shape = { mode, leaf };}
  }
  const actions = several(randomizer.range(MIN_ACTIONS, MAX_ACTIONS), slot);
  const steps = several(randomizer.range(MIN_STEPS, MAX_STEPS), () => [randomizer.int(stateCount), randomizer.int(stateCount), randomizer.int(actions.length)]);
  let groups: Groups = {};
  if (randomizer.chance(HAS_GROUPS_CHANCE)) {
    const named = several(randomizer.range(MIN_GROUPS, MAX_GROUPS), slot);
    const colors = several(named.length, () => color(randomizer));
    const groupOf = several(stateCount, () => (randomizer.chance(MEMBER_OF_GROUP_CHANCE) ? randomizer.int(named.length) : NO_GROUP));
    groups = { groups: named, colors, groupOf };
  }
  const title = randomizer.chance(HAS_TITLE_CHANCE) ? slot() : undefined;
  return { ...shape, ...groups, stateCount, labels, actions, steps, title };
};

type RawView = {
  state: (vars: { k: number }) => unknown;
  step: (action: string) => string;
  group?: (vars: { k: number }) => string | undefined;
  colors?: Record<string, unknown>;
  title?: string;
};

const START_STATE_INDEX = 0;
const ACTION_PREFIX = "A";

const build = function (chartCase: Case, labels: string[]) {
  const states = new Map<string, State>();
  visitItems(indices(chartCase.stateCount), (stateIndex) => {
    states.set(String(stateIndex), { vars: { k: stateIndex }, start: stateIndex === START_STATE_INDEX, breaks: [] });
  });
  const steps: Step[] = [];
  visitItems(chartCase.steps, ([from, to, action]) => {
    steps.push({ from: String(from), to: String(to), action: `${ACTION_PREFIX}${action}` });
  });
  const view: RawView = {
    state: ({ k: stateIndex }) => {
      if (chartCase.mode === "regions") {
        const shape = chartCase.regions.map((region, regionIndex): [string, string] => [
          labels[region],
          labels[chartCase.pools[regionIndex][chartCase.values[stateIndex][regionIndex]]],
        ]);
        return Object.fromEntries(shape);
      }
      const leaf = labels[chartCase.leaf[stateIndex]];
      return chartCase.mode === "parents" && chartCase.parentOf[stateIndex] >= 0
        ? [labels[chartCase.parents[chartCase.parentOf[stateIndex]]], leaf]
        : leaf;
    },
    step: (action) => labels[chartCase.actions[Number(action.slice(ACTION_PREFIX.length))]],
  };
  if (chartCase.groups) {
    const { groups, colors, groupOf } = chartCase;
    view.group = ({ k: stateIndex }) => (groupOf[stateIndex] < 0 ? undefined : labels[groups[groupOf[stateIndex]]]);
    view.colors = Object.fromEntries(groups.map((group, groupIndex) => [labels[group], colors[groupIndex]]));
  }
  if (!matchesUndefined(chartCase.title)) {view.title = labels[chartCase.title];}
  return { graph: { states, steps }, view };
};

const visible = (s: string): string =>
  s
    .toWellFormed()
    .replaceAll(/(?![\t-\r\u0085])[\p{Cc}\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu, "")
    .replaceAll(/\p{White_Space}+/gu, " ")
    .trim();
const wrapped = (s: string): string => visible(s).replaceAll(" ", "");
const titled = (want: Want): boolean => /[^\u0000\u0080-\u0084\u0086-\u009F]/u.test(want.title ?? "");
const NAMED: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00A0",
  quot: '"',
};
const WINDOWS_1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const NUL = 0;
const MAX_CODE_POINT = 0x10_FF_FF;
const FIRST_SURROGATE = 0xD8_00;
const LAST_SURROGATE = 0xDF_FF;
const FIRST_C1_CONTROL = 0x80;
const LAST_C1_CONTROL = 0x9F;
const HEX_RADIX = 16;

const fromRef = (codePoint: number): string => {
  if (codePoint === NUL || codePoint > MAX_CODE_POINT || (codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE)) {return "\uFFFD";}
  if (codePoint >= FIRST_C1_CONTROL && codePoint <= LAST_C1_CONTROL) {return WINDOWS_1252[codePoint - FIRST_C1_CONTROL];}
  return String.fromCodePoint(codePoint);
};
const fromMermaid = (text: string): string =>
  text.replaceAll(/ﬂ°°(?<decimal>\d+)¶ß|ﬂ°(?<named>\w+)¶ß/gu, (_match: string, decimal?: string, named?: string) => {
    const reference = named ?? "";
    return decimal ? fromRef(Number(decimal)) : (NAMED[reference] ?? `&${reference};`);
  });
const decoded = (s: string): string =>
  s
    .replaceAll('ﬂ°°', "&#")
    .replaceAll('ﬂ°', "&")
    .replaceAll('¶ß', ";");
const MARKER_END = /marker-end="url\([\d+./:=?A-Za-z-]*?#/gu;
const rewritten = (s: string): boolean =>
  /ﬂ°|¶ß/u.test(s) || s.replaceAll(MARKER_END, 'marker-end="url(#') !== s;
const fromSvg = (text: string): string =>
  text
    .replaceAll(/<\/tspan>\s*<tspan[^>]*>/gu, " ")
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/&#x(?<hex>[0-9a-f]+);/giu, (_match: string, hex: string) => fromRef(Number.parseInt(hex, HEX_RADIX)))
    .replaceAll(/&#(?<decimal>\d+);/gu, (_match: string, decimal: string) => fromRef(Number(decimal)))
    .replaceAll(/&(?<named>quot|lt|gt|apos|nbsp);/gu, (_match: string, named: string) => NAMED[named])
    .replaceAll('&amp;', "&");

interface Node { text: string; parent: string | null; group: boolean }

interface Want {
  nodes: Map<string, Node>;
  edges: string[][];
  direction: string;
  title: string | undefined;
}

const expected = function (chart: Chart): Want {
  const nodes = new Map<string, Node>();
  const edges: string[][] = [];
  const ids = new Map<string, string>();
  const id = (region: string, path: string[]): string => {
    const key = JSON.stringify([region, path]);
    const found = ids.get(key) ?? `s${ids.size}`;
    ids.set(key, found);
    return found;
  };
  const multi = chart.regions.length > 1;
  const used = new Set<string>();
  if (multi) {nodes.set("all", { text: "At the same time", parent: null, group: true });}
  visitItems(chart.regions.entries(), ([regionIndex, region]) => {
    const wrap = multi ? `r${regionIndex}` : null;
    if (wrap) {nodes.set(wrap, { text: region.name, parent: "all", group: true });}
    const drawn = drawnEdges(region);
    const tree = (prefix: string[], parent: string | null, below: ChartState[]): void => {
      const heads = new Map<string, ChartState[]>();
      visitItems(below, (currentState) => {
        const head = currentState.path[prefix.length];
        heads.set(head, [...(heads.get(head) ?? []), currentState]);
      });
      visitItems(heads, ([head, under]) => {
        const path = [...prefix, head];
        const inner: ChartState[] = [];
        let leaf: ChartState | undefined;
        visitItems(under, (currentState) => {if (currentState.path.length > path.length) {inner.push(currentState);}
          else {leaf = currentState;}});
        const node = id(region.name, path);
        nodes.set(node, { text: head, parent, group: inner.length > 0 });
        if (inner.length) {
          tree(path, node, inner);
          const key = JSON.stringify(path);
          visitItems(drawn, (currentEdge) => {if (currentEdge.start && JSON.stringify(currentEdge.from) === key)
              {edges.push([`${node}_start`, id(region.name, currentEdge.to), currentEdge.label ?? ""]);}});
        } else {
          const group = leaf?.group;
          if (!matchesUndefined(group)) {used.add(chart.colors[String(group)]);}
        }
      });
    };
    tree([], wrap, region.states);
    visitItems(drawn, (currentEdge) => {if (!currentEdge.start || !currentEdge.from.length)
        {edges.push([
          currentEdge.start ? `${wrap ?? "root"}_start` : id(region.name, currentEdge.from),
          id(region.name, currentEdge.to),
          currentEdge.label ?? "",
        ]);}});
  });
  const legend = Object.entries(chart.colors).filter(([, colorClass]) => used.has(colorClass));
  visitItems(legend.entries(), ([legendIndex, [text]]) => {
    nodes.set(`lg${legendIndex}`, { text, parent: "legend", group: false });
  });
  const [firstLegendEntry] = legend;
  if (!matchesUndefined(firstLegendEntry)) {nodes.set("legend", { text: "Legend", parent: null, group: true });}
  return { nodes, edges, direction: multi ? "LR" : "TB", title: chart.title };
};

const edgeKeys = (edges: string[][], withLabels: boolean): string => {
  const keys: string[] = [];
  visitItems(edges, ([from, to, text]) => {keys.push(withLabels ? `${from} ${to} ${visible(text)}` : `${from} ${to}`);});
  return keys.sort().join("\n");
};

const readMermaid = async function (text: string, want: Want, { mermaid, html }: Tools, problems: string[]): Promise<void> {
  let data;
  try {
    data = (await mermaid.mermaidAPI.getDiagramFromText(text)).db.getData();
  } catch (error) {
    if (!(error instanceof Error)) {throw error;}
    problems.push(`mermaid-refuses: ${error.message.split("\n")[0]}`);
    return;
  }
  const byId = new Map<string | undefined, MermaidNode>();
  visitItems(data.nodes, (currentNode) => {byId.set(currentNode.id, currentNode);});
  let count = 0;
  visitItems(data.nodes, (currentNode) => {
    if (currentNode.shape === "divider" || currentNode.shape === "stateStart" || currentNode.shape === "stateEnd") {return;}
    count += COUNTER_STEP;
    let parent = byId.get(currentNode.parentId);
    while (parent?.shape === "divider") {parent = byId.get(parent.parentId);}
    const expectedNode = want.nodes.get(currentNode.id);
    const shown = fromMermaid(currentNode.label ?? "");
    if (!expectedNode || (parent?.id ?? null) !== expectedNode.parent || Boolean(currentNode.isGroup) !== expectedNode.group)
      {problems.push(`mermaid-nodes: Mermaid draws ${currentNode.id} where the chart has no such node`);}
    else if (rewritten(shown))
      {problems.push(
        `mermaid-text: Mermaid's SVG cleanup rewrites ${currentNode.id}'s ${JSON.stringify(shown)}`,
      );}
    else if (visible(html(decoded(currentNode.label ?? ""))) !== visible(expectedNode.text))
      {problems.push(
        `mermaid-text: ${currentNode.id} shows ${JSON.stringify(html(decoded(currentNode.label ?? "")))} for ${JSON.stringify(expectedNode.text)}`,
      );}
    if (currentNode.isGroup && currentNode.dir && currentNode.dir !== "TB")
      {problems.push(`mermaid-direction: ${currentNode.id} runs ${currentNode.dir}`);}
  });
  if (count !== want.nodes.size)
    {problems.push(`mermaid-nodes: ${count} nodes for ${want.nodes.size}`);}
  if ((data.direction ?? "TB") !== want.direction)
    {problems.push(`mermaid-direction: the chart runs ${data.direction}`);}
  const head = /^---\ntitle: (.*)\n---\n/.exec(text);
  const raw = head ? String(JSON.parse(head[1])) : undefined;
  const title = matchesUndefined(raw) ? undefined : fromMermaid(raw);
  if ((!matchesUndefined(title)) !== titled(want))
    {problems.push(`mermaid-title: Mermaid draws a title for ${JSON.stringify(want.title)}`);}
  else if (raw?.includes("<"))
    {problems.push(
      `mermaid-title: Mermaid's sanitizer reads the < in ${JSON.stringify(raw)} as a tag`,
    );}
  else if (title?.includes("\0"))
    {problems.push(`mermaid-title: a browser draws the NUL in ${JSON.stringify(title)} as U+FFFD`);}
  else if (!matchesUndefined(title) && visible(title) !== visible(want.title ?? ""))
    {problems.push(
      `mermaid-text: the title shows ${JSON.stringify(title)} for ${JSON.stringify(want.title)}`,
    );}
  const got: string[][] = [];
  const shown: string[][] = [];
  visitItems(data.edges, (edge) => {
    got.push([edge.start, edge.end, fromMermaid(edge.label ?? "")]);
    shown.push([edge.start, edge.end, html(decoded(edge.label ?? ""))]);
  });
  if (edgeKeys(got, false) !== edgeKeys(want.edges, false))
    {problems.push("mermaid-edges: the arrows join other states");}
  else if (edgeKeys(shown, true) !== edgeKeys(want.edges, true))
    {problems.push("mermaid-text: an arrow shows other text");}
  visitItems(got, ([from, to, text]) => {if (rewritten(text))
      {problems.push(
        `mermaid-text: Mermaid's SVG cleanup rewrites the arrow from ${from} to ${to}'s ${JSON.stringify(text)}`,
      );}});
};

const readPele = function (text: string, want: Want, render: Render, problems: string[]): void {
  let svg: string;
  try {
    ({ svg } = render(text));
  } catch (error) {
    if (!(error instanceof Error)) {throw error;}
    problems.push(`pele-refuses: ${error.message.split("\n")[0]}`);
    return;
  }
  const drawn = new Map<string, string>();
  visitItems(svg.matchAll(
    /<g class="pele-(?:node|cluster) ([^"]*)" data-id="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g,
  ), (currentRegexMatch) => {
    if (/state-(?:start|end)/u.test(currentRegexMatch[1])) {return;}
    const regexMatch = /<text[^>]*>([\s\S]*?)<\/text>/.exec(currentRegexMatch[3]);
    drawn.set(currentRegexMatch[2], regexMatch ? fromSvg(regexMatch[1]) : "");
  });
  if (drawn.size !== want.nodes.size)
    {problems.push(`pele-nodes: ${drawn.size} nodes for ${want.nodes.size}`);}
  visitItems(want.nodes, ([node, w]) => {
    const shown = drawn.get(node);
    if (matchesUndefined(shown)) {problems.push(`pele-nodes: Pele draws no ${node}`);}
    else if (wrapped(shown) !== wrapped(w.text))
      {problems.push(
        `pele-text: ${node} shows ${JSON.stringify(shown)} for ${JSON.stringify(w.text)}`,
      );}
  });
  let arrows = 0;
  visitItems(svg.matchAll(/<g class="pele-edge pele-transition"/gu), (currentRegexMatch) => {arrows += COUNTER_STEP;});
  if (arrows !== want.edges.length)
    {problems.push(`pele-edges: ${arrows} arrows for ${want.edges.length}`);}
  visitItems(svg.matchAll(
    /<g class="pele-edge-label" data-id="edge(\d+)"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/g,
  ), (currentRegexMatch) => {
    const w = want.edges[Number(currentRegexMatch[1])];
    if (!w) {problems.push(`pele-edges: Pele labels edge${currentRegexMatch[1]}, which the chart does not have`);}
    else if (wrapped(fromSvg(currentRegexMatch[2])) !== wrapped(w[2]))
      {problems.push(
        `pele-text: edge${currentRegexMatch[1]} shows ${JSON.stringify(fromSvg(currentRegexMatch[2]))} for ${JSON.stringify(w[2])}`,
      );}
  });
  const title = /<text class="pele-title"[^>]*>([\s\S]*?)<\/text>/.exec(svg);
  if (Boolean(title) !== titled(want))
    {problems.push(`pele-title: Pele draws a title for ${JSON.stringify(want.title)}`);}
  else if (title && wrapped(fromSvg(title[1])) !== wrapped(want.title ?? ""))
    {problems.push(
      `pele-text: the title shows ${JSON.stringify(fromSvg(title[1]))} for ${JSON.stringify(want.title)}`,
    );}
};

interface Checked { refused?: true; text?: string; problems: string[] }

const check = async function (c: Case, labels: string[], tools: Tools): Promise<Checked> {
  const { graph, view } = build(c, labels);
  let refuse = false;
  Object.entries(view.colors ?? {}).forEach(([, value]) => {if (!isString(value) || !THEME.includes(value)) {refuse = true;}});
  let checked: View;
  try {
    checked = checkView(view, inspect);
  } catch (error) {
    if (!(error instanceof Error)) {throw error;}
    if (refuse && error.message.startsWith('The view\'s colors give '))
      {return { refused: true, problems: [] };}
    return { problems: [`skill-throws: ${error.message}`] };
  }
  if (refuse) {return { problems: ["colors: checkView accepts a color that is not in the theme"] };}
  let chart: Chart;
  let text: string;
  try {
    ({ chart } = project(graph, walk(graph), { found: [], view: checked }));
    text = chartText(chart);
  } catch (error) {
    if (!(error instanceof Error)) {throw error;}
    if (/^The view's (?:state|step)\(\) returned /u.test(error.message))
      {return { refused: true, problems: [] };}
    return { problems: [`skill-throws: ${error.constructor.name}: ${error.message}`] };
  }
  const want = expected(chart);
  const problems: string[] = [];
  await readMermaid(text, want, tools, problems);
  readPele(text, want, tools.render, problems);
  return { text, problems };
};

const kind = (problem: string): string => problem.slice(0, problem.indexOf(":"));

export const fuzz = async function fuzz({
  seed,
  charts,
  ...tools
}: { seed: number; charts: number } & Tools): Promise<{
  drawn: number;
  refused: number;
  failure?: string;
}> {
  await tools.mermaid.parse("stateDiagram-v2\n  s0: a");
  const r = random(seed);
  let drawn = 0;
  let refused = 0;
  for (let chartNumber = 1; chartNumber <= charts; chartNumber += COUNTER_STEP) {
    const c = generate(r);
    const result = await check(c, c.labels, tools);
    if (result.refused) {refused += COUNTER_STEP;}
    else {drawn += COUNTER_STEP;}
    if (!result.problems.length) {continue;}
    const first = kind(result.problems[0]);
    let {labels} = c;
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += COUNTER_STEP) {
      const plain = labels.with(labelIndex, `n${labelIndex}`);
      const again = await check(c, plain, tools);
      let same = false;
      visitItems(again.problems, (p) => {if (kind(p) === first) {same = true;}});
      if (same) {labels = plain;}
    }
    const kept = labels.filter((text, labelIndex) => text !== `n${labelIndex}`);
    const last = await check(c, labels, tools);
    const colors = c.colors ? ` and the colors ${JSON.stringify(c.colors)}` : "";
    return {
      drawn,
      refused,
      failure: [
        `Chart ${chartNumber} of seed ${seed} goes wrong with the labels ${JSON.stringify(kept)}${colors}:`,
        ...last.problems,
        "",
        last.text ?? "",
      ].join("\n"),
    };
  }
  return { drawn, refused };
};
