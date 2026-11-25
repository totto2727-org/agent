import { CHART_STATES, RERUN_STATES, hasSection, list, matchesUndefined, must, ruleKey, visitItems } from '#statechart/ir.ts';
import type { Bug, Chart, Graph, Property, Spec, Stop, Story, Verdict } from '#statechart/ir.ts';

const EMPTY_COUNT = 0;
const SINGLE_ITEM = 1;

const stepsOf = (story: Story): { state: string; step?: string }[] => {
  const path: { state: string; step?: string }[] = [];
  visitItems(story, ({ step, state }) => {
    const parts: string[] = [];
    Object.entries(state).forEach(([name, names]) => {parts.push((name ? `${name} ` : "") + names.join(" / "));});
    path.push({ state: parts.join(", "), step });
  });
  return path;
};

const forever = (loop: { state: string }[], stutters: boolean | undefined): string => {
  const quoted = new Set<string>();
  visitItems(loop, (position) => {quoted.add(`"${position.state}"`);});
  const runs = [...quoted];
  if (stutters ?? false) {return `The run stops in ${runs[0]} forever.`;}
  return runs.length === SINGLE_ITEM
    ? `The run stays in ${runs[0]} forever.`
    : `The run loops through ${list(runs)} forever.`;
};

const fenced = (text: string): string => ["```", text, "```"].join("\n");

const chartCounts = (chart: Chart | undefined): { arrows: number; size: number } => {
  const counts = { arrows: EMPTY_COUNT, size: EMPTY_COUNT };
  visitItems(chart?.regions ?? [], (region) => {
    counts.size += region.states.length;
    counts.arrows += region.steps.length;
  });
  return counts;
};

const graphCounts = (graph: Graph): { excluded: number; past: number; pastSteps: number } => {
  const counts = { excluded: EMPTY_COUNT, past: EMPTY_COUNT, pastSteps: EMPTY_COUNT };
  visitItems(graph.states.values(), (state) => {
    if (state.past) {
      const category = state.excluded ? "excluded" : "past";
      counts[category] += SINGLE_ITEM;
    }
  });
  visitItems(graph.steps, (step) => {if (must(graph.states, step.to).past) {counts.pastSteps += SINGLE_ITEM;}});
  return counts;
};

interface ReportResult {
  drawing: { status: number | null } | undefined;
  graph: Graph;
  paths: Bug[] | undefined;
  properties: Property[];
  rules: Verdict[];
  spec: Spec;
  states: { complete: boolean; cut: boolean; distinct: number; initial: number };
  stop: Stop | undefined;
}

const drawingNotices = ({ drawing, graph, paths, states }: ReportResult, outside: number): string[] => {
  if (drawing) {
    return [`TLC stopped the drawing run with exit ${drawing.status}, so the chart draws only the states that it reached before it stopped.`];
  }
  if (!paths && graph.states.size === outside) {
    return [states.initial
      ? "Every initial state is outside the constraints, so TLC explores none of them."
      : "TLC found no state that satisfies Init, so no state can break a rule."];
  }
  return [];
};

const stateOverview = (result: ReportResult, chart: Chart | undefined): string[] => {
  const { graph, paths, spec, states } = result;
  const { size, arrows } = chartCounts(chart);
  const { past, excluded, pastSteps } = graphCounts(graph);
  const includes = (count: number): string =>
    chart ? `, and the chart includes ${count === SINGLE_ITEM ? "it" : "them"}` : "";
  const out = [
    `# ${spec.module}`,
    "",
    paths
      ? `TLC reached ${states.complete && !states.cut && states.distinct > CHART_STATES ? `${states.distinct.toLocaleString("en-US")} states, more than` : "more states than"} the chart budget of ${CHART_STATES}, so ${chart ? `the chart draws only the bug paths: ${size} states and ${arrows} arrows` : "the command wrote no chart.mmd"}.`
      : `TLC reached ${graph.states.size - past - excluded} states and ${graph.steps.length - pastSteps} steps. The chart draws ${size} states and ${arrows} arrows.`,
    ...drawingNotices(result, past + excluded),
  ];
  if (past)
    {out.push(
      `${past === SINGLE_ITEM ? "1 state outside the constraints ends" : `${past} states outside the constraints each end`} a rule's path${includes(past)}. TLC checks the rules in a state outside the constraints, but it does not explore past it.`,
    );}
  if (excluded)
    {out.push(
      `${excluded === SINGLE_ITEM ? "1 step that the constraints exclude ends" : `${excluded} steps that the constraints exclude each end`} a rule's path${includes(excluded)}. TLC checks the rules after such a step, but it does not take the step.`,
    );}
  return out;
};

