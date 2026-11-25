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
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect the native V8 state used by the rendering fixture.
import v8 from "node:v8";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to evaluate the fixture in the native isolated VM context.
import vm from "node:vm";
import { mermaid } from "#statechart/backends/mermaid.ts";
import { report } from "#statechart/backends/report.ts";
import { readConfig } from "#statechart/frontends/config.ts";
import { readChecks, readSany, readSpec } from "#statechart/frontends/spec.ts";
import { checkView, json } from "#statechart/frontends/view.ts";
import { EC, hasObjectType, hasSection, key, LEVEL, matchesUndefined, ruleKey, show, stateRules, visitItems } from '#statechart/ir.ts';
import type { Bug, Graph, Lasso, PathStep, Rule, Spec, State, Step, Value, Vars, View } from '#statechart/ir.ts';
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

const here = path.dirname(fileURLToPath(import.meta.url));
const corpus = (name: string, file: string): string => path.join(here, "corpus", name, file);

const corpusSpec = async (name: string): Promise<Spec> => {
  const configFile = corpus(name, `${name}.cfg`);
  const config = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  return readSpec({
    module: name,
    sany: readSany(await readFile(corpus(name, "sany.out"), "utf8")),
    checks: readChecks({ configFile, config }),
  });
};

type StateRow = [id: string, vars: Vars, start?: boolean, breaks?: string[]];
type StepRow = [from: string, to: string, action: string];

const graphOf = (states: StateRow[], steps: StepRow[]) => {
  const graph: Graph = { states: new Map(), steps: [] };
  visitItems(states, ([id, vars, start, breaks = []]) => {
    const rules: Rule[] = [];
    visitItems(breaks, (name) => {rules.push({ kind: "invariant", name });});
    graph.states.set(id, { vars, start: !!start, breaks: rules });
  });
  visitItems(steps, ([from, to, action]) => {graph.steps.push({ from, to, action });});
  return graph;
};

const lookup = <K, V>(map: ReadonlyMap<K, V>, k: K) => {
  const v = map.get(k);
  assert.ok(!matchesUndefined(v), `${inspect(k)} is missing`);
  return v;
};

const field = (value: Value, name: string) => {
  if (!hasObjectType(value) || value.kind !== "function")
    {throw new Error(`${inspect(value)} is not a function.`);}
  for (let i = 0; i < value.keys.length; i++) {
    const currentValue = value.keys[i];
    if (currentValue === name || (hasObjectType(currentValue) && currentValue.kind === "model" && currentValue.name === name))
      {return value.values[i];}
  }
  throw new Error(`${inspect(value)} has no ${name}.`);
};

const draw = function (graph: Graph, view: View, loops: Bug[] = []) {
  const found = [...bugs(graph), ...loops];
  const { chart, stories } = project(graph, walk(graph), { found, view });
  const spec: Spec = {
    module: "Test",
    variables: [],
    invariants: [],
    properties: [],
    deadlock: false,
    written: [],
  };
  const result = {
    spec,
    graph,
    paths: undefined,
    rules: [],
    properties: [],
    stop: undefined,
    drawing: undefined,
    states: { distinct: graph.states.size, initial: 1, complete: true, cut: false },
  };
  return { chart: mermaid(chart), report: report(result, { chart, found, stories }) };
};

