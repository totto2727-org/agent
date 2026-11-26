import { drawnEdges } from "#statechart/backends/mermaid.ts";
import { matchesNull, matchesUndefined, visitItems } from "#statechart/ir.ts";
import type { Chart, ChartState } from "#statechart/ir.ts";

// oxlint-disable-next-line unicorn/no-null -- No parent is a separate value in the renderer topology comparison.
const NO_PARENT = null;
const SINGLE_REGION = 1;
const EMPTY_PATH = 0;

interface ExpectedNode { text: string; parent: string | null; group: boolean }

export interface Want {
  nodes: Map<string, ExpectedNode>;
  edges: string[][];
  direction: string;
  title: string | undefined;
}

type NodeId = (region: string, path: string[]) => string;
type DrawnEdge = ReturnType<typeof drawnEdges>[number];

interface Topology {
  colors: Chart["colors"];
  edges: string[][];
  id: NodeId;
  nodes: Map<string, ExpectedNode>;
  used: Set<string>;
}

interface RegionBranch {
  drawn: DrawnEdge[];
  name: string;
  parent: string | null;
  path: string[];
}

const idsFor = (): NodeId => {
  const ids = new Map<string, string>();
  return (region, path) => {
    const key = JSON.stringify([region, path]);
    const found = ids.get(key) ?? `s${ids.size}`;
    ids.set(key, found);
    return found;
  };
};

const headsOf = (below: ChartState[], depth: number): Map<string, ChartState[]> => {
  const heads = new Map<string, ChartState[]>();
  visitItems(below, (state) => {
    const head = state.path[depth];
    const previous = heads.get(head);
    if (matchesUndefined(previous)) {heads.set(head, [state]);}
    else {previous.push(state);}
  });
  return heads;
};

const childStates = (states: ChartState[], depth: number): {
  inner: ChartState[]; leaf?: ChartState;
} => {
  const result: { inner: ChartState[]; leaf?: ChartState } = { inner: [] };
  visitItems(states, (state) => {
    if (state.path.length > depth) {result.inner.push(state);}
    else {result.leaf = state;}
  });
  return result;
};

const addNestedEdges = (
  { edges, id }: Topology, { drawn, name, path }: RegionBranch, node: string,
): void => {
  const key = JSON.stringify(path);
  visitItems(drawn, (edge) => {
    if (edge.start && JSON.stringify(edge.from) === key) {
      edges.push([`${node}_start`, id(name, edge.to), edge.label ?? ""]);
    }
  });
};

const markGroupUsed = (topology: Topology, leaf: ChartState | undefined): void => {
  const group = leaf?.group;
  if (!matchesUndefined(group)) {
    // oxlint-disable-next-line typescript/no-base-to-string -- Match Mermaid's existing coercion from a user group value to a color key.
    topology.used.add(topology.colors[String(group)]);
  }
};

const renderBranch = (topology: Topology, branch: RegionBranch, below: ChartState[]): void => {
  visitItems(headsOf(below, branch.path.length), ([head, under]) => {
    const path = [...branch.path, head];
    const { inner, leaf } = childStates(under, path.length);
    const node = topology.id(branch.name, path);
    const hasChildren = inner.length > EMPTY_PATH;
    topology.nodes.set(node, { group: hasChildren, parent: branch.parent, text: head });
    if (hasChildren) {
      const children = { ...branch, parent: node, path };
      renderBranch(topology, children, inner);
      addNestedEdges(topology, children, node);
    } else {
      markGroupUsed(topology, leaf);
    }
  });
};

const addRegion = (topology: Topology, region: Chart["regions"][number], container: string | null): void => {
  if (!matchesNull(container)) {topology.nodes.set(container, { group: true, parent: "all", text: region.name });}
  const drawn = drawnEdges(region);
  renderBranch(topology, { drawn, name: region.name, parent: container, path: [] }, region.states);
  visitItems(drawn, (edge) => {
    if (!edge.start || edge.from.length === EMPTY_PATH) {
      topology.edges.push([
        edge.start ? `${container ?? "root"}_start` : topology.id(region.name, edge.from),
        topology.id(region.name, edge.to),
        edge.label ?? "",
      ]);
    }
  });
};

const addLegend = ({ colors, nodes, used }: Topology): void => {
  const legend = Object.entries(colors).filter(([, colorClass]) => used.has(colorClass));
  visitItems(legend.entries(), ([index, [text]]) => {
    nodes.set(`lg${index}`, { group: false, parent: "legend", text });
  });
  const [first] = legend;
  if (!matchesUndefined(first)) {nodes.set("legend", { group: true, parent: NO_PARENT, text: "Legend" });}
};

export const expected = (chart: Chart): Want => {
  const topology: Topology = { colors: chart.colors, edges: [], id: idsFor(), nodes: new Map(), used: new Set() };
  const multi = chart.regions.length > SINGLE_REGION;
  if (multi) {topology.nodes.set("all", { group: true, parent: NO_PARENT, text: "At the same time" });}
  visitItems(chart.regions.entries(), ([index, region]) => {addRegion(topology, region, multi ? `r${index}` : NO_PARENT);});
  addLegend(topology);
  return { direction: multi ? "LR" : "TB", edges: topology.edges, nodes: topology.nodes, title: chart.title };
};
