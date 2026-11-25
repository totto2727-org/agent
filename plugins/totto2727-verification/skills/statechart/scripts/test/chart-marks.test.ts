// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { byText, stateRules, visitItems } from '#statechart/ir.ts';
import type { Graph, Rule, Spec, Value } from '#statechart/ir.ts';
import { mark } from "#statechart/passes/annotate.ts";
import { parseDot } from "#statechart/frontends/dot.ts";
import { parseValue } from "#statechart/frontends/value.ts";
import { readMarks } from "#statechart/frontends/marks.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { corpusSpec, readCorpusFixture } from "./chart-corpus-source.ts";
import { ALL_MARKS_PLACED, FIRST, field, fixtureText, graphOf } from "./chart-fixtures.ts";

const unplacedChartMarks = (graph: Graph, output: string, spec: Spec): ReturnType<typeof mark> => {
  const messages = readMessages(output);
  const marks = readMarks(messages, "chart");
  return mark(graph, marks, { names: spec.variables, rules: stateRules(spec) });
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC's marks place on their states even when TLC wraps them over lines", async () => {
  const spec = await corpusSpec("TwoPhase");
  const out = await readCorpusFixture("TwoPhase", "ChartRun.out");
  const graphText = await readCorpusFixture("TwoPhase", "graph.dot");
  const graph = parseDot(graphText);
  assert.equal(unplacedChartMarks(graph, out, spec).size, ALL_MARKS_PLACED);
  const bad: Value[][] = [];
  visitItems(graph.states.values(), (currentState) => {if (currentState.breaks.length)
      {bad.push([field(currentState.vars.rmState, "r1"), field(currentState.vars.rmState, "r2")].toSorted((left, right) => byText(fixtureText(left), fixtureText(right))));}});
  assert.deepEqual(bad, [
    ["aborted", "committed"],
    ["aborted", "committed"],
  ]);
  const cut = out.slice(FIRST, out.indexOf("{r1},"));
  assert.throws(
    () => unplacedChartMarks(parseDot(graphText), cut, spec),
    {
      message: `TLC's output ends inside a marked state, so the command cannot tell which rules it breaks:\n${cut.slice(cut.lastIndexOf('<< "chart",'))}\n`,
    },
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart tuple that TLC prints inside one of its messages is not a mark", () => {
  const chart = '<<"chart", <<2>>, {"Bad"}>>';
  const out = [
    chart,
    "@!@!@STARTMSG 2132:1 @!@!@",
    "The first argument of Assert evaluated to FALSE; the second argument was:",
    chart,
    "@!@!@ENDMSG 2132 @!@!@",
    "",
  ].join("\n");
  const marks = [...readMarks(readMessages(out), "chart")];
  const onlyOutsideMessage = 1;
  assert.equal(marks.length, onlyOutsideMessage);
  assert.deepEqual(marks, [...readMarks(readMessages(`${chart}\n`), "chart")]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a line that the spec prints in the shape of a mark is spec output, not a mark", () => {
  const out = [
    '<<"chart", <<2>>, {"Bad"}>>',
    '<< "chart-01234",',
    '   <<2>>, {"Bad"}>>',
    '<<"chart-012", 1>>',
    'x <<"chart-0123", <<2>>, {"Bad"}>>',
    '<< "chart-0123",',
    "   <<3>>,",
    '   {"Bad"} >>',
    "",
  ].join("\n");
  assert.deepEqual(
    [...readMarks(readMessages(out), "chart-0123")],
    // oxlint-disable-next-line eslint/no-magic-numbers -- The valid mark carries the literal 3 in the TLC fixture above.
    [{ broken: ["Bad"], values: [3] }],
  );
});

const inv: Rule = { kind: "invariant", name: "Inv" };

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a wrapped mark with a model value named constructor places on its state", () => {
  const graph = graphOf([["s0", { x: parseValue("constructor") }, true]], []);
  const messages = readMessages('<<"chart",\n<<constructor>>,\n{"Inv"}>>\n');
  const marks = readMarks(messages, "chart");
  const unplaced = mark(graph, marks, { names: ["x"], rules: [inv] });
  assert.equal(unplaced.size, ALL_MARKS_PLACED);
  assert.deepEqual(graph.states.get("s0")?.breaks, [inv]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a tagged line in the wrong shape is an error, not spec output", () => {
  visitItems([
    '<<"chart", [x |-> 1, y |-> 2], {"Inv"}>>',
    '<<"chart", 1>>',
    '<<"chart", <<1>>, <<"Inv">>>>',
    '<<"chart", <<1>>, {1}>>',
    '<<"chart", <<1>>, {"Inv"}, 2>>',
  ], (line) => {assert.throws(
      () => [...readMarks(readMessages(`${line}\n`), "chart")],
      /TLC printed a mark that the command cannot read/u,
      line,
    );});
});
