import type { Case } from "./differential-case.ts";

const moduleText = (name: string, ...lines: string[]): string =>
  [`---- MODULE ${name} ----`, ...lines, "====", ""].join("\n");

const counting = (print: string): string =>
  moduleText(
    "Count",
    "EXTENDS Naturals, TLC",
    "VARIABLE x",
    "Init == x = 0",
    `Next == x < 2 /\\ x' = x + 1 /\\ PrintT(${print})`,
    String.raw`Spec == Init /\ [][Next]_x`,
    "Ok == x <= 2",
  );

export const CASES = [
  [
    "a string and a model value with one name are two states, and the path to the string has no steps",
    {
      base: ["CONSTANT A = A", "SPECIFICATION Spec"],
      deadlock: true,
      invariants: ["NotString"],
      module: "Collide",
      tla: moduleText(
        "Collide",
        "CONSTANT A",
        "VARIABLE x",
        'Init == x = "A"',
        String.raw`ToModel == x = "A" /\ x' = A`,
        String.raw`Back == x = A /\ x' = "A"`,
        String.raw`Next == ToModel \/ Back`,
        String.raw`Spec == Init /\ [][Next]_x`,
        'NotString == x # "A"',
      ),
    },
    ['The shortest path has 0 steps:\n0. "A"\n'],
  ],
  [
    "a state that holds an interval reads, and equals the set that TLC builds for it",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: true,
      invariants: ["Small"],
      module: "Interval",
      tla: moduleText(
        "Interval",
        "EXTENDS FiniteSets, Naturals",
        "VARIABLE x",
        "Init == x = 1..3",
        String.raw`Next == x' = IF x = 1..3 THEN 1..4 ELSE x \ {4}`,
        String.raw`Spec == Init /\ [][Next]_x`,
        "Small == Cardinality(x) < 4",
      ),
    },
    ["0. 1..3\n1. Next: 1..4\n"],
  ],
  [
    "a string with quotes, backslashes, newlines, and tabs prints escaped on one path line",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: false,
      invariants: ["NotLast"],
      module: "Odd",
      tla: moduleText(
        "Odd",
        "EXTENDS Naturals, Sequences",
        "VARIABLES s, i",
        String.raw`Words == <<"plain", "a\"b", "back\\slash", "line\nbreak", "tab\tstop", "x\n/\\ i = 99", "end\\">>`,
        String.raw`Init == i = 1 /\ s = Words[1]`,
        String.raw`Next == i < Len(Words) /\ i' = i + 1 /\ s' = Words[i + 1]`,
        String.raw`Spec == Init /\ [][Next]_<<s, i>>`,
        "NotLast == i < Len(Words)",
      ),
    },
    [
      [
        String.raw`0. i=1 s="plain"`,
        String.raw`1. Next: i=2 s="a\"b"`,
        String.raw`2. Next: i=3 s="back\\slash"`,
        String.raw`3. Next: i=4 s="line\nbreak"`,
        String.raw`4. Next: i=5 s="tab\tstop"`,
        String.raw`5. Next: i=6 s="x\n/\\ i = 99"`,
        String.raw`6. Next: i=7 s="end\\"`,
        "",
      ].join("\n"),
    ],
  ],
  [
    "a variable and a record field named __proto__ reach the view as their own fields",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: false,
      invariants: ["First"],
      module: "Proto",
      tla: moduleText(
        "Proto",
        "VARIABLES __proto__, r",
        String.raw`Init == __proto__ = 0 /\ r = [__proto__ |-> "a"]`,
        String.raw`Next == __proto__ = 0 /\ __proto__' = 1 /\ r' = [__proto__ |-> "b"]`,
        String.raw`Spec == Init /\ [][Next]_<<__proto__, r>>`,
        "First == __proto__ = 0",
      ),
      view: "export const state = (v) => JSON.stringify(v);\n",
    },
    [
      [
        String.raw`0. {"__proto__":0,"r":{"__proto__":"a"}}`,
        String.raw`1. Next: {"__proto__":1,"r":{"__proto__":"b"}}`,
        "",
      ].join("\n"),
    ],
  ],
  [
    "a spec that prints a line in the shape of a mark breaks no rule",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: true,
      invariants: ["Ok"],
      module: "Count",
      tla: counting('<<"chart", <<x + 1>>, {"Ok"}>>'),
    },
    ["## NoDeadlock breaks\nThe shortest path has 2 steps:"],
  ],
  [
    "a spec that prints a line in the shape of a bad mark is not an error",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: false,
      invariants: ["Ok"],
      module: "Count",
      tla: counting('<<"chart", 1>>'),
    },
    ["## Rules that hold\nOk\n"],
  ],
  [
    "a spec that prints a mark for a rule the config does not have is not an error",
    {
      base: ["SPECIFICATION Spec"],
      deadlock: false,
      invariants: ["Ok"],
      module: "Count",
      tla: counting('<<"chart", <<x + 1>>, {"Nope"}>>'),
    },
    ["## Rules that hold\nOk\n"],
  ],
] satisfies [string, Case, string[]][];
