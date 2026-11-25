// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures await the host filesystem for the corpus configuration and replay paths.
import { readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect the native V8 state used by the rendering fixture.
import v8 from "node:v8";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to evaluate the fixture in the native isolated VM context.
import vm from "node:vm";
import { mermaid } from "#statechart/backends/mermaid.ts";
import { report } from "#statechart/backends/report.ts";
import { readConfig } from "#statechart/frontends/config.ts";
import { readChecks, readSany, readSpec } from "#statechart/frontends/spec.ts";
import { checkView, json } from "#statechart/frontends/view.ts";
import { byText, EC, hasObjectType, hasSection, key, LEVEL, matchesUndefined, show, stateRules, visitItems } from '#statechart/ir.ts';
import type { Bug, Graph, Message, PathStep, Rule, Spec, Trace, Value, Vars, View } from '#statechart/ir.ts';
import { addPast, deadEnds, finder, lasso, mark } from "#statechart/passes/annotate.ts";
import { pathGraph } from "#statechart/passes/paths.ts";
import { bugs, walk } from "#statechart/passes/reach.ts";
import { parseDot } from "#statechart/frontends/dot.ts";
import { parseValue } from "#statechart/frontends/value.ts";
import { readCounterexample, readMarks } from "#statechart/frontends/marks.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { readTrace } from "#statechart/frontends/trace.ts";
import { readVerdict } from "#statechart/frontends/verdict.ts";
import { compile, project } from "#statechart/pipeline.ts";
import { fileExists, fileLines } from "#statechart/run.ts";
import { drawn } from "./drawn.ts";
import { forEachTlcCase } from "./tlc.ts";

const here = import.meta.dirname;
const corpus = (name: string, file: string): string => path.join(here, "corpus", name, file);

const corpusSpec = async (name: string): Promise<Spec> => {
  const configFile = corpus(name, `${name}.cfg`);
  const config = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  const xml = await readFile(corpus(name, "sany.out"), "utf8");
  const sany = readSany(xml);
  const checks = readChecks({ config, configFile });
  return readSpec({ checks, module: name, sany });
};

type StateRow = [id: string, vars: Vars, start?: boolean, breaks?: string[]];
type StepRow = [from: string, to: string, action: string];

const graphOf = (states: StateRow[], steps: StepRow[]): Graph => {
  const graph: Graph = { states: new Map(), steps: [] };
  visitItems(states, ([id, vars, start, breaks = []]) => {
    const rules: Rule[] = [];
    visitItems(breaks, (name) => {rules.push({ kind: "invariant", name });});
    graph.states.set(id, { breaks: rules, start: start ?? false, vars });
  });
  visitItems(steps, ([from, to, action]) => {graph.steps.push({ action, from, to });});
  return graph;
};

const field = (value: Value, name: string): Value => {
  const fieldNotFound = -1;
  assert.ok(hasObjectType(value) && value.kind === "function", `${inspect(value)} is not a function.`);
  const index = value.keys.findIndex((candidate) =>
    candidate === name || (hasObjectType(candidate) && candidate.kind === "model" && candidate.name === name));
  assert.ok(index !== fieldNotFound, `${inspect(value)} has no ${name}.`);
  return value.values[index];
};

const fixtureText = (value: Value): string => {
  assert.ok(!hasObjectType(value), "Chart fixture labels use scalar TLA+ values.");
  return String(value);
};

const SWITCH_OFF = 0;
const SWITCH_ON = 1;
const FIRST = 0;
const LAST = -1;
const NO_CALLS = 0;
const ALL_MARKS_PLACED = 0;
const ONE_CALL = 1;

const countQuestion = (asked: Record<string, number>, question: string): number => {
  const count = (asked[question] ?? NO_CALLS) + ONE_CALL;
  asked[question] = count;
  return count;
};

const draw = function (graph: Graph, view: View, loops: Bug[] = []): { chart: string; report: string } {
  const found = [...bugs(graph), ...loops];
  const { chart, stories } = project(graph, walk(graph), { found, view });
  const spec: Spec = {
    deadlock: false,
    invariants: [],
    module: "Test",
    properties: [],
    variables: [],
    written: [],
  };
  const result = {
    drawing: undefined,
    graph,
    paths: undefined,
    properties: [],
    rules: [],
    spec,
    states: { complete: true, cut: false, distinct: graph.states.size, initial: 1 },
    stop: undefined,
  };
  return { chart: mermaid(chart), report: report(result, { chart, found, stories }) };
};

const marked = (chart: string): Record<string, string> => {
  const out: Record<string, string> = {};
  visitItems(chart.matchAll(/^ {2}class (?<id>s\d+) (?<kind>breaks|mayBreak)$/gmu), (match) => {
    assert.ok(match.groups);
    const { id, kind } = match.groups;
    const label = new RegExp(`^\\s*${id}: (?<label>.*)$`, "mu").exec(chart)?.groups?.label;
    assert.ok(!matchesUndefined(label), `${id} has no label`);
    out[label] = kind;
  });
  return out;
};

const stateJson = (text: string): ReturnType<typeof json> => json(parseValue(text));
const printedValue = (text: string): string => show(parseValue(text));
const numberedState = (variables: Vars): string => `S${fixtureText(variables.n)}`;
const keyStateLabel = (variables: Vars): string => `${fixtureText(variables.pos)}, key ${field(variables.key, "on") === true ? "on" : "off"}`;

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLA+ values reach the view as the skill says: sequences from 1, sets as arrays", () => {
  assert.deepEqual(stateJson('<<1, "a", <<>>>>'), { 1: 1, 2: "a", 3: {} });
  // oxlint-disable-next-line eslint/no-magic-numbers -- Match the TLA+ set literal to its native negative integer output.
  assert.deepEqual(stateJson("{r1, -2}"), ["r1", -2]);
  assert.deepEqual(stateJson("{}"), []);
  // oxlint-disable-next-line eslint/no-magic-numbers -- Assert the expansion of this signed TLA+ range as concrete values.
  assert.deepEqual(stateJson("-1..2"), [-1, 0, 1, 2]);
  assert.deepEqual(stateJson(String.raw`[ok |-> TRUE, msg |-> "say \"hi\""]`), {
    msg: 'say "hi"',
    ok: true,
  });
  assert.deepEqual(stateJson("[]"), {});
  assert.deepEqual(stateJson('(r1 :> "working" @@ r2 :> "aborted")'), {
    r1: "working",
    r2: "aborted",
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a value outside the grammar TLC prints is an error, never a guess", () => {
  visitItems([
    "<<1, 2",
    "<<1 2>>",
    "{1,}",
    "[1 |-> 2]",
    "[a |-> 1,]",
    "[,]",
    "(1 :> 2",
    "1..",
    "1..x",
    String.raw`"\q"`,
    "x y",
    "",
    "SUBSET {1}",
    "[S -> T]",
  ], (text) => {assert.throws(() => parseValue(text), /cannot read TLA\+ value/u, text);});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label prints each value in TLA+, so values that TLC tells apart look apart", () => {
  visitItems([
    '"A"',
    "A",
    "<<0>>",
    '("1" :> 0)',
    "[a |-> 1]",
    "[]",
    "1..3",
    "{1, 2, 3}",
    "<<>>",
    "{}",
    "TRUE",
    '"TRUE"',
    String.raw`"a\nb\tc\"d\\e"`,
    '(<<1, 2>> :> {A, "A"} @@ 0 :> -1)',
  ], (text) => {assert.equal(printedValue(text), text);});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("equal TLA+ values share one key and unequal ones do not, as TLC compares them", () => {
  const same = [
    ["1..3", "{1, 2, 3}"],
    ["1..3", "{3, 1, 2, 2}"],
    ["{1..2, {1, 2}}", "{{1, 2}}"],
    ["{}", "1..0"],
    ["{5}", "5..5"],
    ["{0, 1, 2, 4, 5, 7}", "{7, 4, 5, 2, 1, 0}"],
    ["<<0>>", "(1 :> 0)"],
    ["<<4, 5>>", "(2 :> 5 @@ 1 :> 4)"],
    ["[a |-> 1, b |-> 2]", '("b" :> 2 @@ "a" :> 1)'],
    ["[]", "<< >>"],
    ["{A, B}", "{B, A}"],
    ['{"b", "a"}', '{"a", "b"}'],
  ];
  visitItems(same, ([left, right]) => {assert.equal(key(parseValue(left)), key(parseValue(right)), `${left} = ${right}`);});
  const apart = [
    ['"A"', "A"],
    ["<<0>>", '("1" :> 0)'],
    ["<<>>", "{}"],
    ["1..3", "{1, 2}"],
    ["1..3", "{1, 2, 3, 4}"],
    ["{1, 3}", "1..3"],
    ["TRUE", '"TRUE"'],
    ["1", '"1"'],
    ["<<1, 2>>", '"<<1, 2>>"'],
    ["(2 :> 0)", "<<0>>"],
    ["(0 :> 1 @@ 1 :> 2)", "<<1, 2>>"],
    ["[a |-> 1]", "[a |-> 2]"],
    ["{<<1>>}", "{<<2>>}"],
  ];
  visitItems(apart, ([left, right]) => {assert.notEqual(key(parseValue(left)), key(parseValue(right)), `${left} # ${right}`);});
});

const replay = async function (name: string, graph: Graph): Promise<void> {
  const spec = await corpusSpec(name);
  const names = spec.variables;
  const rules = stateRules(spec);
  const find = finder(graph, names);
  const chartOutput = fileLines(corpus(name, "ChartRun.out"));
  const marks = readMarks(readMessages(chartOutput), "chart");
  const past = mark(graph, marks, { find, names, rules });
  const hasCompleteDrawing = !(await fileExists(corpus(name, "ChartRun.exit")));
  const verdictFiles = await readdir(path.join(here, "corpus", name));
  visitItems(verdictFiles.toSorted(), (file) => {
    if (!/^verdict-\d+\.out$/u.test(file)) {return;}
    const messages = [...readMessages(fileLines(corpus(name, file)))];
    const { broke } = readVerdict(messages);
    if (!broke) {return;}
    const rule = rules.findLast((current) => current.kind === broke.kind && (broke.kind === "deadlock" || current.name === broke.name));
    if (!rule) {return;}
    if (rule.kind === "deadlock" && hasCompleteDrawing && !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT"))
      {deadEnds(graph, rule);}
    const counterexample = readCounterexample(messages);
    if (hasCompleteDrawing || lasso(graph, { loop: undefined, seq: counterexample }, { find, names })) {
      addPast(graph, counterexample, { excludes: hasSection(spec, "ACTION_CONSTRAINT"), find, names, past, rule });
    }
  });
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("each corpus bug path is the shortest way to its rule", async () => {
  const paths: Record<string, string[]> = {};
  await forEachTlcCase(["DieHard", "MediaPlayer", "LoginParallel", "TwoPhase", "FirstRule"], async (name) => {
    const graph = parseDot(fileLines(corpus(name, "graph.dot")));
    await replay(name, graph);
    visitItems(bugs(graph), (bug) => {
      paths[bug.rule.name] = bug.path.map((stepItem) => stepItem.action);
    });
  });
  assert.deepEqual(paths.NotSolved, [
    "FillBig",
    "BigToSmall",
    "EmptySmall",
    "BigToSmall",
    "FillBig",
    "BigToSmall",
  ]);
  assert.deepEqual(paths.LoudWhenStopped, ["YouTurnItUp"]);
  const loginAndTwoPhasePathLength = 5;
  assert.equal(paths.SignedInWhileLocked.length, loginAndTwoPhasePathLength);
  assert.equal(paths.TCConsistent.length, loginAndTwoPhasePathLength);
  assert.equal(paths.TCConsistent.at(LAST), "RMRcvCommitMsg");
  assert.deepEqual(paths.NotOne, ["Next"]);
  assert.deepEqual(paths.NotOneOrThree, ["Next"]);
  assert.deepEqual(paths.AlsoNotOne, ["Next"]);
  assert.deepEqual(paths.NoDeadlock, ["Next", "Next", "Next"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart of only the bug paths words each one with the view, asked once for each state and step", async () => {
  const spec = await corpusSpec("FirstRule");
  const rules = stateRules(spec);
  const pathDrawing = pathGraph(spec.variables);
  const paths: Bug[] = [];
  const verdictFiles = await readdir(path.join(here, "corpus", "FirstRule"));
  visitItems(verdictFiles.toSorted(), (file) => {
    if (!/^verdict-\d+\.out$/u.test(file)) {return;}
    const messages = [...readMessages(fileLines(corpus("FirstRule", file)))];
    const { broke } = readVerdict(messages);
    visitItems(rules, (rule) => {if (broke?.kind === rule.kind && (broke.kind === "deadlock" || rule.name === broke.name))
        {paths.push(pathDrawing.bug(rule, readCounterexample(messages)));}});
  });
  const asked: Record<string, number> = {};
  const view: View = {
    state: (variables) => {
      countQuestion(asked, `state ${fixtureText(variables.x)}`);
      return `x is ${fixtureText(variables.x)}`;
    },
    step: (action, from, to) => {
      countQuestion(asked, `step ${fixtureText(from.x)} to ${fixtureText(to.x)}`);
      return `${action} adds one`;
    },
  };
  const { report: text, files } = compile(
    {
      drawing: undefined,
      exit: 1,
      graph: pathDrawing.graph,
      messages: [],
      paths,
      properties: [],
      rules: [],
      spec: { ...spec, folder: "" },
      states: { complete: true, cut: false, distinct: 1234, initial: 1 },
      stop: undefined,
    },
    checkView(view, inspect),
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

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the graph that parseDot returns keeps none of the text it read", () => {
  v8.setFlagsFromString("--expose-gc");
  const garbageCollect: unknown = vm.runInNewContext("gc");
  // oxlint-disable-next-line rules/force-predicate -- Narrow the VM result at the native host boundary before invoking it.
  assert.ok(typeof garbageCollect === "function", "The VM exposes native garbage collection.");
  const heapUsed = (): number => {
    Reflect.apply(garbageCollect, undefined, []);
    Reflect.apply(garbageCollect, undefined, []);
    return process.memoryUsage().heapUsed;
  };
  const mebibyte = 1_048_576;
  const keptMebibytesLimit = 4;
  const displayDecimalPlaces = 1;
  const stateIdDigits = 18;
  const pieceLines = 1024;
  const commentCharacters = 1020;
  const pieces = 16;
  const dot = function* (): Generator<string, void, unknown> {
    const pieceIndices = Array.from({ length: pieces }, (_value, index) => index);
    // oxlint-disable-next-line rules/no-for-loops -- Generate and release one full text chunk at a time for the heap test.
    for (const pieceIndex of pieceIndices) {
      const id = `-${String(pieceIndex).padStart(stateIdDigits, "7")}`;
      const lines = [
        `${id} [label="n = ${pieceIndex}"];`,
        `${id} -> ${id} [label="StayAtStateNumber${pieceIndex}"];`,
      ];
      while (lines.length < pieceLines) {lines.push(`// ${"x".repeat(commentCharacters)}`);}
      yield* `${lines.join("\n")}\n`.split("\n");
    }
  };
  const before = heapUsed();
  const graph = parseDot(dot());
  const kept = heapUsed() - before;
  assert.equal(graph.states.size, pieces);
  const keptMebibytes = kept / mebibyte;
  assert.ok(keptMebibytes < keptMebibytesLimit, `the graph keeps ${keptMebibytes.toFixed(displayDecimalPlaces)} MiB of ${pieces} MiB read`);
});

const unplacedChartMarks = (graph: Graph, output: string, spec: Spec): ReturnType<typeof mark> => {
  const messages = readMessages(output);
  const marks = readMarks(messages, "chart");
  return mark(graph, marks, { names: spec.variables, rules: stateRules(spec) });
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC's marks place on their states even when TLC wraps them over lines", async () => {
  const spec = await corpusSpec("TwoPhase");
  const out = await readFile(corpus("TwoPhase", "ChartRun.out"), "utf8");
  const graphText = await readFile(corpus("TwoPhase", "graph.dot"), "utf8");
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
    ["a0b0", { a: 0, b: 0 }, true],
    ["a1b1", { a: 1, b: 1 }],
    ["a2b2", { a: 2, b: 2 }, false, ["Safe"]],
  ],
  [
    ["a0b0", "a1b1", "Sync"],
    ["a0b0", "a2b2", "Sync"],
  ],
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

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label codes only the characters that Mermaid reads as syntax, so TLA+ values stay as TLC prints them", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? 'x: "1";\nnext' : "a <b> #2"),
    step: () => 'say: <<1, "a">> :> [k |-> {}] @@ 2..3',
  });
  assert.match(chart, /^ {2}s\d+: a #60;b> #35;2$/mu);
  assert.match(chart, /^ {2}s\d+: x: "1"#59; next$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: say: <<1, "a">> :> \[k \|-> \{\}\] @@ 2\.\.3$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label with %% stays text and cannot open a Mermaid directive", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? "%%{init: {}}%%" : "a %%{ b"),
    step: () => "%% go",
  });
  assert.doesNotMatch(chart, /%%/u);
  assert.match(chart, /^ {2}s\d+: a #37;%\{ b$/mu);
  assert.match(chart, /^ {2}s\d+: #37;%\{init: \{\}\}#37;%$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: #37;% go$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("each line break in a label or a colors key is a space, so it cannot start a chart line", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    colors: { Open: "blue", "Shut\r  s99: Ghost state": "pink" },
    group: (variables) => (variables.n === SWITCH_ON ? "Shut\r  s99: Ghost state" : "Open"),
    state: (variables) => (variables.n === SWITCH_ON ? "b\r\n\r\v\f\u0085\u2028\u2029\tc" : "a"),
    step: () => "go\r  s9: Ghost",
  });
  assert.doesNotMatch(chart, /[\r\v\f\u0085\u2028\u2029\t]/u);
  assert.match(chart, /^ {2}s\d+: b {9}c$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: go {3}s9: Ghost$/mu);
  assert.match(chart, /^ {4}lg1: Shut {3}s99: Ghost state$/mu);
  assert.doesNotMatch(chart, /^\s*s9{1,2}:/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label of only white space or with a lone surrogate still has text in the chart", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? "a\uD800b" : "\t"),
    step: () => " ",
  });
  assert.match(chart, /^ {2}s\d+: #32;$/mu);
  assert.match(chart, /^ {2}s\d+: a#65533;b$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: #32;$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("NUL and C1 controls in a label are left out, since a browser draws their character references as other characters", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["P\0\u0080", "C\u00004Dynamic"] : "\0\u009F"),
    step: () => "a\0\u0080b\u0085c\u009Fd",
  });
  assert.doesNotMatch(chart, /[\0\u0080-\u009F]|#0;|#1[2-5]\d;/u);
  assert.match(chart, /^ {2}s\d+: #32;$/mu);
  assert.match(chart, /^ {2}state "P" as s\d+ \{$/mu);
  assert.match(chart, /^ {4}s\d+: C#52;Dynamic$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: ab cd$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label puts a word joiner inside ﬂ° and ¶ß, since Mermaid decodes a label's text a second time", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["ﬂ\0°lt¶ß", "x"] : "ﬂ°°65¶ßstateß"),
    step: () => "ﬂ ° ¶ ß",
  });
  assert.match(chart, /^ {2}s\d+: ﬂ#8288;#176;#176;65#182;#8288;ßstateß$/mu);
  assert.match(chart, /^ {2}state "ﬂ#8288;#176;lt#182;#8288;ß" as s\d+ \{$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: ﬂ #176; #182; ß$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test('a label puts a word joiner inside marker-end=", since Mermaid rewrites marker-end="url(…# in the drawn SVG', () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ['marker-end="url(p#q', "x"] : 'marker-end="url(a#b'),
    step: () => 'a="b" = "c"',
    title: 'marker-end="url(a#b',
  });
  assert.match(chart, /^title: "marker-end=ﬂ°°8288¶ß\\"url\(aﬂ°°35¶ßb"$/mu);
  assert.match(chart, /^ {2}s\d+: marker-end=#8288;"url\(a#35;b$/mu);
  assert.match(chart, /^ {2}state "marker-end=#8288;#34;url\(p#35;q" as s\d+ \{$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: a="b" = "c"$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a parent or region name with [[fork]], [[join]], or [[choice]] stays text", () => {
  const nested = graphOf(
    [
      ["x", { n: 0 }, true],
      ["y", { n: 1 }],
    ],
    [["x", "y", "Go"]],
  );
  const parents = draw(nested, {
    state: (variables) => [["a [[fork]]", "[[JOIN]]"][Number(variables.n)], "In"],
  }).chart;
  assert.match(parents, /^ {2}state "a #91;\[fork\]\]" as s\d+ \{$/mu);
  assert.match(parents, /^ {2}state "#91;\[JOIN\]\]" as s\d+ \{$/mu);
  const parallel = graphOf(
    [
      ["s0", { x: 0, y: 0 }, true],
      ["s1", { x: 1, y: 0 }],
    ],
    [["s0", "s1", "GoX"]],
  );
  const regions = draw(parallel, {
    // oxlint-disable-next-line eslint/sort-keys -- This fixture assigns the escaped region r0 by declaring it first.
    state: (variables) => ({ "[[choice]]": `X${fixtureText(variables.x)}`, Other: `Y${fixtureText(variables.y)}` }),
  }).chart;
  assert.match(regions, /^ {4}state "#91;\[choice\]\]" as r0 \{$/mu);
  assert.doesNotMatch(parents + regions, /\[\[/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label with C4Container, C4Component, C4Dynamic, or C4Deployment keeps the chart a state diagram", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["C4Component", "C4Deployment"] : "aC4Dynamic"),
    step: () => "C4Container C4Context",
  });
  assert.doesNotMatch(chart, /C4(?:Container|Component|Dynamic|Deployment)/u);
  assert.match(chart, /^ {2}s\d+: aC#52;Dynamic$/mu);
  assert.match(chart, /^ {2}state "C#52;Component" as s\d+ \{$/mu);
  assert.match(chart, /^ {4}s\d+: C#52;Deployment$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: C#52;Container C4Context$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a title with < cannot open an HTML tag that rewrites the chart's quotes", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, { state: (variables) => ["P", `S${fixtureText(variables.n)}`], title: "<a=" });
  assert.doesNotMatch(chart, /</u);
  assert.match(chart, /^title: "ﬂ°°60¶ßa="$/mu);
  assert.match(chart, /^ {2}state "P" as s\d+ \{$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the title writes each character outside the allow list in the form Mermaid decodes in a title", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const title = (titleText: string): string | undefined =>
    /^---\ntitle: (?<title>.*)\n---\n/u.exec(draw(graph, { state: numberedState, title: titleText }).chart)?.groups?.title;
  assert.equal(title("Queue<T> for AT&T"), '"Queueﬂ°°60¶ßT> for ATﬂ°°38¶ßT"');
  assert.equal(title("ﬂ°°65¶ß"), '"ﬂﬂ°°8288¶ßﬂ°°176¶ßﬂ°°176¶ß65ﬂ°°182¶ßﬂ°°8288¶ßß"');
  assert.equal(title('a\0b\u0080\n"c"'), String.raw`"ab \"c\""`);
  const blank = draw(graph, { state: numberedState, title: "\0\0" }).chart;
  assert.doesNotMatch(blank, /\0|^---$|^title:/mu);
  assert.match(blank, /^stateDiagram-v2$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("labels write the space between direction and LR, RL, TB, or BT as #32;", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
      ["s2", { n: 2 }],
      ["s3", { n: 3 }],
    ],
    [
      ["s0", "s1", "Turn"],
      ["s1", "s2", "Back"],
      ["s2", "s3", "Go"],
    ],
  );
  const steps: Record<string, string> = {
    Back: "back direction rl",
    Go: "go",
    Turn: "turn direction LR",
  };
  const { chart } = draw(graph, {
    state: (variables) =>
      ["Idle", "Facing direction TB", "Redirection\tlrx", "Up DIRECTION  BT"][Number(variables.n)],
    step: (actionName) => steps[actionName],
  });
  assert.doesNotMatch(chart, /direction\s+(?:LR|RL|TB|BT)/iu);
  assert.match(chart, /^ {2}s\d+: Facing direction#32;TB$/mu);
  assert.match(chart, /^ {2}s\d+: Redirection#32;lrx$/mu);
  assert.match(chart, /^ {2}s\d+: Up DIRECTION#32;BT$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: turn direction#32;LR$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: back direction#32;rl$/mu);
});

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

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a region named __proto__ is a region like any other", () => {
  const graph = graphOf(
    [
      ["s0", { x: 0, y: 0 }, true],
      ["s1", { x: 1, y: 0 }],
      ["s2", { x: 0, y: 1 }],
    ],
    [
      ["s0", "s1", "GoX"],
      ["s0", "s2", "GoY"],
    ],
  );
  const { chart } = draw(graph, {
    state: (variables): unknown => JSON.parse(`{"__proto__": "X${fixtureText(variables.x)}", "Other": "Y${fixtureText(variables.y)}"}`),
  });
  assert.match(chart, /^ {4}state "#95;#95;proto#95;#95;" as r0 \{$/mu);
  assert.match(chart, /^ {6}s0 --> s1: GoX \[when Y0\]$/mu);
  assert.match(chart, /^ {4}state "Other" as r1 \{$/mu);
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

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a graph of 10,000 states draws in seconds with no view", () => {
  const dimension = 100;
  const millisecondsPerSecond = 1000;
  const durationLimitSeconds = 5;
  const displayDecimalPlaces = 1;
  const { states, steps } = gridRows(dimension);
  const start = performance.now();
  const graph = graphOf(states, steps);
  const { chart, report: text } = draw(graph, {});
  const seconds = (performance.now() - start) / millisecondsPerSecond;
  assert.match(text, /^The shortest path has 198 steps:$/mu);
  assert.equal(chart.match(/^ {2}s\d+: /gmu)?.length, dimension * dimension);
  assert.ok(seconds < durationLimitSeconds, `drawing took ${seconds.toFixed(displayDecimalPlaces)} s`);
});
