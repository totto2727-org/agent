// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "#statechart/frontends/view.ts";
import { isString, matchesUndefined } from "#statechart/ir.ts";
import type { View } from "#statechart/ir.ts";
import { build, draw } from "./labels-build.ts";
import { errorText, nativeFailure } from "./labels-errors.ts";
import { expected } from "./labels-expected.ts";
import { generate, random, THEME } from "./labels-generate.ts";
import type { Case } from "./labels-generate.ts";
import { readDrawing } from "./labels-renderers.ts";
import type { Html, Mermaid, Render } from "./labels-renderers.ts";

export type { Html, Mermaid, Render } from "./labels-renderers.ts";

interface Tools { render: Render; mermaid: Mermaid; html: Html }
interface Checked { refused?: true; text?: string; problems: string[] }
interface FuzzResult { drawn: number; refused: number; failure?: string }

const COUNTER_STEP = 1;
const FIRST_CHART = 1;
const FIRST_LABEL = 0;
const EMPTY_COUNT = 0;
const TEXT_START = 0;

const checkedView = (input: ReturnType<typeof build>["view"]): { view: View } | Checked => {
  const rejectsColor = Object.values(input.colors ?? {})
    .some((color) => !isString(color) || !THEME.includes(color));
  try {
    const view = checkView(input, inspect);
    return rejectsColor
      ? { problems: ["colors: checkView accepts a color that is not in the theme"] }
      : { view };
  } catch (error) {
    const message = errorText(nativeFailure(error));
    if (rejectsColor && message.startsWith("The view's colors give ")) {
      return { problems: [], refused: true };
    }
    return { problems: [`skill-throws: ${message}`] };
  }
};

const check = async (chartCase: Case, labels: string[], tools: Tools): Promise<Checked> => {
  const { graph, view } = build(chartCase, labels);
  const validated = checkedView(view);
  if ("problems" in validated) {return validated;}
  const result = draw(graph, validated.view);
  if ("problems" in result) {return result;}
  return readDrawing({ text: result.text, want: expected(result.chart) }, tools);
};

const kind = (problem: string): string => problem.slice(TEXT_START, problem.indexOf(":"));

const smallestFailure = async (chartCase: Case, first: string, tools: Tools): Promise<string[]> => {
  const cursor = { index: FIRST_LABEL, labels: chartCase.labels };
  while (cursor.index < cursor.labels.length) {
    const plain = cursor.labels.with(cursor.index, `n${cursor.index}`);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each reduction starts with the labels kept by the previous renderer check.
    const reduced = await check(chartCase, plain, tools);
    if (reduced.problems.some((problem) => kind(problem) === first)) {cursor.labels = plain;}
    cursor.index += COUNTER_STEP;
  }
  return cursor.labels;
};

const displayFailure = async (
  chartCase: Case, { first, number, seed }: { first: string; number: number; seed: number }, tools: Tools,
): Promise<string> => {
  const labels = await smallestFailure(chartCase, first, tools);
  const kept = labels.filter((text, index) => text !== `n${index}`);
  const last = await check(chartCase, labels, tools);
  const colors = chartCase.colors ? ` and the colors ${JSON.stringify(chartCase.colors)}` : "";
  return [
    `Chart ${number} of seed ${seed} goes wrong with the labels ${JSON.stringify(kept)}${colors}:`,
    ...last.problems,
    "",
    last.text ?? "",
  ].join("\n");
};

interface Run {
  counts: FuzzResult;
  number: number;
  randomizer: ReturnType<typeof random>;
  seed: number;
}

const runChart = async (run: Run, tools: Tools): Promise<string | undefined> => {
  const chartCase = generate(run.randomizer);
  const result = await check(chartCase, chartCase.labels, tools);
  const counter = result.refused ? "refused" : "drawn";
  run.counts[counter] += COUNTER_STEP;
  const [problem] = result.problems;
  if (matchesUndefined(problem)) {return undefined;}
  return displayFailure(chartCase, { first: kind(problem), number: run.number, seed: run.seed }, tools);
};

export const fuzz = async function fuzz({
  seed,
  charts,
  ...tools
}: { seed: number; charts: number } & Tools): Promise<FuzzResult> {
  await tools.mermaid.parse("stateDiagram-v2\n  s0: a");
  const run: Run = {
    counts: { drawn: EMPTY_COUNT, refused: EMPTY_COUNT }, number: FIRST_CHART, randomizer: random(seed), seed,
  };
  while (run.number <= charts) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Check and reduce each case before moving through the shared renderer state.
    const failure = await runChart(run, tools);
    if (!matchesUndefined(failure)) {return { ...run.counts, failure };}
    run.number += COUNTER_STEP;
  }
  return run.counts;
};
