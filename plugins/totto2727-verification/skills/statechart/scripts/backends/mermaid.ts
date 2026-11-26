import { append, byText, matchesUndefined, tupleKey, visitItems } from '#statechart/ir.ts';
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

interface StateNumbering {
  next: number;
}

interface DiagramClasses {
  colors: Chart["colors"];
  marks: string[];
  rules: Record<keyof typeof MARK_STYLES, Set<string>>;
  used: Set<string>;
}

const stateIds = (numbering: StateNumbering): { id: (path: string[]) => string; idOf: (path: string[]) => string } => {
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
  return { id, idOf };
};

const markState = (state: ChartState, stateId: string, classes: DiagramClasses): void => {
  const mark = state.breaks.length && !state.works ? violationMark(state.breaks) : undefined;
  if (mark) {
    const ruleNames = classes.rules[mark];
    visitItems(state.breaks, (branch) => {ruleNames.add(branch.rule.name);});
  }
  const trail = [state.lead && "bugPath", state.repeats && "repeats"];
  // oxlint-disable-next-line typescript/no-base-to-string -- View groups accept arbitrary values and use their JavaScript string keys to look up colors.
  const color = matchesUndefined(state.group) ? undefined : classes.colors[String(state.group)];
  visitItems([color, mark, ...trail], (className) => {
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- The color lookup can return inherited values, so preserve JavaScript truthiness when emitting the chart's styles.
    if (className) {
      classes.used.add(className);
      classes.marks.push(`  class ${stateId} ${className}`);
    }
  });
};

interface BranchContents {
  inner: ChartState[];
  leaf: ChartState | undefined;
}

const branchContents = (states: ChartState[], depth: number): BranchContents => {
  const contents: BranchContents = { inner: [], leaf: undefined };
  visitItems(states, (state) => {
    if (state.path.length > depth) {
      contents.inner.push(state);
    } else {
      contents.leaf = state;
    }
  });
  return contents;
};

const drawRegion = (region: Region, numbering: StateNumbering, classes: DiagramClasses): string[] => {
  const out: string[] = [];
  const { id, idOf } = stateIds(numbering);
  const drawn = drawnEdges(region);
  const line = (edge: Edge, indent: string): string =>
    `${indent}${edge.start ? "[*]" : idOf(edge.from)} --> ${idOf(edge.to)}${matchesUndefined(edge.label) ? "" : `: ${escapeLabel(edge.label)}`}`;
  const drawLeaf = (leaf: ChartState, head: string, indent: string): void => {
    const stateId = idOf(leaf.path);
    out.push(`${indent}${stateId}: ${escapeLabel(head)}`);
    markState(leaf, stateId, classes);
  };
  const tree = (prefix: string[], indent: string, below: ChartState[]): void => {
    const heads = new Map<string, ChartState[]>();
    visitItems(below, (state) => {append(heads, state.path[prefix.length], state);});
    visitItems(heads, ([head, states]) => {
      const path = [...prefix, head];
      const { inner, leaf } = branchContents(states, path.length);
      if (inner.length) {
        out.push(`${indent}state "${escapeLabel(head, true)}" as ${id(path)} {`);
        tree(path, `${indent}  `, inner);
        const key = tupleKey(path);
        visitItems(drawn, (edge) => {
          if (edge.start && tupleKey(edge.from) === key) {out.push(line(edge, `${indent}  `));}
        });
        out.push(`${indent}}`);
      } else if (leaf) {
        drawLeaf(leaf, head, indent);
      }
    });
  };
  tree([], "  ", region.states);
  visitItems(drawn, (edge) => {if (!edge.start || !edge.from.length) {out.push(line(edge, "  "));}});
  return out;
};

const drawBody = (regions: Region[], numbering: StateNumbering, classes: DiagramClasses): string[] => {
  if (regions.length <= SINGLE_ITEM) {return drawRegion(regions[FIRST_INDEX], numbering, classes);}
  const body = ['  state "At the same time" as all {'];
  visitItems(regions.entries(), ([index, region]) => {
    if (index) {body.push("    --");}
    body.push(`    state "${escapeLabel(region.name, true)}" as r${index} {`);
    visitItems(drawRegion(region, numbering, classes), (line) => {body.push(`    ${line}`);});
    body.push("    }");
  });
  body.push("  }");
  return body;
};

const legendLines = (chart: Chart, classes: DiagramClasses): string[] => {
  const { rules, used } = classes;
  const legend = [
    ...Object.entries(chart.colors),
    [`Breaks ${or(rules.breaks)}`, "breaks"],
    [`Breaks ${or(rules.mayBreak)} in some cases`, "mayBreak"],
    [`Path to the ${or(chart.paths)} bug`, "bugPath"],
    [`Repeats forever, so ${or(chart.loops)} breaks`, "repeats"],
  ].filter(([, className]) => used.has(className));
  if (!legend.length) {return [];}
  const lines = ['  state "Legend" as legend {'];
  visitItems(legend.entries(), ([index, [text]]) => {lines.push(`    lg${index}: ${escapeLabel(text)}`);});
  lines.push("  }");
  visitItems(legend.entries(), ([index, [, className]]) => {lines.push(`  class lg${index} ${className}`);});
  return lines;
};

const headerLines = (titleSource: string, parallel: boolean): string[] => {
  const title = titleSource ? escapeTitle(titleSource) : "";
  const lines = title ? ["---", `title: ${JSON.stringify(title)}`, "---"] : [];
  lines.push("stateDiagram-v2");
  if (parallel) {lines.push("  direction LR");}
  return lines;
};

export const mermaidLines = function mermaidLines(chart: Chart): string[] {
  const numbering = { next: FIRST_INDEX };
  const classes: DiagramClasses = {
    colors: chart.colors,
    marks: [],
    rules: { breaks: new Set<string>(), mayBreak: new Set<string>() },
    used: new Set<string>(),
  };
  const body = drawBody(chart.regions, numbering, classes);
  const styles = Object.entries(MARK_STYLES).flatMap(([className, style]) => classes.used.has(className) ? [`  classDef ${className} ${style}`] : []);
  return [
    ...headerLines(chart.title ?? "", chart.regions.length > SINGLE_ITEM),
    ...legendLines(chart, classes),
    ...body,
    ...styles,
    ...classes.marks,
  ];
};

export const mermaid = (chart: Chart): string => mermaidLines(chart).join("\n");
