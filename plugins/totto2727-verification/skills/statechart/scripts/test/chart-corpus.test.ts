// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "#statechart/frontends/view.ts";
import { visitItems } from '#statechart/ir.ts';
import type { View } from '#statechart/ir.ts';
import { compile } from "#statechart/pipeline.ts";
import { countQuestion, fixtureText } from "./chart-fixtures.ts";
import { corpusBugPaths } from "./chart-corpus.ts";

const countedView = (asked: Record<string, number>): View => ({
  state: (variables) => {
    countQuestion(asked, `state ${fixtureText(variables.x)}`);
    return `x is ${fixtureText(variables.x)}`;
  },
  step: (action, from, to) => {
    countQuestion(asked, `step ${fixtureText(from.x)} to ${fixtureText(to.x)}`);
    return `${action} adds one`;
  },
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart of only the bug paths words each one with the view, asked once for each state and step", async () => {
  const { graph, paths, spec } = await corpusBugPaths("FirstRule");
  const asked: Record<string, number> = {};
  const { report: text, files } = compile(
    {
      drawing: undefined,
      exit: 1,
      graph,
      messages: [],
      paths,
      properties: [],
      rules: [],
      spec: { ...spec, folder: "" },
      states: { complete: true, cut: false, distinct: 1234, initial: 1 },
      stop: undefined,
    },
    checkView(countedView(asked), inspect),
  );
  assert.match(
    text,
    /^TLC reached 1,234 states, more than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows\.$/mu,
  );
  assert.ok(files.has("chart.mmd"));
  visitItems(["NotOne", "NotOneOrThree", "AlsoNotOne"], (rule) => {assert.match(
      text,
      new RegExp(`^## ${rule} breaks\\n.*\\n0\\. x is 0\\n1\\. Next adds one: x is 1$`, "mu"),
    );});
  assert.deepEqual(asked, {
    "state 0": 1,
    "state 1": 1,
    "state 2": 1,
    "state 3": 1,
    "step 0 to 1": 1,
    "step 1 to 2": 1,
    "step 2 to 3": 1,
  });
});
