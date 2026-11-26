// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from '#statechart/ir.ts';
import type { Graph, Vars, View } from '#statechart/ir.ts';
import { drawn } from "./drawn.ts";
import { ONE_CALL, SWITCH_OFF, SWITCH_ON, countQuestion, draw, fixtureText, graphOf, marked } from "./chart-fixtures.ts";
import type { StateRow, StepRow } from "./chart-fixtures.ts";

const ab: View = { state: (variables) => ({ A: `a${fixtureText(variables.a)}`, B: `b${fixtureText(variables.b)}` }) };
const bit = (variables: Vars): string => `${fixtureText(variables.a)}${fixtureText(variables.b)}${fixtureText(variables.c)}`;
const xorStates: StateRow[] = [];
const xorSteps: StepRow[] = [];
const switches = [SWITCH_OFF, SWITCH_ON];
visitItems(switches, (axisA) => {
  visitItems(switches, (axisB) => {
    visitItems(switches, (axisC) => {
      const variables = { a: axisA, b: axisB, c: axisC };
      const from = bit(variables);
      xorStates.push([from, variables, axisA === SWITCH_OFF]);
      if (axisA === SWITCH_OFF && axisB !== axisC) {
        xorSteps.push([from, bit({ ...variables, a: SWITCH_ON }), "Go"]);
      }
      if (axisB === SWITCH_OFF) {
        xorSteps.push([from, bit({ ...variables, b: SWITCH_ON }), "FlipB"]);
      }
      if (axisC === SWITCH_OFF) {
        xorSteps.push([from, bit({ ...variables, c: SWITCH_ON }), "FlipC"]);
      }
    });
  });
});
const truthGraphs: Record<string, [Graph, View]> = {
  fork: [
    graphOf(
      [
        ["a0b0", { a: 0, b: 0 }, true],
        ["a1b1", { a: 1, b: 1 }],
        ["a2b2", { a: 2, b: 2 }],
      ],
      [
        ["a0b0", "a1b1", "Sync"],
        ["a0b0", "a2b2", "Sync"],
      ],
    ),
    ab,
  ],
  interleaved: [
    graphOf(
      [
        ["a0b0", { a: 0, b: 0 }, true],
        ["a1b0", { a: 1, b: 0 }],
        ["a0b1", { a: 0, b: 1 }],
        ["a1b1", { a: 1, b: 1 }],
      ],
      [
        ["a0b0", "a1b0", "Act"],
        ["a0b0", "a0b1", "Act"],
        ["a1b0", "a1b1", "Act"],
        ["a0b1", "a1b1", "Act"],
      ],
    ),
    ab,
  ],
  lockstep: [
    graphOf(
      [
        ["a0b0", { a: 0, b: 0 }, true],
        ["a1b1", { a: 1, b: 1 }],
      ],
      [["a0b0", "a1b1", "Act"]],
    ),
    ab,
  ],
  partial: [
    graphOf(
      [
        ["a0b0", { a: 0, b: 0 }, true],
        ["a1b1", { a: 1, b: 1 }],
        ["a1b0", { a: 1, b: 0 }],
      ],
      [
        ["a0b0", "a1b1", "Act"],
        ["a0b0", "a1b0", "Act"],
      ],
    ),
    ab,
  ],
  starts: [
    graphOf(
      [
        ["x0y0", { x: 0, y: 0 }, true],
        ["x1y1", { x: 1, y: 1 }, true],
        ["x1y0", { x: 1, y: 0 }],
      ],
      [["x0y0", "x1y0", "Step"]],
    ),
    { state: (variables) => ({ X: `x${fixtureText(variables.x)}`, Y: `y${fixtureText(variables.y)}` }) },
  ],
  xor: [
    graphOf(xorStates, xorSteps),
    { state: (variables) => ({ A: `a${fixtureText(variables.a)}`, B: `b${fixtureText(variables.b)}`, C: `c${fixtureText(variables.c)}` }) },
  ],
};

