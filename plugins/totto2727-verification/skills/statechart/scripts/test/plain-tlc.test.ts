import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports, vitest/no-import-node-test -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { agrees, skip } from "./tlc.ts";

const late = [
  "---- MODULE Late ----",
  "EXTENDS Naturals, TLC",
  "CONSTANT Mode",
  "VARIABLES x",
  String.raw`f == [i \in 0..2 |-> 0]`,
  "Init == x = 0",
  String.raw`Grow == x < 5 /\ x' = x + 1`,
  String.raw`Bad == x = 3 /\ \/ Mode = "assert" /\ Assert(FALSE, "late error") /\ x' = 0`,
  String.raw`                \/ Mode = "div" /\ x' = 1 \div 0`,
  String.raw`Next == Grow \/ Bad`,
  "Small == x < 1",
  "Below == x < 2",
  "InDomain == f[x] = 0",
  "====",
];
const lateCfg = (mode: string, rules: string): string =>
  `CONSTANT Mode = "${mode}"\nINIT Init\nNEXT Next\nINVARIANTS ${rules}\n`;

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a rule that breaks before another rule fails to evaluate breaks in either order",
  { skip },
  () => {
    const first = agrees("Late", { Late: late }, lateCfg("none", "Below InDomain"));
    const last = agrees("Late", { Late: late }, lateCfg("none", "InDomain Below"));
    assert.equal(first.status, 1);
    assert.deepEqual(first.breaks, new Map([["Below", 2]]));
    assert.deepEqual(first.holds, []);
    assert.deepEqual(first.unchecked, ["InDomain", "NoDeadlock"]);
    assert.deepEqual(last, first);
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule that breaks before a step fails to evaluate breaks", { skip }, () => {
  Iterator.from(["div", "assert"]).forEach((mode) => {
    const verdict = agrees("Late", { Late: late }, lateCfg(mode, "Small"));
    assert.equal(verdict.status, 1);
    assert.deepEqual(verdict.breaks, new Map([["Small", 1]]));
    assert.deepEqual(verdict.unchecked, ["NoDeadlock"]);
  });
});

