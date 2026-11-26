// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from '#statechart/ir.ts';
import { bugs } from "#statechart/passes/reach.ts";
import { parseDot } from "#statechart/frontends/dot.ts";
import { fileLines } from "#statechart/run.ts";
import { forEachTlcCase } from "./tlc.ts";
import { replay } from "./chart-corpus.ts";
import { corpus } from "./chart-corpus-source.ts";
import { LAST } from "./chart-fixtures.ts";

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
  const expectedPaths = {
    AlsoNotOne: ["Next"],
    LoudWhenStopped: ["YouTurnItUp"],
    NoDeadlock: ["Next", "Next", "Next"],
    NotOne: ["Next"],
    NotOneOrThree: ["Next"],
    NotSolved: [
      "FillBig",
      "BigToSmall",
      "EmptySmall",
      "BigToSmall",
      "FillBig",
      "BigToSmall",
    ],
  };
  visitItems(Object.entries(expectedPaths), ([rule, expected]) => {assert.deepEqual(paths[rule], expected, rule);});
  const loginAndTwoPhasePathLength = 5;
  assert.equal(paths.SignedInWhileLocked.length, loginAndTwoPhasePathLength);
  assert.equal(paths.TCConsistent.length, loginAndTwoPhasePathLength);
  assert.equal(paths.TCConsistent.at(LAST), "RMRcvCommitMsg");
});
