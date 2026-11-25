import { append, byText, isString, matchesUndefined, tupleKey, visitItems } from '#statechart/ir.ts';
import type { Chart, ChartState, Region } from '#statechart/ir.ts';
import { escapeLabel, escapeTitle } from "#statechart/backends/mermaid-labels.ts";

const or = (names: Iterable<string>): string => [...names].toSorted(byText).join(" or ");

const FIRST_INDEX = 0;
const SINGLE_ITEM = 1;

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
): Edge => (
  // oxlint-disable-next-line eslint/sort-keys -- Keep the renderer's established shape for returned edges.
  { from, start, to, label }
);

const parentPaths = (states: ChartState[]): string[][] => {
  const parents = new Map<string, string[]>();
  states.forEach(({ path }) => {
    const prefixes = Array.from({ length: path.length - SINGLE_ITEM }, (_unused, index) => path.slice(FIRST_INDEX, index + SINGLE_ITEM));
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
  const singleEntry = incoming.length === SINGLE_ITEM;
  const remaining = edges.filter((edge) => !incoming.includes(edge));
  remaining.splice(
    edges.indexOf(first),
    FIRST_INDEX,
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
      label: step.label + ((step.when ?? "") ? ` [${step.when}]` : ""),
      start: false,
    }),
  );
  // oxlint-disable-next-line unicorn/no-array-reduce -- Each parent receives the edges produced by the preceding parents in order.
  return parentPaths(region.states).reduce((edges, parent) => groupParentEntry(edges, parent), [...starts, ...transitions]);
};

const violationMark = (reasons: ChartState["breaks"]): "breaks" | "mayBreak" =>
  reasons.some((reason) => reason.always) ? "breaks" : "mayBreak";

const MARK_STYLES = {
  breaks: "fill:#ffecee,stroke:#e72e3b,stroke-width:2.5px,color:#cd2834",
  mayBreak: "fill:#fff3e6,stroke:#e8730c,stroke-width:2.5px,color:#b85a06",
};

export const mermaidLines = function mermaidLines(chart: Chart): string[] {
  const numbering = { next: FIRST_INDEX };
  const marks: string[] = [];
  const used = new Set<string>();
  const rules = { breaks: new Set<string>(), mayBreak: new Set<string>() };
  const regionLines = (region: Region): string[] => {
    const out: string[] = [];
    const topIds = new Map<string, string>();
    const nestedIds = new Map<string, string>();
    const id = (path: string[]): string => {
      const top = path.length === SINGLE_ITEM;
      const named = top ? topIds : nestedIds;
      const key = top ? path[FIRST_INDEX] : tupleKey(path);
      const cached = named.get(key);
      if (!matchesUndefined(cached)) {return cached;}
      const name = `s${numbering.next}`;
      numbering.next += SINGLE_ITEM;
      named.set(key, name);
      return name;
    };
    const known = new Map<string[], string>();
    const idOf = (path: string[]): string => {
      const cached = known.get(path);
      if (!matchesUndefined(cached)) {return cached;}
      const name = id(path);
      known.set(path, name);
      return name;
    };
    const drawn = drawnEdges(region);
    const line = (edge: Edge, indent: string): string =>
      `${indent}${edge.start ? "[*]" : idOf(edge.from)} --> ${idOf(edge.to)}${matchesUndefined(edge.label) ? "" : `: ${escapeLabel(edge.label)}`}`;
    const tree = (prefix: string[], indent: string, below: ChartState[]): void => {
      const heads = new Map<string, ChartState[]>();
      visitItems(below, (chartState) => {append(heads, chartState.path[prefix.length], chartState);});
      visitItems(heads, ([head, under]) => {
        const path = [...prefix, head];
        const contents: { inner: ChartState[]; leaf: ChartState | undefined } = { inner: [], leaf: undefined };
        visitItems(under, (currentState) => {if (currentState.path.length > path.length) {contents.inner.push(currentState);}
          else {contents.leaf = currentState;}});
        const { inner, leaf } = contents;
        if (inner.length) {
          out.push(`${indent}state "${escapeLabel(head, true)}" as ${id(path)} {`);
          tree(path, `${indent  }  `, inner);
          const key = tupleKey(path);
          visitItems(drawn, (currentEdge) => {if (currentEdge.start && tupleKey(currentEdge.from) === key) {out.push(line(currentEdge, `${indent}  `));}});
          out.push(`${indent}}`);
        } else if (leaf) {
          const sid = idOf(leaf.path);
          out.push(`${indent}${sid}: ${escapeLabel(head)}`);
          const mark = leaf.breaks.length && !leaf.works ? violationMark(leaf.breaks) : undefined;
          if (mark) {
            const ruleNames = rules[mark];
            visitItems(leaf.breaks, (branch) => {ruleNames.add(branch.rule.name);});
          }
          const trail = [leaf.lead && "bugPath", leaf.repeats && "repeats"];
          // oxlint-disable-next-line typescript/no-base-to-string -- View groups accept arbitrary values and use their JavaScript string keys to look up colors.
          const color = matchesUndefined(leaf.group) ? undefined : chart.colors[String(leaf.group)];
          visitItems([color, mark, ...trail], (cls) => {if (isString(cls) && cls) {
              used.add(cls);
              marks.push(`  class ${sid} ${cls}`);
            }});
        }
      });
    };
    tree([], "  ", region.states);
    visitItems(drawn, (edge) => {if (!edge.start || !edge.from.length) {out.push(line(edge, "  "));}});
    return out;
  };
  const parallel = chart.regions.length > SINGLE_ITEM;
  const body = parallel ? [] : regionLines(chart.regions[FIRST_INDEX]);
  if (parallel) {
    body.push(`  state "At the same time" as all {`);
    visitItems(chart.regions.entries(), ([index, item]) => {
      if (index) {body.push("    --");}
      body.push(`    state "${escapeLabel(item.name, true)}" as r${index} {`);
      visitItems(regionLines(item), (line) => {body.push(`    ${line}`);});
      body.push("    }");
    });
    body.push("  }");
  }
  const legend: string[][] = [];
  visitItems([
    ...Object.entries(chart.colors),
    [`Breaks ${or(rules.breaks)}`, "breaks"],
    [`Breaks ${or(rules.mayBreak)} in some cases`, "mayBreak"],
    [`Path to the ${or(chart.paths)} bug`, "bugPath"],
    [`Repeats forever, so ${or(chart.loops)} breaks`, "repeats"],
  ], (entry) => {if (used.has(entry[1])) {legend.push(entry);}});
  const lines: string[] = [];
  const titleSource = chart.title ?? "";
  const title = titleSource ? escapeTitle(titleSource) : "";
  if (title) {lines.push("---", `title: ${JSON.stringify(title)}`, "---");}
  lines.push("stateDiagram-v2");
  if (parallel) {lines.push("  direction LR");}
  if (legend.length) {
    lines.push(`  state "Legend" as legend {`);
    visitItems(legend.entries(), ([index, [text]]) => {lines.push(`    lg${index}: ${escapeLabel(text)}`);});
    lines.push("  }");
    visitItems(legend.entries(), ([index, [, cls]]) => {lines.push(`  class lg${index} ${cls}`);});
  }
  visitItems(body, (line) => {lines.push(line);});
  Object.entries(MARK_STYLES).forEach(([cls, style]) => {if (used.has(cls)) {lines.push(`  classDef ${cls} ${style}`);}});
  visitItems(marks, (line) => {lines.push(line);});
  return lines;
};

export const mermaid = (chart: Chart): string => mermaidLines(chart).join("\n");
