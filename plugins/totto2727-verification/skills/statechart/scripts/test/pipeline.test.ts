// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { execFileSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Node resolves type-only imports from each file for the dependency boundary test.
import { createRequire } from "node:module";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { fileURLToPath, pathToFileURL } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "#statechart/frontends/view.ts";
import { EC, isString, LEVEL, stateRules, visitItems } from '#statechart/ir.ts';
import type { CheckResult, Rule, Spec, Verdict } from '#statechart/ir.ts';
import { compile } from "#statechart/pipeline.ts";

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const sources = (target: string): string[] => {
  const full = path.join(scripts, target);
  if (!fs.statSync(full).isDirectory()) {return [target];}
  return fs
    .readdirSync(full, { encoding: "utf8", recursive: true })
    .map((entry) => path.join(target, entry))
    .filter((file) => fs.statSync(path.join(scripts, file)).isFile());
};

const RECORD = `
import { registerHooks } from "node:module";
const edges = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (context.parentURL !== import.meta.url) edges.push([context.parentURL, resolved.url]);
    return resolved;
  },
});
for (const url of process.argv.slice(1)) await import(url);
console.log(JSON.stringify(edges));
`;
const loads = (...targets: string[]) => {
  const urls = targets.flatMap(sources).map((file) => pathToFileURL(path.join(scripts, file)).href);
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", RECORD, ...urls], {
    encoding: "utf8",
  });
  const name = (url: string): string =>
    url.startsWith("file:") ? path.relative(scripts, fileURLToPath(url)) : url;
  return (JSON.parse(out) as string[][]).map(([from, to]) => [name(from), name(to)]);
};