const deadlockNotices = ({ drawing, paths, rules, spec }: ReportResult): string[] => {
  if (paths || (!drawing && !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT"))) {return [];}
  return rules
    .filter(({ rule, outcome }) => rule.kind === "deadlock" && outcome === "broken")
    .map(() => drawing
      ? "The chart marks only the deadlock that TLC reports, because the drawing run stopped before it reached every state."
      : "The chart marks only the deadlock that TLC reports. Under a CONSTRAINT or an ACTION_CONSTRAINT, a state with no step in the chart can still have steps that the constraints leave out, and TLC does not count it as a deadlock.");
};

const chartNotices = (result: ReportResult, chart: Chart | undefined): string[] => {
  const inside = chart?.inside ?? EMPTY_COUNT;
  const quiet = chart?.quiet ?? EMPTY_COUNT;
  const explanation = chart?.lie ?? "";
  const merged = ["VIEW", "SYMMETRY"].filter((section) => hasSection(result.spec, section));
  return [
    ...(inside ? [`The chart does not draw ${inside} steps that stay in one chart state.`] : []),
    ...(quiet ? [`The view hides ${quiet} steps, so the chart does not draw them.`] : []),
    ...deadlockNotices(result),
    ...(explanation ? [`${explanation} So the chart draws parent states in place of regions.`] : []),
    ...(chart?.notes ?? []),
    ...(chart && merged.length ? [`With ${list(merged)}, TLC keeps one representative for each group of states that it counts as the same. An arrow can lead to the representative rather than to the state that the step reaches.`] : []),
  ];
};

const bugSection = (bug: Bug, story: Story): string[] => {
  const steps = `${bug.path.length} step${bug.path.length === SINGLE_ITEM ? "" : "s"}`;
  const out = [
    "", `## ${bug.rule.name} breaks`,
    bug.rule.kind === "property"
      ? `TLC's counterexample is in tlc-${bug.rule.name}.out. It has ${steps}:`
      : `The shortest path has ${steps}:`,
  ];
  const path = stepsOf(story);
  visitItems(path.entries(), ([index, item]) => {
    const label = item.step ?? "";
    out.push(`${index}. ${label ? `${label}: ` : ""}${item.state}`);
  });
  if (!matchesUndefined(bug.loop)) {out.push(forever(path.slice(bug.loop), bug.stutters));}
  return out;
};

const uncheckedNotices = (unchecked: string[], cut: boolean, stop: Stop | undefined): string[] => {
  const out: string[] = [];
  if (unchecked.length) {out.push("", "## Rules not checked", unchecked.join(", "));}
  if (unchecked.length && cut) {
    out.push(`After the first break, each TLC run stops at ${RERUN_STATES.toLocaleString("en-US")} distinct states. A run reached that bound before it checked ${unchecked.length === SINGLE_ITEM ? "this rule" : "these rules"} in every state.`);
  }
  if (stop) {
    const status = `TLC stopped with exit ${stop.status}`;
    const explanation = unchecked.length
      ? [`${status} before it checked ${unchecked.length === SINGLE_ITEM ? "this rule" : "these rules"}:`]
      : ["", "## TLC stopped", `${status}:`];
    out.push(...explanation, fenced(stop.message));
  }
  return out;
};

const ruleSections = ({ properties, rules, states, stop }: ReportResult, found: Bug[]): string[] => {
  const out: string[] = [];
  const drawn = new Set(found.map((bug) => ruleKey(bug.rule)));
  const holds: string[] = [];
  const unchecked: string[] = [];
  visitItems([...rules, ...properties], ({ rule, outcome, messages }) => {
    if (outcome === "holds") {holds.push(rule.name);}
    else if (outcome === "not checked") {unchecked.push(rule.name);}
    else if (messages && !drawn.has(ruleKey(rule)))
      {out.push(
        "",
        `## ${rule.name} breaks`,
        `TLC found a counterexample. It is in tlc-${rule.name}.out.`,
      );}
  });
  if (holds.length) {out.push("", "## Rules that hold", holds.join(", "));}
  visitItems(uncheckedNotices(unchecked, states.cut, stop), (line) => {out.push(line);});
  visitItems(properties, (property) => {if (property.outcome === "holds" && property.initialOnly)
      {out.push(
        `TLC checked ${property.rule.name} only in the initial states, because it has no [], <>, or ~>. List it as an INVARIANT to check every state.`,
      );}});
  return out;
};

export const report = function report(result: ReportResult, { chart, found, stories }: { chart: Chart | undefined; found: Bug[]; stories: Map<Bug, Story> }): string {
  return [
    ...stateOverview(result, chart),
    ...chartNotices(result, chart),
    ...found.flatMap((bug) => bugSection(bug, must(stories, bug))),
    ...ruleSections(result, found),
  ].join("\n");
};
