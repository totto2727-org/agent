import { describe, expect, it } from "bun:test";
import { fakeReader, failedCheck, passingCheck, pendingCheck } from "./fakes.test-helper.ts";
import { ChecksUnavailable, mapRollupNode, parseFastCheck, parsePullRequest, resolveChecks, WatcherQueryError } from "./github.ts";
import { WIRE_NULL } from "./github-json.ts";
import { watchContext as context } from "./github-test-fixtures.ts";
import { visitItems } from "./native-iteration.ts";

const CHECKS_PENDING = 8;

const checkRollupPagination = async (): Promise<void> => {
  const reader = fakeReader({
    fastPath: { exitCode: CHECKS_PENDING, kind: "unusable", stderr: "" },
    rollupPages: [
      { checks: [passingCheck("first")], endCursor: "next" },
      { checks: [failedCheck("second")], endCursor: WIRE_NULL },
    ],
  });
  const read = await resolveChecks(reader, context);
  expect(read.source).toBe("graphql-rollup");
  expect(read.checks.map((check) => check.name)).toEqual(["first", "second"]);
  expect(reader.calls).toEqual([
    "checksFastPath",
    "checkRollupPage:null",
    "checkRollupPage:next",
  ]);
};

describe("checks fallback chain", () => {
  it("uses a non-empty fast-path result without a rollup query", async () => {
    const reader = fakeReader({
      fastPath: { checks: [passingCheck("fast")], kind: "checks" },
    });
    const read = await resolveChecks(reader, context);
    expect(read.source).toBe("gh-pr-checks");
    expect(read.checks.map((check) => check.name)).toEqual(["fast"]);
    expect(reader.calls).toEqual(["checksFastPath"]);
  });

  it("paginates GraphQL when the fast path is unusable", checkRollupPagination);

  it("falls back when valid fast-path JSON represented an empty list", async () => {
    const reader = fakeReader({
      fastPath: { checks: [], kind: "checks" },
      rollupPages: [{ checks: [pendingCheck("fallback")], endCursor: WIRE_NULL }],
    });
    const read = await resolveChecks(reader, context);
    expect(read.checks[0].name).toBe(
      "fallback"
    );
    expect(reader.calls).toEqual(["checksFastPath", "checkRollupPage:null"]);
  });

  it("fails closed when both paths are empty", async () => {
    const reader = fakeReader({
      fastPath: {
        exitCode: CHECKS_PENDING,
        kind: "unusable",
        stderr: "credential cannot read checks",
      },
    });
    const result = await resolveChecks(reader, context).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ChecksUnavailable);
    expect(reader.calls).toEqual(["checksFastPath", "checkRollupPage:null"]);
  });
});

const checkRollupStates = (): void => {
  const cases = [
    ["IN_PROGRESS", WIRE_NULL, "pending", "PENDING"],
    ["COMPLETED", "SUCCESS", "passed", "SUCCESS"],
    ["COMPLETED", "NEUTRAL", "skipped", "NEUTRAL"],
    ["COMPLETED", "SKIPPED", "skipped", "SKIPPED"],
    ["COMPLETED", "ACTION_REQUIRED", "failed", "ACTION_REQUIRED"],
    ["COMPLETED", "TIMED_OUT", "failed", "FAILURE"],
    ["COMPLETED", "FUTURE_VALUE", "failed", "FAILURE"],
  ] as const;
  visitItems(cases, ([status, conclusion, kind, reportedState]) => {
    expect(
      mapRollupNode({
        __typename: "CheckRun",
        conclusion,
        name: "ci",
        status,
      })
    ).toMatchObject({ kind, reportedState });
  });
};

const checkRollupApprovalGate = (): void => {
  expect(
    mapRollupNode({
      __typename: "CheckRun",
      conclusion: "ACTION_REQUIRED",
      description: "1 of 2 policies",
      name: "Code Review Gate",
      status: "COMPLETED",
    })
  ).toMatchObject({
    kind: "code-review-gate",
    reportedState: "ACTION_REQUIRED",
  });
};

const checkFastPathApprovalGate = (): void => {
  expect(
    parseFastCheck({
      bucket: "fail",
      name: "Code Review Gate",
      state: "ACTION_REQUIRED",
    })
  ).toMatchObject({
    kind: "code-review-gate",
    reportedState: "ACTION_REQUIRED",
  });
  expect(
    parseFastCheck({ bucket: "fail", name: "ci", state: "ACTION_REQUIRED" })
  ).toMatchObject({ kind: "failed", reportedState: "ACTION_REQUIRED" });
};

describe("rollup node mapping", () => {
  it("maps terminal and non-terminal CheckRun states fail closed", checkRollupStates);

  it("classifies an in-progress Code Review Gate from the rollup as the gate", () => {
    expect(
      mapRollupNode({
        __typename: "CheckRun",
        conclusion: WIRE_NULL,
        name: "Code Review Gate",
        status: "IN_PROGRESS",
      })
    ).toMatchObject({ kind: "code-review-gate" });
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "Code Review Gate",
        state: "PENDING",
      })
    ).toMatchObject({ kind: "code-review-gate" });
  });

  it("classifies a Code Review Gate waiting on an owner approval as the gate", checkRollupApprovalGate);

  it("classifies a fast-path Code Review Gate waiting on an owner approval as the gate", checkFastPathApprovalGate);

  it("maps StatusContext states and drops unknown typenames", () => {
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "EXPECTED",
      })
    ).toMatchObject({ kind: "pending", reportedState: "PENDING" });
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "FUTURE_VALUE",
      })
    ).toMatchObject({ kind: "failed", reportedState: "FUTURE_VALUE" });
    expect(mapRollupNode({ __typename: "FutureNode" })).toBeNull();
  });
});

const rawPullRequest = {
  baseRefName: "main",
  headRefName: "feature",
  headRefOid: "head",
  isDraft: false,
  mergeStateStatus: "CLEAN",
  mergeable: "MERGEABLE",
  mergedAt: WIRE_NULL,
  reviewDecision: "APPROVED",
  state: "OPEN",
};

const rejectedPullRequest = (): unknown => {
  try {return parsePullRequest({ ...rawPullRequest, mergeStateStatus: "FUTURE_STATE" }, context);}
  catch (error) {return error;}
};

describe("closed enum parsing", () => {

  it("accepts mergeStateStatus CONFLICTING", () => {
    expect(
      parsePullRequest(
        { ...rawPullRequest, mergeStateStatus: "CONFLICTING" },
        context
      ).mergeStateStatus
    ).toBe("CONFLICTING");
  });

  it("reads gh's empty reviewDecision as no decision rather than a parse failure", () => {
    expect(
      parsePullRequest({ ...rawPullRequest, reviewDecision: "" }, context)
        .reviewDecision
    ).toBeNull();
  });

  it("still rejects an unknown reviewDecision", () => {
    expect(() =>
      parsePullRequest({ ...rawPullRequest, reviewDecision: "MAYBE" }, context)
    ).toThrow(WatcherQueryError);
  });

  it("rejects unknown enum values as retryable errors carrying the raw value", () => {
    const error = rejectedPullRequest();
    expect(error).toBeInstanceOf(WatcherQueryError);
    expect(error instanceof WatcherQueryError ? error.failure : undefined).toMatchObject({
      kind: "missing-key",
      rawValue: '"FUTURE_STATE"',
      retryable: true,
    });
  });
});
