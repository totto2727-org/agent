// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect the native V8 state used by the rendering fixture.
import v8 from "node:v8";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to evaluate the fixture in the native isolated VM context.
import vm from "node:vm";
import { json } from "#statechart/frontends/view.ts";
import { key, show, visitItems } from '#statechart/ir.ts';
import { parseDot } from "#statechart/frontends/dot.ts";
import { parseValue } from "#statechart/frontends/value.ts";

const stateJson = (text: string): ReturnType<typeof json> => json(parseValue(text));
const printedValue = (text: string): string => show(parseValue(text));

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

const nativeHeapReader = (): (() => number) => {
  v8.setFlagsFromString("--expose-gc");
  const garbageCollect: unknown = vm.runInNewContext("gc");
  // oxlint-disable-next-line rules/force-predicate -- Narrow the VM result at the native host boundary before invoking it.
  assert.ok(typeof garbageCollect === "function", "The VM exposes native garbage collection.");
  return (): number => {
    Reflect.apply(garbageCollect, undefined, []);
    Reflect.apply(garbageCollect, undefined, []);
    return process.memoryUsage().heapUsed;
  };
};

const dot = function* (pieces: number): Generator<string, void, unknown> {
  const stateIdDigits = 18;
  const pieceLines = 1024;
  const commentCharacters = 1020;
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

const RETAINED_MEBIBYTE_LIMIT = 4;

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the graph that parseDot returns keeps none of the text it read", () => {
  const heapUsed = nativeHeapReader();
  const mebibyte = 1_048_576;
  const displayDecimalPlaces = 1;
  const pieces = 16;
  const before = heapUsed();
  const graph = parseDot(dot(pieces));
  const kept = heapUsed() - before;
  assert.equal(graph.states.size, pieces);
  const keptMebibytes = kept / mebibyte;
  assert.ok(keptMebibytes < RETAINED_MEBIBYTE_LIMIT, `the graph keeps ${keptMebibytes.toFixed(displayDecimalPlaces)} MiB of ${pieces} MiB read`);
});