const COMMENT =
  /("(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const codeOf = (file: string): string =>
  fs.readFileSync(path.join(scripts, file), "utf8").replaceAll(COMMENT, (_, text) => text ?? " ");

const RUNTIME =
  /\b(?:process|require|globalThis|global|Deno|Bun|Buffer|setImmediate|clearImmediate|fetch)\b|\bimport\s*\(/gu;
const TYPE_IMPORT =
  /\b(?:import|export)\s+type\b\s*(?:[\w$]+|\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']*)["']/g;
const typeImports = (file: string): string[] => {
  const resolveFromFile = createRequire(path.join(scripts, file)).resolve;
  return Array.from(codeOf(file).matchAll(TYPE_IMPORT), (match) => {
    const resolved = resolveFromFile(match[1]);
    return path.isAbsolute(resolved) ? path.relative(scripts, resolved) : resolved;
  });
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("ir.ts imports nothing", () => {
  assert.deepEqual(loads("ir.ts"), []);
  assert.deepEqual(typeImports("ir.ts"), []);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("each pass imports only ir.ts", () => {
  const files = sources("passes");
  assert.deepEqual(
    files.filter((file) => !file.endsWith(".ts")),
    [],
  );
  const found = loads("passes");
  assert.ok(found.length > 0);
  visitItems(found, ([from, to]) => {assert.equal(to, "ir.ts", `${from} imports ${to}`);});
  visitItems(files, (file) => {visitItems(typeImports(file), (to) => {assert.equal(to, "ir.ts", `${file} imports types from ${to}`);});});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("pipeline.ts reaches no node: module", () => {
  assert.deepEqual(
    loads("pipeline.ts").filter(([, to]) => to.startsWith("node:")),
    [],
  );
  visitItems(typeImports("pipeline.ts"), (to) => {assert.equal(to, "ir.ts", `pipeline.ts imports types from ${to}`);});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("ir.ts, the passes, pipeline.ts, the frontends, the backends, and every file they load are .ts files that name no listed runtime global and call no import()", () => {
  const targets = ["ir.ts", "passes", "pipeline.ts", "frontends", "backends"];
  const reached = loads(...targets).flatMap(([, to]) => (to.startsWith("node:") ? [] : [to]));
  const files = [...new Set([...targets.flatMap(sources), ...reached])];
  assert.deepEqual(
    files.filter((file) => !file.endsWith(".ts")),
    [],
  );
  visitItems(files, (file) => {assert.deepEqual(codeOf(file).match(RUNTIME), null, file);});
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("no frontend or backend loads a node: module when imported, even through another file", () => {
  visitItems(["frontends", "backends"], (folder) => {
    const files = fs
      .readdirSync(path.join(scripts, folder), { encoding: "utf8", recursive: true })
      .filter((fileName) => fileName.endsWith(".ts"));
    assert.ok(files.length > 0, folder);
    visitItems(files, (currentFile) => {for (const [, to] of loads(path.join(folder, currentFile)))
        {assert.ok(!to.startsWith("node:"), `${folder}/${currentFile} reaches ${to}`);}});
  });
});

const small: Rule = { kind: "invariant", name: "Small" };

const noView = checkView({}, inspect);

const holding = (spec: Spec) => {
  const verdicts: Verdict[] = [];
  visitItems(stateRules(spec), (rule) => {verdicts.push({ rule, outcome: "holds", messages: undefined });});
  return verdicts;
};

const twoStates = (breaks: Rule[], property = "Settles"): CheckResult => ({
  spec: {
    module: "Two",
    variables: ["x"],
    invariants: ["Small"],
    properties: [property],
    deadlock: false,
    written: [],
    folder: "",
  },
  paths: undefined,
  graph: {
    states: new Map([
      ["1", { vars: { x: 0 }, start: true, breaks: [] }],
      ["2", { vars: { x: 1 }, start: false, breaks }],
    ]),
    steps: [{ from: "1", to: "2", action: "Grow" }],
  },
  rules: [{ rule: small, outcome: breaks.length ? "broken" : "holds", messages: undefined }],
  properties: [
    {
      rule: { kind: "property", name: property },
      outcome: breaks.length ? "broken" : "holds",
      messages: [
        {
          code: EC.TLC_STATE_PRINT2,
          level: LEVEL.STATE,
          body: ["1: <Initial predicate>", "x = 0"],
        },
      ],
      bug: undefined,
      initialOnly: false,
    },
  ],
  exit: breaks.length ? 1 : 0,
  stop: undefined,
  drawing: undefined,
  states: { distinct: 2, initial: 1, complete: true, cut: false },
  messages: [{ code: EC.TLC_FINISHED, level: LEVEL.NONE, body: ["Finished in 394ms at (T)"] }],
});

const body = (files: Map<string, Iterable<string | Uint8Array>>, name: string): string => {
  let text = "";
  visitItems(files.get(name) ?? [], (part) => {text += isString(part) ? part : new TextDecoder().decode(part);});
  return text;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the pipeline turns a hand-built graph into the out folder's files with no TLC", () => {
  const broken = compile(twoStates([small]), noView);
  assert.equal(broken.exit, 1);
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
    /^ {2}(s\d+) --> (s\d+): Grow\n[\s\S]*^ {2}class \2 breaks$/m,
  );

  const holds = compile(twoStates([]), noView);
  assert.equal(holds.exit, 0);
  assert.deepEqual([...holds.files.keys()], ["chart.mmd", "report.md", "tlc.out"]);
  assert.match(holds.report, /^## Rules that hold\nSmall, Settles$/mu);
  assert.doesNotMatch(body(holds.files, "chart.mmd"), /breaks/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("an invariant and a property with one name stay two rules", () => {
  const reportWithSmallProperty = (breaks: Rule[]): string => {
    const result = twoStates(breaks);
    const step = result.graph.steps[0];
    result.spec.properties = ["Small"];
    result.properties = [
      {
        rule: { kind: "property", name: "Small" },
        outcome: "broken",
        messages: [],
        bug: { start: "1", path: [{ action: "Grow", state: "2", step }], loop: 1, stutters: true },
        initialOnly: false,
      },
    ];
    return compile(result, noView).report;
  };
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

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule named NoDeadlock leaves the deadlock rule a name of its own", () => {
  const holds = (result: CheckResult): string | undefined => {
    result.spec.deadlock = true;
    result.rules = holding(result.spec);
    return (/^## Rules that hold\n(.*)$/m.exec(compile(result, noView).report))?.[1];
  };
  const invariant = twoStates([]);
  invariant.spec.invariants = ["NoDeadlock"];
  assert.equal(holds(invariant), "NoDeadlock, CHECK_DEADLOCK, Settles");
  assert.equal(holds(twoStates([], "NoDeadlock")), "Small, CHECK_DEADLOCK, NoDeadlock");
  assert.equal(holds(twoStates([])), "Small, NoDeadlock, Settles");
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
