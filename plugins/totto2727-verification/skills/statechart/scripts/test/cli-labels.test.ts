// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { drawn } from "./drawn.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";
import { CHECK_PASSED, COMMAND_ERROR, INDEX_STEP, RULE_BROKEN, copyCase, corpus, read, run, writeView } from "./cli-fixtures.ts";

const byX = (labels: unknown[]): string => `export const state = (v) => ${JSON.stringify(labels)}[v.x];\n`;

const fanOut = (width: number): string => {
  const lines = ["strict digraph DiskGraph {", '0 [label="x = 0",style = filled]'];
  const states = Array.from({ length: width }, (_value, index) => index + INDEX_STEP);
  visitItems(states, (stateIndex) => {
    lines.push(
      `${stateIndex} [label="x = ${stateIndex}"];`,
      `0 -> ${stateIndex} [label="Inc",color="black",fontcolor="black"];`,
    );
  });
  return [...lines, "}"].join("\n");
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a flat view names a label with U+0000 as written when a loop cannot take a step out of it", async () => {
  const view = await writeView(
    `export const state = (v) => (v.playback === "Stopped" || v.volume === "Muted" ? ${JSON.stringify("a\0b")} : v.playback);\n`,
  );
  const result = await run(path.join(corpus, "MediaPlayerProps"), { view });
  assert.equal(result.status, COMMAND_ERROR);
  assert.equal(
    result.stderr,
    "The chart draws the step TheCallEnds out of a\0b, but the EventuallyPlays loop cannot take it there. Show in a label what stops it.\n",
  );
  assert.deepEqual(result.files, []);
});

visitItems([
  [
    "a parent-state view keeps a label with U+0000 apart from the parent path it spells",
    {
      arrows: ["a start --> b", "ab --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["ab", "a", "b", "c", "d"],
      status: CHECK_PASSED,
      view: byX([["a\0b"], ["a", "b"], ["c"], ["d"]]),
    },
  ],
  [
    "a regions view keeps a label with U+0000 apart from the parent path it spells, and the report names it as written",
    {
      arrows: [
        "R f start --> S p",
        "R ab start --> S q",
        "R b start --> S r",
        "R a start --> R b",
        "S p --> R ab: Inc",
        "S p --> R a: Inc",
      ],
      base: "Counter",
      fanOut: 2,
      says: /^The regions chart lets R f, S p go to R a\0b, S r by Inc, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
      states: ["R f", "S p", "R ab", "S q", "R a", "R b", "S r"],
      status: CHECK_PASSED,
      view: byX([
        { R: "f", S: "p" },
        { R: ["a\0b"], S: "q" },
        { R: ["a", "b"], S: "r" },
      ]),
    },
  ],
  [
    "a flat view with U+0001 in a label draws each arrow between the states it joins",
    {
      arrows: ["a\u0001b --> a: Inc", "a --> b: Inc", "b --> c: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "a", "b", "c"],
      status: CHECK_PASSED,
      view: byX(["a\u0001b", "a", "b", "c"]),
    },
  ],
  [
    "a parent-state view with U+0001 in a label draws the chart",
    {
      arrows: ["a start --> b", "a\u0001b --> a: Inc", "b --> c: Inc", "c --> d: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 4 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "a", "b", "c", "d"],
      status: CHECK_PASSED,
      view: byX([["a\u0001b"], ["a", "b"], ["c"], ["d"]]),
    },
  ],
  [
    "a regions view with U+0001 in a label draws the chart",
    {
      arrows: ["a\u0001b --> c: Inc", "c --> d: Inc", "d --> e: Inc"],
      base: "Counter",
      says: /^TLC reached 4 states and 3 steps\. The chart draws 5 states and 3 arrows\.$/mu,
      states: ["a\u0001b", "c", "d", "e", "p"],
      status: CHECK_PASSED,
      view: byX([
        { R: "a\u0001b", S: "p" },
        { R: "c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
    },
  ],
  [
    "a flat view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: b\cBc$/mu,
      states: ["a", "b\u0002c", "d", "e"],
      status: RULE_BROKEN,
      view: byX(["a", "b\u0002c", "d", "e"]),
    },
  ],
  [
    "a parent-state view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["P start --> b\u0002c", "a --> P: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. a\n1\. Next: P \/ b\cBc$/mu,
      states: ["a", "P", "b\u0002c", "d", "e"],
      status: RULE_BROKEN,
      view: byX([["a"], ["P", "b\u0002c"], ["d"], ["e"]]),
    },
  ],
  [
    "a regions view reports a state with U+0002 in its label that breaks a rule",
    {
      arrows: ["a --> b\u0002c: Next", "b\u0002c --> d: Next", "d --> e: Next"],
      base: "FirstRule",
      says: /^## NotOne breaks\nThe shortest path has 1 step:\n0\. R a, S p\n1\. Next: R b\cBc, S p$/mu,
      states: ["a", "b\u0002c", "d", "e", "p"],
      status: RULE_BROKEN,
      view: byX([
        { R: "a", S: "p" },
        { R: "b\u0002c", S: "p" },
        { R: "d", S: "p" },
        { R: "e", S: "p" },
      ]),
    },
  ],
  [
    "a regions view with U+0003 in labels draws parent states when the regions chart would invent a move",
    {
      arrows: [
        "R f start --> S p",
        "R a start --> S r",
        "R b start --> S q",
        "R X\u0003a start --> S q",
        "R X\u0003b start --> S r",
        "S p --> R a: Go\u0003X",
        "S p --> R b: Go\u0003X",
        "S p --> R X\u0003a: Go",
        "S p --> R X\u0003b: Go",
      ],
      base: "Counter",
      fanOut: 4,
      says: /^The regions chart lets R f, S p go to R a, S q by Go\cCX, which the model never does\. So the chart draws parent states in place of regions\.$/mu,
      states: ["R f", "S p", "R a", "S r", "R b", "S q", "R X\u0003a", "S q", "R X\u0003b", "S r"],
      status: CHECK_PASSED,
      view:
        `${byX([
          { R: "f", S: "p" },
          { R: "a", S: "r" },
          { R: "b", S: "q" },
          { R: "X\u0003a", S: "q" },
          { R: "X\u0003b", S: "r" },
        ])
        }export const step = (action, from, to) => (to.x <= 2 ? ${JSON.stringify("Go\u0003X")} : "Go");\n`,
    },
  ],
] satisfies [
  string,
  {
    base: string;
    fanOut?: number;
    view: string;
    status: number;
    states: string[];
    arrows: string[];
    says: RegExp;
  },
][], ([what, chartCase]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(what, async () => {
    const width = "fanOut" in chartCase ? chartCase.fanOut : undefined;
    const noFanOut = 0;
    const dir = !matchesUndefined(width) && width !== noFanOut
      ? await copyCase(chartCase.base, async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "graph.dot"), fanOut(width)); })
      : path.join(corpus, chartCase.base);
    const result = await run(dir, { view: await writeView(chartCase.view) });
    assert.equal(result.stderr, "");
    assert.equal(result.status, chartCase.status);
    const chart = await read(path.join(result.out, "chart.mmd"));
    assert.deepEqual(drawn(chart), {
      arrows: chartCase.arrows,
      states: chartCase.states,
    });
    assert.match(result.report, chartCase.says);
  });
});