const warnPath = (next: string): string[] => [
  "---- MODULE WarnPath ----",
  "EXTENDS Naturals",
  "VARIABLES x",
  String.raw`f == [i \in 0..1 |-> i]`,
  "Init == x = 0",
  String.raw`One == x < 3 /\ x' = x + 1`,
  String.raw`Two == x < 3 /\ x' = x + 2`,
  `Next == ${next}`,
  "Zero == f[x] = 0",
  "====",
];

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule that breaks before it fails to evaluate breaks", { skip }, () => {
  const verdict = agrees(
    "WarnPath",
    { WarnPath: warnPath(String.raw`One \/ Two`) },
    "INIT Init\nNEXT Next\nINVARIANT Zero\n",
  );
  assert.equal(verdict.status, 1);
  assert.equal(verdict.breaks.get("Zero"), 1);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule that fails to evaluate before TLC reaches a break exits 2", { skip }, () => {
  Iterator.from(["", "CHECK_DEADLOCK FALSE\n"]).forEach((deadlock) => {
    const verdict = agrees(
      "WarnPath",
      { WarnPath: warnPath(String.raw`Two \/ One`) },
      `INIT Init\nNEXT Next\nINVARIANT Zero\n${deadlock}`,
    );
    assert.equal(verdict.status, 2);
    assert.deepEqual(verdict.holds, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a rule that no verdict run checks stays not checked under a SYMMETRY", { skip }, () => {
  const verdict = agrees(
    "Hide",
    {
      Hide: [
        "---- MODULE Hide ----",
        "EXTENDS Naturals, TLC",
        "CONSTANTS a, b, S",
        "VARIABLES x, n",
        "Perms == Permutations(S)",
        String.raw`Init == x \in S /\ n = 0`,
        String.raw`Next == n < 4 /\ n' = n + 1 /\ UNCHANGED x`,
        "Early == n # 1",
        "Bad == x = a",
        String.raw`Boom == n < 3 \/ Assert(FALSE, "boom")`,
        "====",
      ],
    },
    "CONSTANTS a = a b = b S = {a, b}\nSYMMETRY Perms\nINIT Init\nNEXT Next\nINVARIANTS Early Boom Bad\n",
  );
  assert.equal(verdict.status, 1);
  assert.deepEqual(verdict.breaks, new Map([["Early", 1]]));
  assert.deepEqual(verdict.holds, []);
  assert.deepEqual(verdict.unchecked, ["Bad", "Boom", "NoDeadlock"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a deadlock breaks whatever shape the SPECIFICATION has", { skip }, () => {
  const live = agrees(
    "Live",
    {
      Live: [
        "---- MODULE Live ----",
        "EXTENDS Naturals",
        "VARIABLE x",
        "Init == x = 0",
        String.raw`Next == x < 2 /\ x' = x + 1`,
        String.raw`Spec == Init /\ [][Next]_x`,
        String.raw`LiveSpec == Spec /\ WF_x(Next)`,
        String.raw`TypeOK == x \in 0..2`,
        "====",
      ],
    },
    "SPECIFICATION LiveSpec\nINVARIANT TypeOK\n",
  );
  assert.deepEqual(live.breaks, new Map([["NoDeadlock", 2]]));
  assert.deepEqual(live.holds, ["TypeOK"]);
  Iterator.from([String.raw`[][Next \/ Tick]_vars`, String.raw`[][\E i \in 1..2 : Step(i)]_vars`]).forEach((next) => {
    const verdict = agrees(
      "Shape",
      {
        Shape: [
          "---- MODULE Shape ----",
          "EXTENDS Naturals",
          "VARIABLES x, t",
          "vars == <<x, t>>",
          String.raw`Init == x = 0 /\ t = 0`,
          String.raw`Step(i) == x < 2 /\ x' = x + i /\ UNCHANGED t`,
          "Next == Step(1)",
          String.raw`Tick == t < 1 /\ t' = 1 /\ UNCHANGED x`,
          `Spec == Init /\\ ${next}`,
          "====",
        ],
      },
      "SPECIFICATION Spec\n",
    );
    assert.equal(verdict.status, 1);
    assert.ok(verdict.breaks.has("NoDeadlock"));
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a SPECIFICATION from an INSTANCE checks deadlock and finds none", { skip }, () => {
  const verdict = agrees(
    "Outer",
    {
      Inner: [
        "---- MODULE Inner ----",
        "EXTENDS Naturals",
        "VARIABLE x",
        String.raw`Spec == x = 0 /\ [][x' = (x + 1) % 3]_x`,
        "====",
      ],
      Outer: [
        "---- MODULE Outer ----",
        "VARIABLE x",
        "I == INSTANCE Inner",
        "Spec == I!Spec",
        "====",
      ],
    },
    "SPECIFICATION Spec\n",
  );
  assert.equal(verdict.status, 0);
  assert.deepEqual(verdict.holds, ["NoDeadlock"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a state at a CONSTRAINT bound is no deadlock", { skip }, () => {
  const verdict = agrees(
    "Bound",
    {
      Bound: [
        "---- MODULE Bound ----",
        "EXTENDS Naturals",
        "VARIABLE x",
        "Init == x = 0",
        "Next == x' = x + 1",
        "Small == x < 3",
        "====",
      ],
    },
    "INIT Init\nNEXT Next\nCONSTRAINT Small\n",
  );
  assert.equal(verdict.status, 0);
  assert.deepEqual(verdict.holds, ["NoDeadlock"]);
  assert.doesNotMatch(verdict.chart, /^ {2}class s\d+ breaks$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a model with no initial state passes as it does in TLC, and the report says why",
  { skip },
  () => {
    const verdict = agrees(
      "NoInit",
      {
        NoInit: [
          "---- MODULE NoInit ----",
          "EXTENDS Naturals",
          "VARIABLE x",
          String.raw`Init == x = 0 /\ x > 0`,
          "Next == x' = x + 1",
          "Small == x < 3",
          "====",
        ],
      },
      "INIT Init\nNEXT Next\nINVARIANT Small\n",
    );
    assert.equal(verdict.status, 0);
    assert.deepEqual(verdict.holds, ["NoDeadlock", "Small"]);
    assert.match(
      verdict.report,
      /^TLC found no state that satisfies Init, so no state can break a rule\.$/mu,
    );
  },
);

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "a run after a break stops at the state bound and leaves its rules not checked",
  { skip },
  () => {
    const verdict = agrees(
      "Cycle",
      {
        Cycle: [
          "---- MODULE Cycle ----",
          "EXTENDS Naturals",
          "VARIABLE x",
          "Next == x' = (x + 1) % 100005",
          String.raw`Spec == x = 0 /\ [][Next]_x /\ WF_x(Next)`,
          "Early == x # 3",
          "Back == []<>(x = 0)",
          "====",
        ],
      },
      "SPECIFICATION Spec\nINVARIANT Early\nPROPERTY Back\n",
    );
    assert.equal(verdict.status, 1);
    assert.deepEqual(verdict.breaks, new Map([["Early", 3]]));
    assert.deepEqual(verdict.holds, []);
    assert.deepEqual(verdict.unchecked, ["Back", "NoDeadlock"]);
    assert.match(
      verdict.report,
      /^After the first break, each TLC run stops at 100,000 distinct states\./mu,
    );
  },
);
