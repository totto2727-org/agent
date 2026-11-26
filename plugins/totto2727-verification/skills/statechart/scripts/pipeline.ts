import { mermaidLines } from "./backends/mermaid.ts";
import { plainText } from "./backends/plain-text.ts";
import { report } from "./backends/report.ts";
import { PART, ruleKey, visitItems } from './ir.ts';
import type { Answers, Bug, Chart, CheckedView, CheckResult, Graph, Story, View, Walk } from './ir.ts';
import { asParents, ask, labelGraph, storiesOf } from "./passes/label.ts";
import { lift } from "./passes/lift.ts";
import { loopCheck } from "./passes/loop-check.ts";
import { bugs, drawOrder, walk } from "./passes/reach.ts";
import { regionsLie } from "./passes/region-check.ts";
import { drawRegions } from "./passes/regions.ts";

const FIRST_LINE = 0;
const NEXT_LINE = 1;
const EMPTY_PART = 0;
const LINE_FEED = "\n";

const inParts = function* (lines: string[]): Generator<string> {
  const part = { size: EMPTY_PART, start: FIRST_LINE };
  // oxlint-disable-next-line rules/no-for-loops -- Yield each completed chart part lazily without buffering the remaining parts.
  for (const [index, line] of lines.entries()) {
    const end = index + NEXT_LINE;
    part.size += line.length + LINE_FEED.length;
    if (part.size > PART || end === lines.length) {
      const prefix = part.start === FIRST_LINE ? "" : LINE_FEED;
      yield prefix + lines.slice(part.start, end).join(LINE_FEED);
      part.start = end;
      part.size = EMPTY_PART;
    }
  }
};

const shortestFirst = (left: { path: unknown[] }, right: { path: unknown[] }): number =>
  left.path.length - right.path.length;

export const project = function project(graph: Graph, walked: Walk, { found, view }: { found: Bug[]; view: View }): { chart: Chart; stories: Map<Bug, Story> } {
  const { order, rank } = drawOrder(walked);
  const draw = (answers: Answers): { chart: Chart; labels: ReturnType<typeof labelGraph> } => {
    const labels = labelGraph(graph, walked, answers, rank, found);
    return { chart: drawRegions(walked, labels, order, found, view), labels };
  };
  const answers = ask(graph, walked, view);
  const first = draw(answers);
  const lie = regionsLie({ labels: first.labels, order, regions: first.chart.regions, walk: walked }) ?? "";
  const { labels, chart } = lie ? draw(asParents(walked, answers)) : first;
  loopCheck(chart, labels, { found, walk: walked });
  return {
    chart: lift(lie ? { ...chart, lie } : chart),
    stories: storiesOf(graph, found, walked, first.labels),
  };
};

type OutputFiles = Map<string, Iterable<string | Uint8Array>>;

const addCounterexamples = ({ rules, properties }: CheckResult, found: Bug[], files: OutputFiles): void => {
  const drawn = new Set(found.filter((bug) => bug.rule.kind !== "property").map((bug) => ruleKey(bug.rule)));
  visitItems([...rules, ...properties], ({ rule, outcome, messages }) => {
    if (outcome === "broken" && messages && !drawn.has(ruleKey(rule))) {
      files.set(`tlc-${rule.name}.out`, plainText(messages));
    }
  });
};

export const compile = function compile(result: CheckResult, view: CheckedView): { exit: CheckResult["exit"]; files: OutputFiles; report: string } {
  const walked = walk(result.graph);
  const found = (result.paths ?? bugs(result.graph, walked)).toSorted(shortestFirst);
  visitItems(result.properties, (property) => {if (property.bug) {found.push({ rule: property.rule, ...property.bug });}});
  const { chart, stories } =
    found.length || !result.paths
      ? project(result.graph, walked, { found, view })
      : { chart: undefined, stories: new Map<Bug, Story>() };
  const text = report(result, { chart, found, stories });
  const files: OutputFiles = new Map(chart ? [["chart.mmd", inParts(mermaidLines(chart))]] : []);
  files
    .set("report.md", [text])
    .set("tlc.out", plainText(result.messages));
  addCounterexamples(result, found, files);
  // oxlint-disable-next-line eslint/sort-keys -- Keep the compile result's established key order for callers that inspect it.
  return { report: text, files, exit: result.exit };
};
