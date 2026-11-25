// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { EC, LEVEL } from '#statechart/ir.ts';
import type { Bug, Graph, Message, PathStep, Trace, Vars } from '#statechart/ir.ts';
import { lasso } from "#statechart/passes/annotate.ts";
import { parseValue } from "#statechart/frontends/value.ts";
import { readTrace } from "#statechart/frontends/trace.ts";
import { draw, field, fixtureText, graphOf } from "./chart-fixtures.ts";

const keyStateLabel = (variables: Vars): string => `${fixtureText(variables.pos)}, key ${field(variables.key, "on") === true ? "on" : "off"}`;

const keyGraph = (): Graph =>
  graphOf(
    [
      ["idle", { key: parseValue("[on |-> FALSE, at |-> 0]"), pos: "idle" }, true],
      ["waitKeyOff", { key: parseValue("[on |-> FALSE, at |-> 0]"), pos: "wait" }],
      ["waitKeyOn", { key: parseValue("[on |-> TRUE, at |-> 0]"), pos: "wait" }],
      ["done", { key: parseValue("[on |-> TRUE, at |-> 0]"), pos: "done" }],
    ],
    [
      ["idle", "waitKeyOff", "Go"],
      ["idle", "waitKeyOn", "GoKey"],
      ["waitKeyOff", "waitKeyOff", "Tick"],
      ["waitKeyOff", "idle", "Back"],
      ["waitKeyOn", "done", "Open"],
    ],
  );
const keyState = (header: string, pos: string): Message => ({
  body: [header, `/\\ pos = "${pos}"`, String.raw`/\ key = [at |-> 0, on |-> FALSE]`, ""],
  code: EC.TLC_STATE_PRINT2,
  level: LEVEL.STATE,
});
const keyTrace = (): Trace =>
  readTrace([
    keyState("1: <Initial predicate>", "idle"),
    keyState("2: <Go line 9, col 3 to line 9, col 20 of module Key>", "wait"),
    { body: ["3: Stuttering"], code: EC.TLC_STATE_PRINT3, level: LEVEL.STATE },
  ]);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a loop's trace finds its states when TLC prints record fields in another order", () => {
  const graph = keyGraph();
  const bug = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(bug);
  assert.equal(bug.start, "idle");
  const moves = bug.path.map((part) => [part.action, part.state]);
  assert.deepEqual(moves, [["Go", "waitKeyOff"]]);
  const stutteringLoopIndex = 1;
  assert.equal(bug.loop, stutteringLoopIndex);
  assert.equal(bug.stutters, true);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view may hide a step inside a loop, but not a step out of it", () => {
  const graph = keyGraph();
  const found = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(found);
  const loop: Bug = { rule: { kind: "property", name: "Opens" }, ...found };
  // oxlint-disable-next-line unicorn/no-null -- Use the documented explicit null to hide a step inside the loop.
  const { report: chartReport } = draw(graph, { state: keyStateLabel, step: (actionName) => (actionName === "Tick" ? null : actionName) }, [loop]);
  assert.match(chartReport, /^The run stops in "wait, key off" forever\.$/mu);
  assert.throws(
    // oxlint-disable-next-line unicorn/no-null -- Exercise the error when the same documented null tries to hide an exit.
    () => draw(graph, { state: keyStateLabel, step: (actionName) => (actionName === "Back" ? null : actionName) }, [loop]),
    /the step Back that changes pos\. It is on the path to the Opens bug or leaves its loop/u,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a loop that passes one state twice names it once", () => {
  const graph = graphOf(
    [
      ["a", { pos: "a" }, true],
      ["b", { pos: "b" }],
      ["c", { pos: "c" }],
    ],
    [
      ["a", "b", "Up"],
      ["b", "a", "Down"],
      ["a", "c", "Side"],
      ["c", "a", "Back"],
    ],
  );
  const stepsAlongPath = ["ab", "ba", "ac", "ca"].map(([from, to]): PathStep => {
    const step = graph.steps.find((current) => current.from === from && current.to === to);
    assert.ok(step);
    return { action: step.action, state: to, step };
  });
  const loop: Bug = {
    loop: 0,
    path: stepsAlongPath,
    rule: { kind: "property", name: "Settles" },
    start: "a",
    stutters: false,
  };
  const { report: chartReport } = draw(graph, { state: (variables) => variables.pos }, [loop]);
  assert.match(chartReport, /^The run loops through "a", "b" and "c" forever\.$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart that draws a way out of a loop that the loop cannot take stops the command", () => {
  const graph = keyGraph();
  const found = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(found);
  const loop: Bug = { rule: { kind: "property", name: "Opens" }, ...found };
  assert.throws(
    () => draw(graph, { state: (variables) => variables.pos }, [loop]),
    /draws the step Open out of wait, but the Opens loop cannot take it there/u,
  );
  const { chart } = draw(
    graph,
    { state: keyStateLabel },
    [loop],
  );
  const wait = /^ {2}(?<wait>s\d+): wait, key off$/mu.exec(chart)?.groups?.wait;
  assert.match(chart, new RegExp(`^ {2}class ${wait} repeats$`, "mu"));
});