visitItems([
  ["starts", false],
  ["xor", false],
  ["fork", false],
  ["partial", false],
  ["lockstep", true],
  ["interleaved", true],
] satisfies [string, boolean][], ([name, regions]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`${name}: the chart uses regions only when they show the model's moves exactly`, () => {
    const { chart, report: text } = draw(...truthGraphs[name]);
    assert.equal(chart.includes('state "At the same time"'), regions);
    assert.equal(/So the chart draws parent states in place of regions\.$/mu.test(text), !regions);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the report says why regions cannot show a shared step that forks", () => {
  assert.match(
    draw(...truthGraphs.fork).report,
    /^The regions chart lets A a0, B b0 go to A a1, B b2 by Sync, which the model never does\./mu,
  );
});

const forkToBug = graphOf(
  [
    ["a0b0", { a: 0, b: 0 }, true], ["a1b1", { a: 1, b: 1 }],
    ["a2b2", { a: 2, b: 2 }, false, ["Safe"]],
  ],
  [["a0b0", "a1b1", "Sync"], ["a0b0", "a2b2", "Sync"]],
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart that draws parent states in place of regions still names each region in a bug path", () => {
  const { chart, report: text } = draw(forkToBug, ab);
  assert.match(chart, /^ {2}state "A a2" as s\d+ \{$/mu);
  assert.match(text, /^0\. A a0, B b0\n1\. Sync: A a2, B b2$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the view answers once for each state and step, so a chart of parent states agrees with its report", () => {
  const asked: Record<string, number> = {};
  const answer = (question: string): "first" | "later" => countQuestion(asked, question) === ONE_CALL ? "first" : "later";
  const { chart, report: text } = draw(forkToBug, {
    colors: { Busy: "orange", Calm: "blue" },
    group: (variables) => (answer(`group ${fixtureText(variables.a)}`) === "first" ? "Calm" : "Busy"),
    state: (variables) => {
      const word = answer(`state ${fixtureText(variables.a)}`);
      return { A: `a${fixtureText(variables.a)} ${word}`, B: `b${fixtureText(variables.b)}` };
    },
    step: (action, from, to) => `${action} ${answer(`step ${fixtureText(from.a)} to ${fixtureText(to.a)}`)}`,
  });
  assert.match(chart, /^ {2}state "A a2 first" as s\d+ \{$/mu);
  assert.doesNotMatch(chart, /later|orange/u);
  assert.match(text, /^0\. A a0 first, B b0\n1\. Sync first: A a2 first, B b2$/mu);
  assert.deepEqual(asked, {
    "group 0": 1,
    "group 1": 1,
    "group 2": 1,
    "state 0": 1,
    "state 1": 1,
    "state 2": 1,
    "step 0 to 1": 1,
    "step 0 to 2": 1,
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a region state is marked when every combination with it can break a rule", () => {
  const graph = graphOf(
    [
      ["a0b0", { a: 0, b: 0 }, true],
      ["a1b0", { a: 1, b: 0 }],
      ["a2b0", { a: 2, b: 0 }, false, ["Safe"]],
      ["a2b1", { a: 2, b: 1 }, false, ["Safe"]],
      ["a0b1", { a: 0, b: 1 }],
    ],
    [
      ["a0b0", "a1b0", "Go"],
      ["a1b0", "a2b0", "Go"],
      ["a2b0", "a2b1", "Flip"],
      ["a0b0", "a0b1", "Flip"],
    ],
  );
  assert.deepEqual(marked(draw(graph, ab).chart), { a2: "breaks" });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a combination that breaks a rule marks its states when no state of it has a mark", () => {
  const graph = graphOf(
    [
      ["a0b0", { a: 0, b: 0 }, true],
      ["a1b0", { a: 1, b: 0 }],
      ["a0b1", { a: 0, b: 1 }],
      ["a1b1", { a: 1, b: 1 }, false, ["Safe"]],
    ],
    [
      ["a0b0", "a1b0", "GoA"],
      ["a0b0", "a0b1", "GoB"],
      ["a1b0", "a1b1", "GoB"],
      ["a0b1", "a1b1", "GoA"],
    ],
  );
  assert.deepEqual(marked(draw(graph, ab).chart), { a1: "mayBreak", b1: "mayBreak" });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a bug-path step that stays in one state is a loop in a flat chart only", () => {
  const graph = graphOf(
    [
      ["s0", { x: 0, y: 0 }, true],
      ["s1", { x: 0, y: 1 }, false, ["Safe"]],
      ["s2", { x: 1, y: 0 }],
    ],
    [
      ["s0", "s1", "Tick"],
      ["s0", "s2", "Move"],
    ],
  );
  const flat = draw(graph, { state: (variables) => `x${fixtureText(variables.x)}` });
  assert.match(flat.chart, /^ {2}(?<state>s\d+) --> \k<state>: Tick$/mu);
  assert.doesNotMatch(flat.report, /does not draw/u);
  const regions = draw(graph, { state: (variables) => ({ X: `x${fixtureText(variables.x)}`, Z: "z" }) });
  assert.doesNotMatch(regions.chart, /Tick/u);
  assert.match(regions.report, /^The chart does not draw 1 steps that stay in one chart state\.$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a step that leaves every child of a parent the same way is one arrow from the parent", () => {
  const graph = graphOf(
    [
      ["x", { at: "Open.x" }, true],
      ["y", { at: "Open.y" }],
      ["done", { at: "Closed" }],
    ],
    [
      ["x", "y", "Next"],
      ["x", "done", "Quit"],
      ["y", "done", "Quit"],
    ],
  );
  const { chart } = draw(graph, { state: (variables) => fixtureText(variables.at).split(".") });
  const open = /^ {2}state "Open" as (?<open>s\d+) \{$/mu.exec(chart)?.groups?.open;
  const closed = /^ {2}(?<closed>s\d+): Closed$/mu.exec(chart)?.groups?.closed;
  const quits = Array.from(
    chart.matchAll(/^ {2}(?<from>s\d+) --> (?<to>s\d+): Quit$/gmu),
    (match) => [match.groups?.from, match.groups?.to],
  );
  assert.deepEqual(quits, [[open, closed]]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a parent's only way in ends at the parent, and its start marker goes on to each state with that step's label", () => {
  const graph = graphOf(
    [
      ["ask", { at: "Asking" }, true],
      ["flat", { at: "Layout.Flat" }],
      ["parents", { at: "Layout.Parents" }],
      ["drawn", { at: "Done.Drawn" }],
    ],
    [
      ["ask", "flat", "String"],
      ["ask", "parents", "Array"],
      ["flat", "drawn", "Draw"],
    ],
  );
  const { chart } = draw(graph, { state: (variables) => fixtureText(variables.at).split(".") });
  assert.deepEqual(drawn(chart).arrows.toSorted(), [
    "Asking --> Layout",
    "Done start --> Drawn",
    "Flat --> Done: Draw",
    "Layout start --> Flat: String",
    "Layout start --> Parents: Array",
  ]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a parent that two states lead into keeps an arrow from each, since one start marker cannot say where each came from", () => {
  const graph = graphOf(
    [
      ["a", { at: "A" }, true],
      ["b", { at: "B" }],
      ["p", { at: "P.p" }],
      ["q", { at: "P.q" }],
    ],
    [
      ["a", "b", "Go"],
      ["a", "p", "Left"],
      ["b", "q", "Right"],
    ],
  );
  const { chart } = draw(graph, { state: (variables) => fixtureText(variables.at).split(".") });
  assert.deepEqual(drawn(chart).arrows.toSorted(), ["A --> B: Go", "A --> p: Left", "B --> q: Right"]);
});