const marked = (chart: string) => {
  const out: Record<string, string> = {};
  visitItems(chart.matchAll(/^ {2}class (s\d+) (breaks|mayBreak)$/gmu), ([, id, cls]) => {
    const label = (new RegExp(`^\\s*${id}: (.*)$`, "m").exec(chart))?.[1];
    assert.ok(!matchesUndefined(label), `${id} has no label`);
    out[label] = cls;
  });
  return out;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLA+ values reach the view as the skill says: sequences from 1, sets as arrays", () => {
  const seen = (text: string) => json(parseValue(text));
  assert.deepEqual(seen('<<1, "a", <<>>>>'), { 1: 1, 2: "a", 3: {} });
  assert.deepEqual(seen("{r1, -2}"), ["r1", -2]);
  assert.deepEqual(seen("{}"), []);
  assert.deepEqual(seen("-1..2"), [-1, 0, 1, 2]);
  assert.deepEqual(seen(String.raw`[ok |-> TRUE, msg |-> "say \"hi\""]`), {
    msg: 'say "hi"',
    ok: true,
  });
  assert.deepEqual(seen("[]"), {});
  assert.deepEqual(seen('(r1 :> "working" @@ r2 :> "aborted")'), {
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
  const shown = (text: string): string => show(parseValue(text));
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
  ], (text) => {assert.equal(shown(text), text);});
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
  visitItems(same, ([a, b]) => {assert.equal(key(parseValue(a)), key(parseValue(b)), `${a} = ${b}`);});
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
  visitItems(apart, ([a, b]) => {assert.notEqual(key(parseValue(a)), key(parseValue(b)), `${a} # ${b}`);});
});

