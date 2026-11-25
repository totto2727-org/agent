import { describe, expect, it } from "bun:test";
import { fakeReader, failedCheck, passingCheck, pendingCheck } from "./fakes.test-helper.ts";
import { WIRE_NULL } from "./github-json.ts";
import { visitItems } from "./native-iteration.ts";
import { assessGitHubMerge, classifyPr, readSnapshot, selectTierMajorStackDecision } from "./policy.ts";
import { context } from "./policy-test-fixtures.ts";
import type { PullRequestFacts, RollupState } from "./types.ts";

const REFUSED_PULL = 1;
const PENDING_PULL = 2;
const SETTLED_PULL = 3;
const FAILED_PULL = 4;
const MERGED_PULL = 5;
const FRONTIER_PULL = 10;
const CONFLICTING_PULL = 11;
const DRAFT_PULL = 12;
const BOTTOM_PULL = 20;
const WAITING_UPSTACK_PULL = 21;

describe("readiness truth table", () => {
  it("covers every specified row and every UNKNOWN rollup value", () => {
    const cases: Readonly<[
      PullRequestFacts["mergeStateStatus"],
      RollupState,
      "allowed" | "refused",
    ][]> = [
      ["BLOCKED", "FAILURE", "refused"],
      ["BLOCKED", "ERROR", "refused"],
      ["BLOCKED", "PENDING", "allowed"],
      ["UNSTABLE", "FAILURE", "allowed"],
      ["UNKNOWN", "ERROR", "allowed"],
      ["UNKNOWN", "EXPECTED", "allowed"],
      ["UNKNOWN", "FAILURE", "allowed"],
      ["UNKNOWN", "PENDING", "allowed"],
      ["UNKNOWN", "SUCCESS", "allowed"],
      ["UNKNOWN", WIRE_NULL, "allowed"],
      ["CLEAN", "SUCCESS", "allowed"],
    ];
    visitItems(cases, ([mergeStateStatus, headRollupState, expected]) => {
      expect(
        assessGitHubMerge({ headRollupState, mergeStateStatus }).kind
      ).toBe(expected);
    });
  });

  it("turns a clean visible list plus GitHub refusal into an explicit CI blocker", async () => {
    const reader = fakeReader({
      commitRollups: [{ oid: "head", state: "FAILURE" }],
      facts: { mergeStateStatus: "BLOCKED" },
      fastPath: { checks: [passingCheck()], kind: "checks" },
    });
    const snapshot = await readSnapshot({
      allowDraft: false,
      context: context(REFUSED_PULL),
      pendingHistory: "include",
      reader,
    });
    expect(snapshot).toMatchObject({ ci: { kind: "ci-github-rejected" }, kind: "open" });
    expect(classifyPr(snapshot)).toMatchObject({
      blocker: { kind: "failing-checks" },
      kind: "blocker",
    });
  });
});

const checkSettledAndFailed = async (): Promise<void> => {
  const settled = fakeReader();
  await readSnapshot({
    allowDraft: false,
    context: context(SETTLED_PULL),
    pendingHistory: "omit",
    reader: settled,
  });
  expect(settled.calls).toContain("commitRollups");

  const failed = fakeReader({
    fastPath: { checks: [failedCheck()], kind: "checks" },
  });
  await readSnapshot({
    allowDraft: false,
    context: context(FAILED_PULL),
    pendingHistory: "omit",
    reader: failed,
  });
  expect(failed.calls).toContain("commitRollups");
};

describe("snapshot query planning", () => {
  it("does not query commit rollups while queued checks are pending", async () => {
    const reader = fakeReader({
      fastPath: { checks: [pendingCheck()], kind: "checks" },
    });
    const snapshot = await readSnapshot({
      allowDraft: false,
      context: context(PENDING_PULL),
      pendingHistory: "omit",
      reader,
    });
    expect(snapshot).toMatchObject({ ci: { kind: "ci-pending" }, kind: "open" });
    expect(reader.calls).toEqual([
      "pullRequest",
      "reviewThreadPage:null",
      "checksFastPath",
    ]);
  });

  it("queries rollups for settled and failed lists", checkSettledAndFailed);

  it("short-circuits merged rows before threads and checks", async () => {
    const reader = fakeReader({
      facts: { mergedAt: "2026-07-26T00:00:00Z", state: "MERGED" },
    });
    const snapshot = await readSnapshot({
      allowDraft: false,
      context: context(MERGED_PULL),
      pendingHistory: "include",
      reader,
    });
    expect(snapshot.kind).toBe("merged");
    expect(reader.calls).toEqual(["pullRequest"]);
  });
});

it("scans stacks tier-major so an upstack conflict outranks frontier CI", async () => {
  const frontier = await readSnapshot({
    allowDraft: false,
    context: context(FRONTIER_PULL),
    pendingHistory: "omit",
    reader: fakeReader({
      commitRollups: [{ oid: "head", state: "FAILURE" }],
      fastPath: { checks: [failedCheck()], kind: "checks" },
    }),
  });
  const upstack = await readSnapshot({
    allowDraft: false,
    context: context(CONFLICTING_PULL),
    pendingHistory: "omit",
    reader: fakeReader({ facts: { mergeable: "CONFLICTING" } }),
  });
  const decision = selectTierMajorStackDecision([frontier, upstack]);
  expect(decision).toMatchObject({
    blocker: { kind: "merge-conflicts", pr: { number: CONFLICTING_PULL } },
    kind: "blocker",
  });
});

it("attributes a stack wait to the PR whose checks are pending, not the bottom", async () => {
  const readyBottom = await readSnapshot({
    allowDraft: false,
    context: context(BOTTOM_PULL),
    pendingHistory: "omit",
    reader: fakeReader(),
  });
  const pendingUpstack = await readSnapshot({
    allowDraft: false,
    context: context(WAITING_UPSTACK_PULL),
    pendingHistory: "omit",
    reader: fakeReader({
      fastPath: { checks: [pendingCheck("upstack-build")], kind: "checks" },
    }),
  });
  const decision = selectTierMajorStackDecision([readyBottom, pendingUpstack]);
  expect(decision).toMatchObject({
    frontier: { number: WAITING_UPSTACK_PULL },
    kind: "waiting",
    pending: [{ name: "upstack-build" }],
  });
});

it("waits on a draft while checks are pending, then reports the draft gate", async () => {
  const pending = await readSnapshot({
    allowDraft: false,
    context: context(DRAFT_PULL),
    pendingHistory: "omit",
    reader: fakeReader({
      facts: { isDraft: true },
      fastPath: { checks: [pendingCheck()], kind: "checks" },
    }),
  });
  expect(classifyPr(pending).kind).toBe("waiting");

  const settled = await readSnapshot({
    allowDraft: false,
    context: context(DRAFT_PULL),
    pendingHistory: "omit",
    reader: fakeReader({ facts: { isDraft: true } }),
  });
  expect(classifyPr(settled)).toMatchObject({
    blocker: { kind: "merge-gate", reason: "draft-pr" },
    kind: "blocker",
  });
});
