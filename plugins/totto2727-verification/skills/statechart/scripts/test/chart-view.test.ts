// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "#statechart/frontends/view.ts";
import { visitItems } from '#statechart/ir.ts';
import type { Vars, View } from '#statechart/ir.ts';
import { NO_CALLS, ONE_CALL, SWITCH_ON, countQuestion, draw, fixtureText, graphOf } from "./chart-fixtures.ts";

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view that cannot give a chart says what to change", () => {
  const graph = graphOf(
    [
      ["p", { x: "A" }, true],
      ["q", { x: "A.B" }],
    ],
    [["p", "q", "Go"]],
  );
  assert.throws(
    () => draw(graph, { state: (variables) => fixtureText(variables.x).split(".") }),
    /both as a state and as a parent state/u,
  );
  assert.throws(
    () => draw(graph, { state: (variables) => (variables.x === "A" ? { R: "x" } : { S: "y" }) }),
    /Return the same regions for every state/u,
  );
  assert.throws(() => draw(graph, { state: () => [] }), /Return a string, an array of strings/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("checkView takes a full view and refuses each wrong kind and every bad color", () => {
  checkView({}, inspect);
  checkView(
    {
      colors: { Busy: "blue" },
      group: () => "Busy",
      state: (variables: Vars) => variables.x,
      step: (actionName: string) => actionName,
      title: "T",
    },
    inspect,
  );
  // oxlint-disable-next-line unicorn/no-null -- Null is an invalid colors value distinct from the absent optional export.
  assert.throws(() => checkView({ colors: null }, inspect), /\bcolors\b[\s\S]*\bobject\b/u);
  assert.throws(() => checkView({ colors: ["blue"] }, inspect), /\bcolors\b[\s\S]*\bobject\b/u);
  assert.throws(() => checkView({ state: "Busy" }, inspect), /\bstate\b[\s\S]*\bfunction\b/u);
  assert.throws(
    () => checkView({ colors: { Busy: "red", Done: "tan", Idle: "repeats" } }, inspect),
    (caught: unknown) =>
      // oxlint-disable-next-line rules/no-instanceof-error -- This assertion requires the host Error that checkView documents for invalid input.
      caught instanceof Error &&
      /\bBusy\b[\s\S]*"red"/u.test(caught.message) &&
      /\bIdle\b[\s\S]*"repeats"/u.test(caught.message) &&
      !/\bDone\b/u.test(caught.message),
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a group named like an Object method still needs its own color", () => {
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  assert.throws(
    () => draw(graph, checkView({ colors: {}, group: () => "toString" }, inspect)),
    /group\(\) returned "toString"/u,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a message writes each value the way JavaScript shows it", () => {
  const loop: { self?: unknown } = {};
  loop.self = loop;
  assert.throws(
    () =>
      checkView(
        // oxlint-disable-next-line eslint/sort-keys, eslint/no-new-wrappers, unicorn/new-for-builtins -- The expected message asserts the invalid keys in this order and includes JavaScript's boxed string format.
        { colors: { Lost: Number.NaN, Far: Infinity, Big: BigInt("7"), Boxed: new String("blue"), Loop: loop } },
        inspect,
      ),
    /"Lost" the color NaN, "Far" the color Infinity, "Big" the color 7n, "Boxed" the color \[String: 'blue'\] and "Loop" the color <ref \*1> \{ self: \[Circular \*1\] \}\./u,
  );
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  assert.throws(
    () => draw(graph, checkView({ colors: {}, group: () => Number.NaN }, inspect)),
    /group\(\) returned NaN,/u,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("checkView takes colors only as a plain object", () => {
  const bare = { Busy: "blue" };
  // oxlint-disable-next-line unicorn/no-null -- Exercise the accepted native null-prototype color record.
  Object.setPrototypeOf(bare, null);
  checkView({ colors: bare }, inspect);
  const inherited = {};
  Object.setPrototypeOf(inherited, { Busy: "blue" });
  // oxlint-disable-next-line eslint/no-new-wrappers, unicorn/new-for-builtins -- A boxed primitive is an object, which the view must refuse as a color map.
  visitItems([new Map([["Busy", "blue"]]), inherited, new String("blue")], (colors) => {assert.throws(() => checkView({ colors }, inspect), {
      message: "The view's colors must be a plain object.",
    });});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the chart uses the colors that checkView read once from the view's own keys", () => {
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  const reads = { Busy: NO_CALLS };
  const flips = {
    get Busy() {
      return countQuestion(reads, "Busy") === ONE_CALL ? "blue" : "breaks";
    },
  };
  const changed = { Busy: "blue" };
  const changes = (): string => {
    changed.Busy = "breaks";
    return "Busy";
  };
  visitItems<View>([
    { colors: flips, group: () => "Busy" },
    { colors: changed, group: changes },
  ], (view) => {
    const { chart } = draw(graph, checkView(view, inspect));
    assert.match(chart, /^ {2}class s\d+ blue$/mu);
    assert.doesNotMatch(chart, /\bbreaks\b/u);
  });
  const hidden = Object.defineProperty({}, "Busy", { value: "breaks" });
  assert.throws(
    () => draw(graph, checkView({ colors: hidden, group: () => "Busy" }, inspect)),
    /group\(\) returned "Busy", which colors does not name/u,
  );
  const groupKey = Symbol("Busy");
  assert.throws(
    () => draw(graph, checkView({ colors: { [groupKey]: "breaks" }, group: () => groupKey }, inspect)),
    /group\(\) returned Symbol\(Busy\), which colors does not name/u,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart state with mixed groups gets no color, even when colors names undefined", () => {
  const graph = graphOf(
    [
      ["s0", { x: 0 }, true],
      ["s1", { x: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const view: View = {
    colors: { A: "blue", B: "teal", undefined: "pink" },
    group: (variables) => (variables.x === SWITCH_ON ? "B" : "A"),
    state: () => "Same",
  };
  assert.doesNotMatch(draw(graph, view).chart, /^ {2}class /mu);
});
