import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { errorText, nativeFailure } from "./labels-errors.ts";
import type { Want } from "./labels-expected.ts";
import { decoded, fromMermaid, fromSvg, rewritten, titled, visible, wrapped } from "./labels-text.ts";

export type Render = (text: string) => { svg: string };
export type Html = (markup: string) => string;

interface MermaidNode {
  id: string;
  label?: string;
  shape?: string;
  parentId?: string;
  isGroup?: boolean;
  dir?: string;
}

interface MermaidData {
  nodes: MermaidNode[];
  edges: { start: string; end: string; label?: string }[];
  direction?: string;
}

export interface Mermaid {
  parse: (text: string) => Promise<unknown>;
  mermaidAPI: {
    getDiagramFromText: (text: string) => Promise<{ db: { getData: () => MermaidData } }>;
  };
}

interface Drawing { text: string; want: Want; problems: string[] }

const STEP = 1;
const ZERO = 0;
const FIRST_LINE = 0;
// oxlint-disable-next-line unicorn/no-null -- The expected drawing distinguishes the root from every node ID.
const NO_PARENT = null;
const FIXED_MERMAID_SHAPES = new Set(["divider", "stateStart", "stateEnd"]);

const edgeKeys = (edges: string[][], withLabels: boolean): string =>
  edges.map(([from, to, label]) => withLabels ? `${from} ${to} ${visible(label)}` : `${from} ${to}`)
    .toSorted().join("\n");

const visibleParent = (nodes: Map<string | undefined, MermaidNode>, node: MermaidNode): string | null => {
  const state = { parent: nodes.get(node.parentId) };
  while (state.parent?.shape === "divider") {
    const { parentId } = state.parent;
    state.parent = nodes.get(parentId);
  }
  return state.parent?.id ?? NO_PARENT;
};

const mermaidNodeProblem = (
  node: MermaidNode, want: Want, { html, nodes }: { html: Html; nodes: Map<string | undefined, MermaidNode> },
): string | undefined => {
  const parent = visibleParent(nodes, node);
  const expected = want.nodes.get(node.id);
  const shown = fromMermaid(node.label ?? "");
  if (!expected || parent !== expected.parent || Boolean(node.isGroup) !== expected.group) {
    return `mermaid-nodes: Mermaid draws ${node.id} where the chart has no such node`;
  }
  if (rewritten(shown)) {return `mermaid-text: Mermaid's SVG cleanup rewrites ${node.id}'s ${JSON.stringify(shown)}`;}
  const label = html(decoded(node.label ?? ""));
  return visible(label) === visible(expected.text) ? undefined
    : `mermaid-text: ${node.id} shows ${JSON.stringify(html(decoded(node.label ?? "")))} for ${JSON.stringify(expected.text)}`;
};

const mermaidNodes = ({ problems, want }: Drawing, data: MermaidData, html: Html): void => {
  const nodes = new Map<string | undefined, MermaidNode>(data.nodes.map((node) => [node.id, node]));
  const count = { visible: ZERO };
  visitItems(data.nodes, (node) => {
    if (FIXED_MERMAID_SHAPES.has(node.shape ?? "")) {return;}
    count.visible += STEP;
    const problem = mermaidNodeProblem(node, want, { html, nodes });
    if (!matchesUndefined(problem)) {problems.push(problem);}
    const direction = node.dir ?? "";
    if (Boolean(node.isGroup) && direction.length > ZERO && direction !== "TB") {
      problems.push(`mermaid-direction: ${node.id} runs ${direction}`);
    }
  });
  if (count.visible !== want.nodes.size) {problems.push(`mermaid-nodes: ${count.visible} nodes for ${want.nodes.size}`);}
  if ((data.direction ?? "TB") !== want.direction) {problems.push(`mermaid-direction: the chart runs ${data.direction}`);}
};

const mermaidTitle = ({ problems, text, want }: Drawing): void => {
  const encoded = /^---\ntitle: (?<title>.*)\n---\n/u.exec(text)?.groups?.title;
  const raw = matchesUndefined(encoded) ? undefined : String(JSON.parse(encoded));
  const title = matchesUndefined(raw) ? undefined : fromMermaid(raw);
  if ((!matchesUndefined(title)) !== titled(want.title)) {
    problems.push(`mermaid-title: Mermaid draws a title for ${JSON.stringify(want.title)}`);
  } else if (raw?.includes("<") === true) {
    problems.push(`mermaid-title: Mermaid's sanitizer reads the < in ${JSON.stringify(raw)} as a tag`);
  } else if (title?.includes("\0") === true) {
    problems.push(`mermaid-title: a browser draws the NUL in ${JSON.stringify(title)} as U+FFFD`);
  } else if (!matchesUndefined(title) && visible(title) !== visible(want.title ?? "")) {
    problems.push(`mermaid-text: the title shows ${JSON.stringify(title)} for ${JSON.stringify(want.title)}`);
  }
};

const mermaidEdges = ({ problems, want }: Drawing, data: MermaidData, html: Html): void => {
  const got: string[][] = [];
  const shown: string[][] = [];
  visitItems(data.edges, (edge) => {
    got.push([edge.start, edge.end, fromMermaid(edge.label ?? "")]);
    shown.push([edge.start, edge.end, html(decoded(edge.label ?? ""))]);
  });
  if (edgeKeys(got, false) !== edgeKeys(want.edges, false)) {problems.push("mermaid-edges: the arrows join other states");}
  else if (edgeKeys(shown, true) !== edgeKeys(want.edges, true)) {problems.push("mermaid-text: an arrow shows other text");}
  visitItems(got, ([from, to, label]) => {
    if (rewritten(label)) {
      problems.push(`mermaid-text: Mermaid's SVG cleanup rewrites the arrow from ${from} to ${to}'s ${JSON.stringify(label)}`);
    }
  });
};

