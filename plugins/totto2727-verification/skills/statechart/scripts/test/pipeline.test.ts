// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "#statechart/frontends/view.ts";
import { EC, isString, LEVEL, stateRules, visitItems } from '#statechart/ir.ts';
import type { CheckResult, Rule, Spec, Verdict } from '#statechart/ir.ts';
import { compile } from "#statechart/pipeline.ts";
import { assertHasEntries, codeOf, loads, sources, typeImports } from "./pipeline-imports.test-helper.ts";
import { inOrder } from "./serial-test-io.ts";

const RUNTIME =
  /\b(?:process|require|globalThis|global|Deno|Bun|Buffer|setImmediate|clearImmediate|fetch)\b|\bimport\s*\(/gu;
// oxlint-disable-next-line unicorn/no-null -- RegExp.match returns null when the independent sources contain none of these runtime APIs.
const NO_RUNTIME_NAME = null;

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("ir.ts imports nothing", async () => {
  assert.deepEqual(await loads("ir.ts"), []);
  assert.deepEqual(await typeImports("ir.ts"), []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("each pass imports only ir.ts", async () => {
  const files = await sources("passes");
  assert.deepEqual(files.filter((file) => !file.endsWith(".ts")), []);
  const found = await loads("passes");
  assertHasEntries(found);
  found.forEach(([from, to]) => {assert.equal(to, "ir.ts", `${from} imports ${to}`);});
  await inOrder(files, async (file) => {
    const imported = await typeImports(file);
    imported.forEach((to) => {assert.equal(to, "ir.ts", `${file} imports types from ${to}`);});
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("pipeline.ts reaches no node: module", async () => {
  const imported = await loads("pipeline.ts");
  assert.deepEqual(imported.filter(([, to]) => to.startsWith("node:")), []);
  const typed = await typeImports("pipeline.ts");
  typed.forEach((to) => {assert.equal(to, "ir.ts", `pipeline.ts imports types from ${to}`);});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("ir.ts, the passes, pipeline.ts, the frontends, the backends, and every file they load are .ts files that name no listed runtime global and call no import()", async () => {
  const targets = ["ir.ts", "passes", "pipeline.ts", "frontends", "backends"];
  const imported = await loads(...targets);
  const reached = imported.flatMap(([, to]) => to.startsWith("node:") ? [] : [to]);
  const groupedFiles = await inOrder(targets, sources);
  const current = groupedFiles.flat();
  const paths = [...new Set([...current, ...reached])];
  assert.deepEqual(paths.filter((file) => !file.endsWith(".ts")), []);
  await inOrder(paths, async (file) => {
    const source = await codeOf(file);
    assert.deepEqual(source.match(RUNTIME), NO_RUNTIME_NAME, file);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("no frontend or backend loads a node: module when imported, even through another file", async () => {
  await inOrder(["frontends", "backends"], async (folder) => {
    const discovered = await sources(folder);
    const files = discovered.filter((file) => file.endsWith(".ts"));
    assertHasEntries(files, folder);
    await inOrder(files, async (file) => {
      const imports = await loads(file);
      imports.forEach(([, to]) => {assert.ok(!to.startsWith("node:"), `${file} reaches ${to}`);});
    });
  });
});

const CHECK_PASSED = 0;
const CHECK_VIOLATION = 1;

const small: Rule = { kind: "invariant", name: "Small" };

const noView = checkView({}, inspect);

const holding = (spec: Spec): Verdict[] => {
  const verdicts: Verdict[] = [];
  visitItems(stateRules(spec), (rule) => {verdicts.push({ messages: undefined, outcome: "holds", rule });});
  return verdicts;
};

const twoStates = (breaks: Rule[], property = "Settles"): CheckResult => ({
  drawing: undefined,
  exit: breaks.length ? CHECK_VIOLATION : CHECK_PASSED,
  graph: {
    states: new Map([
      ["1", { breaks: [], start: true, vars: { x: 0 } }],
      ["2", { breaks, start: false, vars: { x: 1 } }],
    ]),
    steps: [{ action: "Grow", from: "1", to: "2" }],
  },
  messages: [{ body: ["Finished in 394ms at (T)"], code: EC.TLC_FINISHED, level: LEVEL.NONE }],
  paths: undefined,
  properties: [
    {
      bug: undefined,
      initialOnly: false,
      messages: [
        {
          body: ["1: <Initial predicate>", "x = 0"],
          code: EC.TLC_STATE_PRINT2,
          level: LEVEL.STATE,
        },
      ],
      outcome: breaks.length ? "broken" : "holds",
      rule: { kind: "property", name: property },
    },
  ],
  rules: [{ messages: undefined, outcome: breaks.length ? "broken" : "holds", rule: small }],
  spec: {
    deadlock: false,
    folder: "",
    invariants: ["Small"],
    module: "Two",
    properties: [property],
    variables: ["x"],
    written: [],
  },
  states: { complete: true, cut: false, distinct: 2, initial: 1 },
  stop: undefined,
});

const body = (files: Map<string, Iterable<string | Uint8Array>>, name: string): string => {
  const text: string[] = [];
  visitItems(files.get(name) ?? [], (part) => {text.push(isString(part) ? part : new TextDecoder().decode(part));});
  return text.join("");
};

const checkHolds = (): void => {
  const holds = compile(twoStates([]), noView);
  assert.equal(holds.exit, CHECK_PASSED);
  assert.deepEqual([...holds.files.keys()], ["chart.mmd", "report.md", "tlc.out"]);
  assert.match(holds.report, /^## Rules that hold\nSmall, Settles$/mu);
  assert.doesNotMatch(body(holds.files, "chart.mmd"), /breaks/u);
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the pipeline turns a hand-built graph into the out folder's files with no TLC", () => {
  const broken = compile(twoStates([small]), noView);
  assert.equal(broken.exit, CHECK_VIOLATION);
  assert.deepEqual(
    [...broken.files.keys()],
    ["chart.mmd", "report.md", "tlc.out", "tlc-Settles.out"],
  );
  assert.equal(body(broken.files, "report.md"), broken.report);
  assert.equal(body(broken.files, "tlc.out"), "Finished in 00s at (T)\n");
  assert.equal(body(broken.files, "tlc-Settles.out"), "State 1: <Initial predicate>\nx = 0\n");
  assert.equal(
    broken.report,
    [
      "# Two",
      "",
      "TLC reached 2 states and 1 steps. The chart draws 2 states and 1 arrows.",
      "",
      "## Small breaks",
      "The shortest path has 1 step:",
      "0. 0",
      "1. Grow: 1",
      "",
      "## Settles breaks",
      "TLC found a counterexample. It is in tlc-Settles.out.",
    ].join("\n"),
  );
  assert.match(
    body(broken.files, "chart.mmd"),
    /^ {2}(?<from>s\d+) --> (?<to>s\d+): Grow\n[\s\S]*^ {2}class \k<to> breaks$/mu,
  );

  checkHolds();
});

const FIRST_LOOP_POSITION = 1;

const reportWithSmallProperty = (breaks: Rule[]): string => {
  const result = twoStates(breaks);
  const [step] = result.graph.steps;
  result.spec.properties = ["Small"];
  result.properties = [
    {
      bug: { loop: FIRST_LOOP_POSITION, path: [{ action: "Grow", state: "2", step }], start: "1", stutters: true },
      initialOnly: false,
      messages: [],
      outcome: "broken",
      rule: { kind: "property", name: "Small" },
    },
  ];
  return compile(result, noView).report;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an invariant and a property with one name stay two rules", () => {
  const both = reportWithSmallProperty([small]);
  assert.match(both, /^## Small breaks\nThe shortest path has 1 step:$/mu);
  assert.match(
    both,
    /^## Small breaks\nTLC's counterexample is in tlc-Small\.out\. It has 1 step:$/mu,
  );
  assert.match(reportWithSmallProperty([]), /^## Rules that hold\nSmall$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a PROPERTY that breaks with no path writes TLC's counterexample", () => {
  const result = twoStates([]);
  result.properties[0].outcome = "broken";
  const { report, files } = compile(result, noView);
  assert.match(
    report,
    /^## Settles breaks\nTLC found a counterexample\. It is in tlc-Settles\.out\.$/mu,
  );
  assert.equal(body(files, "tlc-Settles.out"), "State 1: <Initial predicate>\nx = 0\n");
});

const holdsWithDeadlock = (result: CheckResult): string | undefined => {
  result.spec.deadlock = true;
  result.rules = holding(result.spec);
  return /^## Rules that hold\n(?<rules>.*)$/mu.exec(compile(result, noView).report)?.groups?.rules;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule named NoDeadlock leaves the deadlock rule a name of its own", () => {
  const invariant = twoStates([]);
  invariant.spec.invariants = ["NoDeadlock"];
  assert.equal(holdsWithDeadlock(invariant), "NoDeadlock, CHECK_DEADLOCK, Settles");
  assert.equal(holdsWithDeadlock(twoStates([], "NoDeadlock")), "Small, CHECK_DEADLOCK, NoDeadlock");
  assert.equal(holdsWithDeadlock(twoStates([])), "Small, NoDeadlock, Settles");
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a run that does not check for deadlock never names CHECK_DEADLOCK", () => {
  const invariant = twoStates([]);
  invariant.spec.invariants = ["Small", "NoDeadlock"];
  visitItems([invariant, twoStates([], "NoDeadlock")], (result) => {
    result.rules = holding(result.spec);
    assert.doesNotMatch(compile(result, noView).report, /CHECK_DEADLOCK/u);
  });
});
