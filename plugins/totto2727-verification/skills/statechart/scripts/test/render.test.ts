// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { before, test } from "node:test";
import { mermaid as chartText } from "#statechart/backends/mermaid.ts";
import type { Graph } from "#statechart/ir.ts";
import { walk } from "#statechart/passes/reach.ts";
import { project } from "#statechart/pipeline.ts";
import { fuzz } from "./labels.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { chartFixtures, loadRenderTools, themeFixture } from "./render-fixtures.ts";
import type { RenderTools } from "./render-fixtures.ts";
import { crossedTitleBars, titleBars } from "./render-geometry.ts";

const fixtures = await chartFixtures();
const theme = await themeFixture();
assert.ok(!matchesUndefined(theme), "references/render.md has no css block");

const BOOTSTRAP_SEED = 1;
const FUZZ_CASES = 500;
const MIN_DRAWN = 400;
const MIN_REFUSED = 20;
const NO_CLASSES = 0;
const EXPECTED_BARS = 1;

const setup: { tools?: RenderTools } = {};
before(async () => {setup.tools = await loadRenderTools();});

const tools = (): RenderTools => {
  const { tools: runtimes } = setup;
  assert.ok(runtimes, "Renderer fixtures must be set up first.");
  return runtimes;
};

const classes = new Set<string>();
visitItems(fixtures, ({ name, text }) => {
  const marks = [...text.matchAll(/^ {2}class (?<id>\w+) (?<mark>\w+)$/gmu)];
  visitItems(marks, ({ groups }) => {if (!matchesUndefined(groups)) {classes.add(groups.mark);}});

  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} renders in Pele 1.9.0 with each class on its node`, () => {
    const { svg } = tools().render(text);
    assert.match(svg, /^<svg /u);
    visitItems(marks, ({ groups }) => {
      if (matchesUndefined(groups)) {return;}
      const { id, mark } = groups;
      assert.match(svg, new RegExp(`class="pele-node[^"]* ${mark}\\b[^"]*" data-id="${id}"`, "u"), id);
    });
  });

  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name} parses in mermaid.js, which chat views use`, async () => {
    await tools().mermaid.parse(text);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("random labels and colors keep their text and the chart's shape in Mermaid and Pele", async () => {
  const { drawn, refused, failure } = await fuzz({ ...tools(), charts: FUZZ_CASES, seed: BOOTSTRAP_SEED });
  if (!matchesUndefined(failure)) {assert.fail(failure);}
  assert.ok(drawn > MIN_DRAWN && refused > MIN_REFUSED, `${drawn} charts drawn, ${refused} refused`);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an arrow into a parent from its only way in stays out of the parent's title bar in Pele 1.9.0", () => {
  const graph: Graph = { states: new Map(), steps: [] };
  visitItems([
    ["ask", "Asking your view for labels"],
    ["flat", "Laying out the chart/Flat"],
    ["parents", "Laying out the chart/Parent states"],
    ["regions", "Laying out the chart/Regions"],
  ], ([id, at]) => {graph.states.set(id, { breaks: [], start: id === "ask", vars: { at } });});
  visitItems([
    ["flat", "String"],
    ["parents", "Array"],
    ["regions", "Object"],
  ], ([to, action]) => {graph.steps.push({ action, from: "ask", to });});
  const { chart } = project(graph, walk(graph), {
    found: [],
    // oxlint-disable-next-line typescript/no-base-to-string -- The fixture uses the same native label conversion as the standalone renderer test.
    view: { state: (vars) => String(vars.at).split("/") },
  });
  const { svg } = tools().render(chartText(chart));
  const bars = titleBars(svg);
  assert.equal(bars.length, EXPECTED_BARS);
  assert.deepEqual(crossedTitleBars(svg, bars), []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the theme in references/render.md colors each class that the charts use", () => {
  assert.ok(classes.size > NO_CLASSES);
  visitItems(classes, (name) => {assert.match(theme, new RegExp(`\\.pele \\.${name} rect \\{`, "u"), name);});
});