const mermaidData = async (drawing: Drawing, mermaid: Mermaid): Promise<MermaidData | undefined> => {
  try {
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(drawing.text);
    return diagram.db.getData();
  } catch (error) {
    drawing.problems.push(`mermaid-refuses: ${errorText(nativeFailure(error)).split("\n")[FIRST_LINE]}`);
    return undefined;
  }
};

const readMermaid = async (drawing: Drawing, { html, mermaid }: { html: Html; mermaid: Mermaid }): Promise<void> => {
  const data = await mermaidData(drawing, mermaid);
  if (matchesUndefined(data)) {return;}
  mermaidNodes(drawing, data, html);
  mermaidTitle(drawing);
  mermaidEdges(drawing, data, html);
};

const PELE_NODE = /<g class="pele-(?:node|cluster) (?<classes>[^"]*)" data-id="(?<id>[^"]*)"[^>]*>(?<contents>[\s\S]*?)<\/g>/gu;
const SVG_LABEL = /<text[^>]*>(?<label>[\s\S]*?)<\/text>/u;
const PELE_ARROW = /<g class="pele-edge pele-transition"/gu;
const PELE_ARROW_LABEL = /<g class="pele-edge-label" data-id="edge(?<index>\d+)"[^>]*>[\s\S]*?<text[^>]*>(?<label>[\s\S]*?)<\/text>/gu;
const PELE_TITLE = /<text class="pele-title"[^>]*>(?<label>[\s\S]*?)<\/text>/u;

const peleNodes = ({ problems, want }: Drawing, svg: string): void => {
  const drawn = new Map<string, string>();
  visitItems(svg.matchAll(PELE_NODE), ({ groups }) => {
    if (matchesUndefined(groups) || /state-(?:start|end)/u.test(groups.classes)) {return;}
    const label = SVG_LABEL.exec(groups.contents)?.groups?.label;
    drawn.set(groups.id, matchesUndefined(label) ? "" : fromSvg(label));
  });
  if (drawn.size !== want.nodes.size) {problems.push(`pele-nodes: ${drawn.size} nodes for ${want.nodes.size}`);}
  visitItems(want.nodes, ([node, wanted]) => {
    const shown = drawn.get(node);
    if (matchesUndefined(shown)) {problems.push(`pele-nodes: Pele draws no ${node}`);}
    else if (wrapped(shown) !== wrapped(wanted.text)) {
      problems.push(`pele-text: ${node} shows ${JSON.stringify(shown)} for ${JSON.stringify(wanted.text)}`);
    }
  });
};

const peleEdges = ({ problems, want }: Drawing, svg: string): void => {
  const arrows = svg.match(PELE_ARROW)?.length ?? ZERO;
  if (arrows !== want.edges.length) {problems.push(`pele-edges: ${arrows} arrows for ${want.edges.length}`);}
  visitItems(svg.matchAll(PELE_ARROW_LABEL), ({ groups }) => {
    if (matchesUndefined(groups)) {return;}
    const expected = want.edges[Number(groups.index)];
    if (matchesUndefined(expected)) {
      problems.push(`pele-edges: Pele labels edge${groups.index}, which the chart does not have`);
    } else if (wrapped(fromSvg(groups.label)) !== wrapped(expected[2])) {
      problems.push(`pele-text: edge${groups.index} shows ${JSON.stringify(fromSvg(groups.label))} for ${JSON.stringify(expected[2])}`);
    }
  });
};

const peleTitle = ({ problems, want }: Drawing, svg: string): void => {
  const title = PELE_TITLE.exec(svg)?.groups?.label;
  if ((!matchesUndefined(title)) !== titled(want.title)) {
    problems.push(`pele-title: Pele draws a title for ${JSON.stringify(want.title)}`);
  } else if (!matchesUndefined(title) && wrapped(fromSvg(title)) !== wrapped(want.title ?? "")) {
    problems.push(`pele-text: the title shows ${JSON.stringify(fromSvg(title))} for ${JSON.stringify(want.title)}`);
  }
};

const peleSvg = (drawing: Drawing, render: Render): string | undefined => {
  try {return render(drawing.text).svg;}
  catch (error) {
    drawing.problems.push(`pele-refuses: ${errorText(nativeFailure(error)).split("\n")[FIRST_LINE]}`);
    return undefined;
  }
};

const readPele = (drawing: Drawing, render: Render): void => {
  const svg = peleSvg(drawing, render);
  if (matchesUndefined(svg)) {return;}
  peleNodes(drawing, svg);
  peleEdges(drawing, svg);
  peleTitle(drawing, svg);
};


export const readDrawing = async (
  { text, want }: Omit<Drawing, "problems">, tools: { html: Html; mermaid: Mermaid; render: Render },
): Promise<{ problems: string[]; text: string }> => {
  const drawing: Drawing = { problems: [], text, want };
  await readMermaid(drawing, tools);
  readPele(drawing, tools.render);
  return { problems: drawing.problems, text };
};
