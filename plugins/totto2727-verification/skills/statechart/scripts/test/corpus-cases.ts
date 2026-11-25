const counter = (name: string, before: string[], variables: string[]): string[] => [
  ...before,
  `---- MODULE ${name} ----`,
  "EXTENDS Naturals",
  ...variables,
  "Init == x = 0",
  String.raw`Next == x < 2 /\ x' = x + 1`,
  String.raw`Spec == Init /\ [][Next]_x`,
  "Low == x < 2",
  "====",
];

const UNKNOWN_NAMES = 12;

export const LEXICAL_CASES = [
  [
    "a `(*` inside a `\\*` comment",
    "Paren",
    [
      "---- MODULE Paren ----",
      "EXTENDS Naturals",
      String.raw`\* The reader calls f(*) on each tick.`,
      "VARIABLES x, y",
      String.raw`Init == x = 0 /\ y = 0`,
      String.raw`Tick == x < 2 /\ x' = x + 1 /\ UNCHANGED y`,
      "Next == Tick",
      String.raw`Spec == Init /\ [][Next]_<<x, y>>`,
      "(* x never passes 1 *)",
      "Low == x < 2",
      "====",
    ],
  ],
  [
    "a nested block comment",
    "Nested",
    counter("Nested", [], ["(* outer (* inner *) VARIABLES ghost *)", "VARIABLE x"]),
  ],
  [
    'a "(*" string',
    "Str",
    [
      "---- MODULE Str ----",
      "EXTENDS Naturals",
      "VARIABLE x",
      'Open == "(*"',
      "VARIABLE y",
      'Close == "*)"',
      String.raw`Init == x = 0 /\ y = 0`,
      String.raw`Next == x < 2 /\ x' = x + 1 /\ UNCHANGED y`,
      String.raw`Spec == Init /\ [][Next]_<<x, y>>`,
      "Low == x < 2",
      "====",
    ],
  ],
  [
    "text before the module header",
    "Pre",
    counter("Pre", ["Notes before the header: VARIABLES fake"], ["VARIABLE x"]),
  ],
] as const;

export const BROKEN_SPEC = ["---- MODULE Broken ----", "VARIABLE x", "Init == x = 0", "Next == x' = y", "===="];

export const INVALID_CASES = [
  [
    "an unknown name",
    BROKEN_SPEC,
    /^line 4, col 14 to line 4, col 14 of module Broken\n+Unknown operator: `y'\.$/mu,
  ],
  [
    "a parse error",
    ["---- MODULE Broken ----", "VARIABLE x", "Init == x = = 0", "Next == x' = x", "===="],
    /^Encountered "0" at line 3, column 15/mu,
  ],
  [
    "twelve unknown names",
    [
      "---- MODULE Broken ----",
      "VARIABLE x",
      "Init == x = 0",
      ...Array.from({ length: UNKNOWN_NAMES }, (_unused, index) => `D${index} == u${index}`),
      "Next == x' = x",
      "====",
    ],
    /^\*\*\* Errors: 12\n+line 4, col 7 to line 4, col 8 of module Broken\n+Unknown operator: `u0'\.$/mu,
  ],
] as const;

export const GRID_CASES = [
  { chart: true, config: "INVARIANT Typed", drawn: true, header: "TLC reached 500 states and 955 steps. The chart draws 500 states and 955 arrows.", height: 25, status: 0, width: 20 },
  { chart: false, config: "INVARIANT Typed", drawn: false, header: "TLC reached 501 states, more than the chart budget of 500, so the command wrote no chart.mmd.", height: 167, status: 0, width: 3 },
  { chart: false, config: "INVARIANT Typed", drawn: false, header: "TLC reached 1,600 states, more than the chart budget of 500, so the command wrote no chart.mmd.", height: 40, status: 0, width: 40 },
  { chart: true, config: "INVARIANT Near", drawn: true, header: "TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 4 states and 3 arrows.", height: 40, status: 1, width: 40 },
  { chart: true, config: "INVARIANT Far", drawn: false, header: "TLC reached more states than the chart budget of 500, so the chart draws only the bug paths: 79 states and 78 arrows.", height: 40, status: 1, width: 40 },
];

const GRID_LAST_INDEX = 1;

export const wideSpec = (width: number, height: number): string[] => [
  "---- MODULE Wide ----",
  "EXTENDS Naturals",
  "VARIABLES x, y",
  String.raw`Init == x = 0 /\ y = 0`,
  `IncX == x < ${width - GRID_LAST_INDEX} /\\ x' = x + 1 /\\ y' = y`,
  `IncY == y < ${height - GRID_LAST_INDEX} /\\ y' = y + 1 /\\ x' = x`,
  String.raw`Next == IncX \/ IncY`,
  String.raw`Typed == x \in 0..39`,
  String.raw`Near == ~(x = 2 /\ y = 1)`,
  `Far == ~(x = ${width - GRID_LAST_INDEX} /\\ y = ${height - GRID_LAST_INDEX})`,
  "====",
];

export const CYCLE_SPEC = [
  "---- MODULE Cycle ----",
  "EXTENDS Integers",
  "VARIABLE x",
  "Init == x = 0",
  "Next == x' = (x + 1) % 3",
  String.raw`Spec == Init /\ [][Next]_x /\ WF_x(Next)`,
  "Prop == <>(x = 5)",
  "====",
];

export const SLOW_LOOP_SPEC = [
  "---- MODULE SlowLoop ----",
  "EXTENDS Integers, TLC",
  "VARIABLE x",
  String.raw`Late(v) == IF \E i \in 1..2000000000 : TLCGet("duration") >= 6 THEN v ELSE v`,
  "Init == x = 0",
  String.raw`Deep == x \in 0..14 /\ x' = IF x = 5 THEN Late(x + 1) ELSE x + 1`,
  String.raw`Turn == x = 15 /\ x' = 16`,
  String.raw`Back == x = 16 /\ x' = 15`,
  String.raw`Leave == x = 0 /\ x' = -1`,
  String.raw`Return == x = -1 /\ x' = 0`,
  String.raw`Next == Deep \/ Turn \/ Back \/ Leave \/ Return`,
  String.raw`Spec == Init /\ [][Next]_x /\ WF_x(Next)`,
  "Prop == <>(x = 99)",
  "====",
];
