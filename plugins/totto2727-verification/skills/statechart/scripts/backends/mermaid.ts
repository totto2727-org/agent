import { append, byText, matchesUndefined, tupleKey } from '../ir.ts';
import type { Chart, ChartState, Region } from '../ir.ts';

const BLANK = /\p{White_Space}/u;
const SAFE = /^[\p{L}\p{N} !'()+,\-./=?[\]"_|@{}:\\^%<>]$/u;
const HAZARD =
  /:(?=:|$|\S*#)|\\(?=n)|%(?=%)|<(?=[\p{L}/!?])|_(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])_/giu;
const DIRECTION = /(direction)\s+(?=LR|RL|TB|BT)/giu;
const DOUBLE_BRACKET = /\[(?=\[)/gu;
const C4 = /C4(?=Container|Component|Dynamic|Deployment)/gu;
const UNDRAWN = /[\0\x80-\x9F]/u;
const REWRITTEN = ["ﬂ°", "¶ß"];
const MARKER = /(?<=marker-end=)"/gu;
const FIRST_CODE_UNIT = 0;
const ASCII_LIMIT = 128;
const FIRST_SURROGATE = 0xD8_00;
const LAST_SURROGATE = 0xDF_FF;
const REPLACEMENT = 0xFF_FD;
const WORD_JOINER = 0x20_60;
const NO_PREVIOUS_CHARACTER = -1;

const firstOf = new Map<number, number>(
  REWRITTEN.map((pair) => {
    const [first, second] = [...pair].map((character) => character.codePointAt(FIRST_CODE_UNIT) ?? FIRST_CODE_UNIT);
    return [second, first];
  }),
);

const KEPT = 0;
const BLANKED = 1;
const DROPPED = 2;
const CODED = 3;

const kindOf = (codePoint: number): number => {
  const character = String.fromCodePoint(codePoint);
  if (character === " ") {
    return KEPT;
  }
  if (BLANK.test(character)) {
    return BLANKED;
  }
  if (UNDRAWN.test(character)) {
    return DROPPED;
  }
  return SAFE.test(character) ? KEPT : CODED;
};

const ASCII = Uint8Array.from({ length: ASCII_LIMIT }, (_unused, codePoint) => kindOf(codePoint));
const wide = new Map<number, number>();
const kindAt = (codePoint: number): number => {
  if (codePoint < ASCII_LIMIT) {
    return ASCII[codePoint];
  }
  const cached = wide.get(codePoint);
  if (!matchesUndefined(cached)) {
    return cached;
  }
  const kind = kindOf(codePoint);
  wide.set(codePoint, kind);
  return kind;
};

const scalar = (character: string): number => {
  const codePoint = character.codePointAt(FIRST_CODE_UNIT) ?? FIRST_CODE_UNIT;
  return codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE ? REPLACEMENT : codePoint;
};

const encode = (text: string, ref: (codePoint: number) => string): string => {
  const position = {
    end: FIRST_CODE_UNIT,
    last: NO_PREVIOUS_CHARACTER,
    output: "",
    spanStart: FIRST_CODE_UNIT,
  };
  // oxlint-disable-next-line rules/no-for-loops -- Iterate Unicode characters without copying potentially long labels or losing their UTF-16 offsets.
  for (const character of text) {
    const offset = position.end;
    position.end += character.length;
    const codePoint = scalar(character);
    const kind = kindAt(codePoint);
    if (kind === DROPPED) {
      position.output += text.slice(position.spanStart, offset);
      position.spanStart = position.end;
    } else {
      const joined = firstOf.get(codePoint) === position.last;
      if (joined || kind !== KEPT) {
        position.output += text.slice(position.spanStart, offset);
        if (joined) {
          position.output += ref(WORD_JOINER);
        }
        if (kind === KEPT) {
          position.spanStart = offset;
        } else {
          position.output += kind === BLANKED ? " " : ref(codePoint);
          position.spanStart = position.end;
        }
      }
      position.last = codePoint;
    }
  }
  return position.output + text.slice(position.spanStart);
};

const code = (text: string, ref: (codePoint: number) => string): string =>
  encode(text, ref)
    .replaceAll(MARKER, `${ref(WORD_JOINER)}"`)
    .replaceAll(HAZARD, (character) => ref(scalar(character)));

const esc = (text: string, quoted = false): string => {
  const plain = code(text, (codePoint) => `#${codePoint};`);
  const out = quoted ? plain.replaceAll('"', "#34;") : plain;
  if (!out.trim()) {
    return "#32;";
  }
  const turned = out.replaceAll(DIRECTION, "$1#32;");
  const opened = turned.includes("[[") ? turned.replaceAll(DOUBLE_BRACKET, "#91;") : turned;
  return opened.includes("C4") ? opened.replaceAll(C4, "C#52;") : opened;
};

const or = (names: Iterable<string>) => [...names].sort(byText).join(" or ");

interface Edge {
  from: string[];
  label: string | undefined;
  start: boolean;
  to: string[];
}

const within = (parent: string[], path: string[]): boolean =>
  path.length >= parent.length && parent.every((segment, index) => path[index] === segment);

const wayIn = (edge: Edge): string => tupleKey([edge.start, edge.from]);

const connection = (
  from: string[],
  to: string[],
  { label, start }: { label?: string | undefined; start: boolean },
): Edge => {
  // oxlint-disable-next-line eslint/sort-keys -- Keep the renderer's established shape for returned edges.
  return { from, start, to, label };
};

const parentPaths = (states: ChartState[]): string[][] => {
  const parents = new Map<string, string[]>();
  states.forEach(({ path }) => {
    const prefixes = Array.from({ length: path.length - 1 }, (_unused, index) => path.slice(0, index + 1));
    prefixes.forEach((prefix) => { parents.set(tupleKey(prefix), prefix); });
  });
  // oxlint-disable-next-line unicorn/no-array-sort -- This fresh array can be sorted in place.
  return [...parents.values()].sort((left, right) => left.length - right.length);
};

const groupParentEntry = (edges: Edge[], parent: string[]): Edge[] => {
  const incoming = edges.filter(
    (edge) => edge.to.length > parent.length && within(parent, edge.to) && !within(parent, edge.from),
  );
  const [first] = incoming;
  if (matchesUndefined(first) || !incoming.every((edge) => wayIn(edge) === wayIn(first))) {
    return edges;
  }
  const singleEntry = incoming.length === 1;
  const remaining = edges.filter((edge) => !incoming.includes(edge));
  remaining.splice(
    edges.indexOf(first),
    0,
    connection(first.from, parent, { label: singleEntry ? first.label : undefined, start: first.start }),
    ...incoming.map((edge) =>
      connection(parent, edge.to, { label: singleEntry ? undefined : edge.label, start: true }),
    ),
  );
  return remaining;
};

export const drawnEdges = (region: Region): Edge[] => {
  const starts = region.states
    .filter((state) => state.start)
    .map((state) => connection([], state.path, { start: true }));
  const transitions = region.steps.map((step) =>
    connection(step.from, step.to, {
      label: step.label + (step.when ? ` [${step.when}]` : ""),
      start: false,
    }),
  );
  // oxlint-disable-next-line unicorn/no-array-reduce -- Each parent receives the edges produced by the preceding parents in order.
  return parentPaths(region.states).reduce((edges, parent) => groupParentEntry(edges, parent), [...starts, ...transitions]);
};

const MARK_STYLES = {
  breaks: "fill:#ffecee,stroke:#e72e3b,stroke-width:2.5px,color:#cd2834",
  mayBreak: "fill:#fff3e6,stroke:#e8730c,stroke-width:2.5px,color:#b85a06",
};

export function mermaidLines(chart: Chart) {
  let next = 0;
  const marks: string[] = [];
  const used = new Set<string>();
  const rules = { breaks: new Set<string>(), mayBreak: new Set<string>() };
  const region = (r: Region) => {
    const out: string[] = [];
    const topIds = new Map<string, string>();
    const nestedIds = new Map<string, string>();
    const id = (path: string[]) => {
      const top = path.length === 1;
      const named = top ? topIds : nestedIds;
      const k = top ? path[0] : tupleKey(path);
      let s = named.get(k);
      if (matchesUndefined(s)) {named.set(k, (s = `s${next++}`));}
      return s;
    };
    const known = new Map<string[], string>();
    const idOf = (path: string[]) => {
      let s = known.get(path);
      if (matchesUndefined(s)) {known.set(path, (s = id(path)));}
      return s;
    };
    const drawn = drawnEdges(r);
    const line = (e: Edge, indent: string) =>
      `${indent}${e.start ? "[*]" : idOf(e.from)} --> ${idOf(e.to)}${matchesUndefined(e.label) ? "" : `: ${esc(e.label)}`}`;
    const tree = (prefix: string[], indent: string, below: ChartState[]) => {
      const heads = new Map<string, ChartState[]>();
      for (const s of below) {append(heads, s.path[prefix.length], s);}
      for (const [head, under] of heads) {
        const path = [...prefix, head];
        let leaf: ChartState | undefined;
        const inner: ChartState[] = [];
        for (const s of under)
          {if (s.path.length > path.length) {inner.push(s);}
          else {leaf = s;}}
        if (inner.length) {
          out.push(`${indent}state "${esc(head, true)}" as ${id(path)} {`);
          tree(path, `${indent  }  `, inner);
          const key = tupleKey(path);
          for (const e of drawn)
            {if (e.start && tupleKey(e.from) === key) {out.push(line(e, `${indent}  `));}}
          out.push(`${indent}}`);
        } else if (leaf) {
          const sid = idOf(leaf.path);
          out.push(`${indent}${sid}: ${esc(head)}`);
          let mark: "breaks" | "mayBreak" | undefined =
            leaf.breaks.length && !leaf.works ? "mayBreak" : undefined;
          if (mark) {for (const b of leaf.breaks) {if (b.always) {mark = "breaks";}}}
          if (mark) {for (const b of leaf.breaks) {rules[mark].add(b.rule.name);}}
          const trail = [leaf.lead && "bugPath", leaf.repeats && "repeats"];
          const color = matchesUndefined(leaf.group) ? undefined : chart.colors[String(leaf.group)];
          for (const cls of [color, mark, ...trail])
            {if (cls) {
              used.add(cls);
              marks.push(`  class ${sid} ${cls}`);
            }}
        }
      }
    };
    tree([], "  ", r.states);
    for (const e of drawn) {if (!e.start || !e.from.length) {out.push(line(e, "  "));}}
    return out;
  };
  let body: string[];
  if (chart.regions.length > 1) {
    body = [`  state "At the same time" as all {`];
    for (const [i, r] of chart.regions.entries()) {
      if (i) {body.push("    --");}
      body.push(`    state "${esc(r.name, true)}" as r${i} {`);
      for (const line of region(r)) {body.push(`    ${line}`);}
      body.push("    }");
    }
    body.push("  }");
  } else {body = region(chart.regions[0]);}
  const legend: string[][] = [];
  for (const entry of [
    ...Object.entries(chart.colors),
    [`Breaks ${or(rules.breaks)}`, "breaks"],
    [`Breaks ${or(rules.mayBreak)} in some cases`, "mayBreak"],
    [`Path to the ${or(chart.paths)} bug`, "bugPath"],
    [`Repeats forever, so ${or(chart.loops)} breaks`, "repeats"],
  ])
    {if (used.has(entry[1])) {legend.push(entry);}}
  const lines: string[] = [];
  const title = chart.title && code(chart.title, (n) => `ﬂ°°${n}¶ß`).replaceAll("<", "ﬂ°°60¶ß");
  if (title) {lines.push("---", `title: ${JSON.stringify(title)}`, "---");}
  lines.push("stateDiagram-v2");
  if (chart.regions.length > 1) {lines.push("  direction LR");}
  if (legend.length) {
    lines.push(`  state "Legend" as legend {`);
    for (const [i, [text]] of legend.entries()) {lines.push(`    lg${i}: ${esc(text)}`);}
    lines.push("  }");
    for (const [i, [, cls]] of legend.entries()) {lines.push(`  class lg${i} ${cls}`);}
  }
  for (const line of body) {lines.push(line);}
  Object.entries(MARK_STYLES).forEach(([cls, style]) => {if (used.has(cls)) {lines.push(`  classDef ${cls} ${style}`);}});
  for (const line of marks) {lines.push(line);}
  return lines;
}

export const mermaid = (chart: Chart) => mermaidLines(chart).join("\n");