const replay = async function (name: string, graph: Graph): Promise<void> {
  const spec = await corpusSpec(name);
  const names = spec.variables;
  const rules = stateRules(spec);
  const find = finder(graph, names);
  const marks = readMarks(readMessages(fileLines(corpus(name, "ChartRun.out"))), "chart");
  const past = mark(graph, marks, { find, names, rules });
  const drawn = !(await fileExists(corpus(name, "ChartRun.exit")));
  const verdictFiles = await readdir(path.join(here, "corpus", name));
  visitItems(verdictFiles.sort(), (file) => {
    if (!/^verdict-\d+\.out$/u.test(file)) {return;}
    const messages = [...readMessages(fileLines(corpus(name, file)))];
    const { broke } = readVerdict(messages);
    if (!broke) {return;}
    let rule: Rule | undefined;
    visitItems(rules, (currentRule) => {if (currentRule.kind === broke.kind && (broke.kind === "deadlock" || currentRule.name === broke.name)) {rule = currentRule;}});
    if (!rule) {return;}
    if (rule.kind === "deadlock" && drawn && !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT"))
      {deadEnds(graph, rule);}
    const counterexample = readCounterexample(messages);
    if (drawn || lasso(graph, { seq: counterexample, loop: undefined }, { find, names })) {
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
      paths[bug.rule.name] = [];
      for (const stepItem of bug.path) {paths[bug.rule.name].push(stepItem.action);}
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
  assert.equal(paths.SignedInWhileLocked.length, 5);
  assert.equal(paths.TCConsistent.length, 5);
  assert.equal(paths.TCConsistent.at(-1), "RMRcvCommitMsg");
  assert.deepEqual(paths.NotOne, ["Next"]);
  assert.deepEqual(paths.NotOneOrThree, ["Next"]);
  assert.deepEqual(paths.AlsoNotOne, ["Next"]);
  assert.deepEqual(paths.NoDeadlock, ["Next", "Next", "Next"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart of only the bug paths words each one with the view, asked once for each state and step", async () => {
  const spec = await corpusSpec("FirstRule");
  const rules = stateRules(spec);
  const drawn = pathGraph(spec.variables);
  const paths: Bug[] = [];
  const verdictFiles = await readdir(path.join(here, "corpus", "FirstRule"));
  visitItems(verdictFiles.sort(), (file) => {
    if (!/^verdict-\d+\.out$/u.test(file)) {return;}
    const messages = [...readMessages(fileLines(corpus("FirstRule", file)))];
    const { broke } = readVerdict(messages);
    visitItems(rules, (rule) => {if (broke?.kind === rule.kind && (broke.kind === "deadlock" || rule.name === broke.name))
        {paths.push(drawn.bug(rule, readCounterexample(messages)));}});
  });
  const asked: Record<string, number> = {};
  const count = (question: string): number => (asked[question] = (asked[question] ?? 0) + 1);
  const view: View = {
    state: (v) => {
      count(`state ${v.x}`);
      return `x is ${v.x}`;
    },
    step: (action, from, to) => {
      count(`step ${from.x} to ${to.x}`);
      return `${action} adds one`;
    },
  };
  const { report: text, files } = compile(
    {
      spec: { ...spec, folder: "" },
      graph: drawn.graph,
      paths,
      rules: [],
      properties: [],
      exit: 1,
      stop: undefined,
      drawing: undefined,
      states: { distinct: 1234, initial: 1, complete: true, cut: false },
      messages: [],
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
      new RegExp(`^## ${rule} breaks\\n.*\\n0\\. x is 0\\n1\\. Next adds one: x is 1$`, "m"),
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
  const gc: () => void = vm.runInNewContext("gc");
  const heapUsed = (): number => {
    gc();
    gc();
    return process.memoryUsage().heapUsed;
  };
  const MiB = 1 << 20;
  const pieces = 16;
  const dot = function* dot() {
    for (let i = 0; i < pieces; i++) {
      const id = `-${String(i).padStart(18, "7")}`;
      const lines = [
        `${id} [label="n = ${i}"];`,
        `${id} -> ${id} [label="StayAtStateNumber${i}"];`,
      ];
      while (lines.length < 1024) {lines.push(`// ${"x".repeat(1020)}`);}
      yield* `${lines.join("\n")}\n`.split("\n");
    }
  };
  const before = heapUsed();
  const graph = parseDot(dot());
  const kept = heapUsed() - before;
  assert.equal(graph.states.size, pieces);
  assert.ok(kept < 4 * MiB, `the graph keeps ${(kept / MiB).toFixed(1)} MiB of ${pieces} MiB read`);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TLC's marks place on their states even when TLC wraps them over lines", async () => {
  const spec = await corpusSpec("TwoPhase");
  const out = await readFile(corpus("TwoPhase", "ChartRun.out"), "utf8");
  const graphText = await readFile(corpus("TwoPhase", "graph.dot"), "utf8");
  const graph = parseDot(graphText);
  assert.equal(
    mark(graph, readMarks(readMessages(out), "chart"), { names: spec.variables, rules: stateRules(spec) }).size,
    0,
  );
  const bad: Value[][] = [];
  visitItems(graph.states.values(), (currentState) => {if (currentState.breaks.length)
      {bad.push([field(currentState.vars.rmState, "r1"), field(currentState.vars.rmState, "r2")].sort());}});
  assert.deepEqual(bad, [
    ["aborted", "committed"],
    ["aborted", "committed"],
  ]);
  const cut = out.slice(0, out.indexOf("{r1},"));
  assert.throws(
    () =>
      mark(
        parseDot(graphText),
        readMarks(readMessages(cut), "chart"),
        { names: spec.variables, rules: stateRules(spec) },
      ),
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
  assert.equal(marks.length, 1);
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
    [{ broken: ["Bad"], values: [3] }],
  );
});

const inv: Rule = { kind: "invariant", name: "Inv" };

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a wrapped mark with a model value named constructor places on its state", () => {
  const graph = graphOf([["s0", { x: parseValue("constructor") }, true]], []);
  assert.equal(
    mark(
      graph,
      readMarks(readMessages('<<"chart",\n<<constructor>>,\n{"Inv"}>>\n'), "chart"),
      { names: ["x"], rules: [inv] },
    ).size,
    0,
  );
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

const ab: View = { state: (v) => ({ A: `a${v.a}`, B: `b${v.b}` }) };
const bit = (v: Vars): string => `${v.a}${v.b}${v.c}`;
const xorStates: StateRow[] = [];
const xorSteps: StepRow[] = [];
visitItems([0, 1], (a) => {visitItems([0, 1], (b) => {for (const c of [0, 1]) {
      const v = { a, b, c };
      xorStates.push([bit(v), v, a === 0]);
      if (a === 0 && b !== c) {xorSteps.push([bit(v), bit({ ...v, a: 1 }), "Go"]);}
      if (b === 0) {xorSteps.push([bit(v), bit({ ...v, b: 1 }), "FlipB"]);}
      if (c === 0) {xorSteps.push([bit(v), bit({ ...v, c: 1 }), "FlipC"]);}
    }});});
const truthGraphs: Record<string, [Graph, View]> = {
  starts: [
    graphOf(
      [
        ["x0y0", { x: 0, y: 0 }, true],
        ["x1y1", { x: 1, y: 1 }, true],
        ["x1y0", { x: 1, y: 0 }],
      ],
      [["x0y0", "x1y0", "Step"]],
    ),
    { state: (v) => ({ X: `x${v.x}`, Y: `y${v.y}` }) },
  ],
  xor: [
    graphOf(xorStates, xorSteps),
    { state: (v) => ({ A: `a${v.a}`, B: `b${v.b}`, C: `c${v.c}` }) },
  ],
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
  const answer = (question: string) => {
    asked[question] = (asked[question] ?? 0) + 1;
    return asked[question] === 1 ? "first" : "later";
  };
  const { chart, report: text } = draw(forkToBug, {
    state: (v) => {
      const word = answer(`state ${v.a}`);
      return { A: `a${v.a} ${word}`, B: `b${v.b}` };
    },
    step: (action, from, to) => `${action} ${answer(`step ${from.a} to ${to.a}`)}`,
    group: (v) => (answer(`group ${v.a}`) === "first" ? "Calm" : "Busy"),
    colors: { Calm: "blue", Busy: "orange" },
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
  const flat = draw(graph, { state: (v) => `x${v.x}` });
  assert.match(flat.chart, /^ {2}(s\d+) --> \1: Tick$/mu);
  assert.doesNotMatch(flat.report, /does not draw/u);
  const regions = draw(graph, { state: (v) => ({ X: `x${v.x}`, Z: "z" }) });
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
  const { chart } = draw(graph, { state: (v) => String(v.at).split(".") });
  const open = (/^ {2}state "Open" as (s\d+) \{$/mu.exec(chart))?.[1];
  const closed = (/^ {2}(s\d+): Closed$/mu.exec(chart))?.[1];
  const quits = Array.from(
    chart.matchAll(/^ {2}(s\d+) --> (s\d+): Quit$/gmu),
    (match) => [match[1], match[2]],
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
  const { chart } = draw(graph, { state: (v) => String(v.at).split(".") });
  assert.deepEqual(drawn(chart).arrows.sort(), [
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
  const { chart } = draw(graph, { state: (v) => String(v.at).split(".") });
  assert.deepEqual(drawn(chart).arrows.sort(), ["A --> B: Go", "A --> p: Left", "B --> q: Right"]);
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
    state: (v) => (v.n ? 'x: "1";\nnext' : "a <b> #2"),
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
    state: (v) => (v.n ? "%%{init: {}}%%" : "a %%{ b"),
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
    state: (v) => (v.n ? "b\r\n\r\v\f\u0085\u2028\u2029\tc" : "a"),
    step: () => "go\r  s9: Ghost",
    group: (v) => (v.n ? "Shut\r  s99: Ghost state" : "Open"),
    colors: { Open: "blue", "Shut\r  s99: Ghost state": "pink" },
  });
  assert.doesNotMatch(chart, /[\r\v\f\u0085\u2028\u2029\t]/);
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
    state: (v) => (v.n ? "a\uD800b" : "\t"),
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
    state: (v) => (v.n ? ["P\0\u0080", "C\u00004Dynamic"] : "\0\x9F"),
    step: () => "a\0\x80b\x85c\x9Fd",
  });
  assert.doesNotMatch(chart, /[\0\x80-\x9F]|#0;|#1[2-5]\d;/u);
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
    state: (v) => (v.n ? ["ﬂ\0°lt¶ß", "x"] : "ﬂ°°65¶ßstateß"),
    step: () => "ﬂ ° ¶ ß",
  });
  assert.match(chart, /^ {2}s\d+: ﬂ#8288;#176;#176;65#182;#8288;ßstateß$/m);
  assert.match(chart, /^ {2}state "ﬂ#8288;#176;lt#182;#8288;ß" as s\d+ \{$/m);
  assert.match(chart, /^ {2}s\d+ --> s\d+: ﬂ #176; #182; ß$/m);
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
    title: 'marker-end="url(a#b',
    state: (v) => (v.n ? ['marker-end="url(p#q', "x"] : 'marker-end="url(a#b'),
    step: () => 'a="b" = "c"',
  });
  assert.match(chart, /^title: "marker-end=ﬂ°°8288¶ß\\"url\(aﬂ°°35¶ßb"$/m);
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
    state: (v) => [["a [[fork]]", "[[JOIN]]"][Number(v.n)], "In"],
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
    state: (v) => ({ "[[choice]]": `X${v.x}`, Other: `Y${v.y}` }),
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
    state: (v) => (v.n ? ["C4Component", "C4Deployment"] : "aC4Dynamic"),
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
  const { chart } = draw(graph, { title: "<a=", state: (v) => ["P", `S${v.n}`] });
  assert.doesNotMatch(chart, /</u);
  assert.match(chart, /^title: "ﬂ°°60¶ßa="$/m);
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
  const state = (v: Vars): string => `S${v.n}`;
  const title = (t: string): string | undefined =>
    (/^---\ntitle: (.*)\n---\n/.exec(draw(graph, { title: t, state }).chart))?.[1];
  assert.equal(title("Queue<T> for AT&T"), '"Queueﬂ°°60¶ßT> for ATﬂ°°38¶ßT"');
  assert.equal(title("ﬂ°°65¶ß"), '"ﬂﬂ°°8288¶ßﬂ°°176¶ßﬂ°°176¶ß65ﬂ°°182¶ßﬂ°°8288¶ßß"');
  assert.equal(title('a\0b\u0080\n"c"'), String.raw`"ab \"c\""`);
  const blank = draw(graph, { title: "\0\0", state }).chart;
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
    Turn: "turn direction LR",
    Back: "back direction rl",
    Go: "go",
  };
  const { chart } = draw(graph, {
    state: (v) =>
      ["Idle", "Facing direction TB", "Redirection\tlrx", "Up DIRECTION  BT"][Number(v.n)],
    step: (a) => steps[a],
  });
  assert.doesNotMatch(chart, /direction\s+(?:LR|RL|TB|BT)/i);
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
    () => draw(graph, { state: (v) => String(v.x).split(".") }),
    /both as a state and as a parent state/u,
  );
  assert.throws(
    () => draw(graph, { state: (v) => (v.x === "A" ? { R: "x" } : { S: "y" }) }),
    /Return the same regions for every state/u,
  );
  assert.throws(() => draw(graph, { state: () => [] }), /Return a string, an array of strings/u);
});

const keyGraph = () =>
  graphOf(
    [
      ["idle", { pos: "idle", key: parseValue("[on |-> FALSE, at |-> 0]") }, true],
      ["waitKeyOff", { pos: "wait", key: parseValue("[on |-> FALSE, at |-> 0]") }],
      ["waitKeyOn", { pos: "wait", key: parseValue("[on |-> TRUE, at |-> 0]") }],
      ["done", { pos: "done", key: parseValue("[on |-> TRUE, at |-> 0]") }],
    ],
    [
      ["idle", "waitKeyOff", "Go"],
      ["idle", "waitKeyOn", "GoKey"],
      ["waitKeyOff", "waitKeyOff", "Tick"],
      ["waitKeyOff", "idle", "Back"],
      ["waitKeyOn", "done", "Open"],
    ],
  );
const keyState = (header: string, pos: string) => ({
  code: EC.TLC_STATE_PRINT2,
  level: LEVEL.STATE,
  body: [header, `/\\ pos = "${pos}"`, String.raw`/\ key = [at |-> 0, on |-> FALSE]`, ""],
});
const keyTrace = () =>
  readTrace([
    keyState("1: <Initial predicate>", "idle"),
    keyState("2: <Go line 9, col 3 to line 9, col 20 of module Key>", "wait"),
    { code: EC.TLC_STATE_PRINT3, level: LEVEL.STATE, body: ["3: Stuttering"] },
  ]);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a loop's trace finds its states when TLC prints record fields in another order", () => {
  const graph = keyGraph();
  const bug = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(bug);
  assert.equal(bug.start, "idle");
  const moves = bug.path.map((part) => [part.action, part.state]);
  assert.deepEqual(moves, [["Go", "waitKeyOff"]]);
  assert.equal(bug.loop, 1);
  assert.equal(bug.stutters, true);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a view may hide a step inside a loop, but not a step out of it", () => {
  const graph = keyGraph();
  const found = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(found);
  const loop: Bug = { rule: { kind: "property", name: "Opens" }, ...found };
  const state = (v: Vars): string => `${v.pos}, key ${field(v.key, "on") ? "on" : "off"}`;
  const { report } = draw(graph, { state, step: (a) => (a === "Tick" ? null : a) }, [loop]);
  assert.match(report, /^The run stops in "wait, key off" forever\.$/mu);
  assert.throws(
    () => draw(graph, { state, step: (a) => (a === "Back" ? null : a) }, [loop]),
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
  const path: PathStep[] = [];
  for (const [from, to] of ["ab", "ba", "ac", "ca"]) {
    let step: Step | undefined;
    for (const currentStep of graph.steps)
      {if (currentStep.from === from && currentStep.to === to) {
        step = currentStep;
        break;
      }}
    assert.ok(step);
    path.push({ action: step.action, state: to, step });
  }
  const loop: Bug = {
    rule: { kind: "property", name: "Settles" },
    start: "a",
    path,
    loop: 0,
    stutters: false,
  };
  const { report } = draw(graph, { state: (v) => v.pos }, [loop]);
  assert.match(report, /^The run loops through "a", "b" and "c" forever\.$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a chart that draws a way out of a loop that the loop cannot take stops the command", () => {
  const graph = keyGraph();
  const found = lasso(graph, keyTrace(), { names: ["pos", "key"] });
  assert.ok(found);
  const loop: Bug = { rule: { kind: "property", name: "Opens" }, ...found };
  assert.throws(
    () => draw(graph, { state: (v) => v.pos }, [loop]),
    /draws the step Open out of wait, but the Opens loop cannot take it there/u,
  );
  const { chart } = draw(
    graph,
    { state: (v) => `${v.pos}, key ${field(v.key, "on") ? "on" : "off"}` },
    [loop],
  );
  const wait = (/^ {2}(s\d+): wait, key off$/mu.exec(chart))?.[1];
  assert.match(chart, new RegExp(`^ {2}class ${wait} repeats$`, "m"));
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
    state: (v): unknown => JSON.parse(`{"__proto__": "X${v.x}", "Other": "Y${v.y}"}`),
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
      state: (v: Vars) => v.x,
      step: (a: string) => a,
      group: () => "Busy",
      colors: { Busy: "blue" },
      title: "T",
    },
    inspect,
  );
  assert.throws(() => checkView({ colors: null }, inspect), /\bcolors\b[\s\S]*\bobject\b/);
  assert.throws(() => checkView({ colors: ["blue"] }, inspect), /\bcolors\b[\s\S]*\bobject\b/);
  assert.throws(() => checkView({ state: "Busy" }, inspect), /\bstate\b[\s\S]*\bfunction\b/);
  assert.throws(
    () => checkView({ colors: { Busy: "red", Idle: "repeats", Done: "tan" } }, inspect),
    (error: unknown) =>
      error instanceof Error &&
      /\bBusy\b[\s\S]*"red"/.test(error.message) &&
      /\bIdle\b[\s\S]*"repeats"/.test(error.message) &&
      !/\bDone\b/u.test(error.message),
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a group named like an Object method still needs its own color", () => {
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  assert.throws(
    () => draw(graph, checkView({ group: () => "toString", colors: {} }, inspect)),
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
        { colors: { Lost: Number.NaN, Far: Infinity, Big: BigInt("7"), Boxed: new String("blue"), Loop: loop } },
        inspect,
      ),
    /"Lost" the color NaN, "Far" the color Infinity, "Big" the color 7n, "Boxed" the color \[String: 'blue'\] and "Loop" the color <ref \*1> \{ self: \[Circular \*1\] \}\./u,
  );
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  assert.throws(
    () => draw(graph, checkView({ group: () => Number.NaN, colors: {} }, inspect)),
    /group\(\) returned NaN,/u,
  );
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("checkView takes colors only as a plain object", () => {
  const bare: object = Object.create(null);
  checkView({ colors: Object.assign(bare, { Busy: "blue" }) }, inspect);
  const inherited: object = Object.create({ Busy: "blue" });
  visitItems([new Map([["Busy", "blue"]]), inherited, new String("blue")], (colors) => {assert.throws(() => checkView({ colors }, inspect), {
      message: "The view's colors must be a plain object.",
    });});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the chart uses the colors that checkView read once from the view's own keys", () => {
  const graph = graphOf([["s0", { x: 0 }, true]], []);
  let reads = 0;
  const flips = {
    get Busy() {
      reads += 1;
      return reads === 1 ? "blue" : "breaks";
    },
  };
  const changed = { Busy: "blue" };
  const changes = (): string => {
    changed.Busy = "breaks";
    return "Busy";
  };
  visitItems([
    { group: () => "Busy", colors: flips },
    { group: changes, colors: changed },
  ], (view) => {
    const { chart } = draw(graph, checkView(view, inspect));
    assert.match(chart, /^ {2}class s\d+ blue$/mu);
    assert.doesNotMatch(chart, /\bbreaks\b/u);
  });
  const hidden = Object.defineProperty({}, "Busy", { value: "breaks" });
  assert.throws(
    () => draw(graph, checkView({ group: () => "Busy", colors: hidden }, inspect)),
    /group\(\) returned "Busy", which colors does not name/u,
  );
  const key = Symbol("Busy");
  assert.throws(
    () => draw(graph, checkView({ group: () => key, colors: { [key]: "breaks" } }, inspect)),
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
    state: () => "Same",
    group: (v) => (v.x ? "B" : "A"),
    colors: { A: "blue", B: "teal", undefined: "pink" },
  };
  assert.doesNotMatch(draw(graph, view).chart, /^ {2}class /mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a graph of 10,000 states draws in seconds with no view", () => {
  const n = 100;
  const states: StateRow[] = [];
  const steps: StepRow[] = [];
  for (let x = 0; x < n; x++)
    {for (let y = 0; y < n; y++) {
      const far = x === n - 1 && y === n - 1;
      states.push([`${x},${y}`, { x, y }, x + y === 0, far ? ["Safe"] : []]);
      if (x + 1 < n) {steps.push([`${x},${y}`, `${x + 1},${y}`, "Right"]);}
      if (y + 1 < n) {steps.push([`${x},${y}`, `${x},${y + 1}`, "Down"]);}
    }}
  const start = performance.now();
  const { chart, report: text } = draw(graphOf(states, steps), {});
  const seconds = (performance.now() - start) / 1000;
  assert.match(text, /^The shortest path has 198 steps:$/mu);
  assert.equal(chart.match(/^ {2}s\d+: /gmu)?.length, n * n);
  assert.ok(seconds < 5, `drawing took ${seconds.toFixed(1)} s`);
});
