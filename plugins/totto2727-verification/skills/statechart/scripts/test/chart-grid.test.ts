// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite checks the graph and chart with native assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs this fixture through Node's test runner in the standalone skill.
import { test } from "node:test";
import { visitItems } from "#statechart/ir.ts";
import { draw, FIRST, graphOf } from "./chart-fixtures.ts";
import type { StateRow, StepRow } from "./chart-fixtures.ts";

const gridRows = (dimension: number): { states: StateRow[]; steps: StepRow[] } => {
  const cellStride = 1;
  const lastIndex = dimension - cellStride;
  const indices = Array.from({ length: dimension }, (_value, index) => index);
  const states: StateRow[] = [];
  const steps: StepRow[] = [];
  visitItems(indices, (column) => {
    visitItems(indices, (row) => {
      const far = column === lastIndex && row === lastIndex;
      const current = `${column},${row}`;
      states.push([current, { x: column, y: row }, column === FIRST && row === FIRST, far ? ["Safe"] : []]);
      if (column < lastIndex) {
        const nextColumn = column + cellStride;
        steps.push([current, `${nextColumn},${row}`, "Right"]);
      }
      if (row < lastIndex) {
        const nextRow = row + cellStride;
        steps.push([current, `${column},${nextRow}`, "Down"]);
      }
    });
  });
  return { states, steps };
};

const GRID_DIMENSION = 100;
const MILLISECONDS_PER_SECOND = 1000;
const DURATION_LIMIT_SECONDS = 5;
const DISPLAY_DECIMAL_PLACES = 1;

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a graph of 10,000 states draws in seconds with no view", () => {
  const { states, steps } = gridRows(GRID_DIMENSION);
  const start = performance.now();
  const graph = graphOf(states, steps);
  const { chart, report: text } = draw(graph, {});
  const seconds = (performance.now() - start) / MILLISECONDS_PER_SECOND;
  assert.match(text, /^The shortest path has 198 steps:$/mu);
  assert.equal(chart.match(/^ {2}s\d+: /gmu)?.length, GRID_DIMENSION * GRID_DIMENSION);
  assert.ok(seconds < DURATION_LIMIT_SECONDS, `drawing took ${seconds.toFixed(DISPLAY_DECIMAL_PLACES)} s`);
});
