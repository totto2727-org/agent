import { describe, expect, it } from "bun:test";
import { fakeReader } from "./fakes.test-helper.ts";
import { applyQueueSnapshot, createQueueState, evaluateQueue, planQueue, queryBackoffSeconds, readSnapshot, runQueued } from "./policy.ts";
import type { WatchClock } from "./policy.ts";
import { context, FIRST_READ, OBSERVED_AT, options, queryFailure, START, stopPolling } from "./policy-test-fixtures.ts";
import type { GitHubReader, NonEmpty, PrContext, ProgressVerdict, PrSnapshot } from "./types.ts";

const BOTTOM_PULL = 20;
const MIDDLE_PULL = 21;
const UPPER_PULL = 22;
const FIRST_SWEEP_PULL = 30;
const FINAL_SWEEP_PULL = 31;
const OLD_FRONTIER = 40;
const NEW_FRONTIER = 41;
const SINGLE_PULL = 50;

const SECOND_SLEEP = 2;
const NEXT_READ_AT = 60;
const FINAL_READ_AT = 5;
const FOLLOWING_SWEEP_AT = 305;
const ADVANCE_PHASE_EVENTS = 5;
const UNDER_FLOOR = 1;
const BACKOFF_FLOOR = 60;
const DOUBLE_BACKOFF = 120;
const CAPPED_FAILURES = 4;
const SECOND_FAILURE = 2;
const BACKOFF_CAP = 300;

const openSnapshot =  async (pr: PrContext): Promise<PrSnapshot> => readSnapshot({
  allowDraft: false,
  context: pr,
  pendingHistory: "omit",
  reader: fakeReader(),
});

const recordedClock = (timeline: string[], stopMessage: string): WatchClock => {
  const time = { now: START, sleeps: START };
  return {
    now: () => time.now,
    observedAt: () => OBSERVED_AT,
    async sleep(seconds) {
      timeline.push("sleep");
      time.now += seconds;
      time.sleeps += FIRST_READ;
      if (time.sleeps === SECOND_SLEEP) {throw stopPolling(stopMessage);}
      await Promise.resolve();
    },
  };
};

const expectStop = async (running: Promise<unknown>, message: string): Promise<void> => {
  const proof = await running.catch((error: unknown) => error);
  expect(proof).toBeInstanceOf(Error);
  expect(proof).toHaveProperty("message", message);
};

const mergeOnSecondRead = (frontier: PrContext, timeline: string[]): GitHubReader => {
  const base = fakeReader();
  const reads = new Map<number, number>();
  return {
    ...base,
    async pullRequest(pr: PrContext) {
      timeline.push(`read:${pr.number}`);
      const facts = await base.pullRequest(pr);
      const count = (reads.get(pr.number) ?? START) + FIRST_READ;
      reads.set(pr.number, count);
      return pr.number === frontier.number && count > FIRST_READ
        ? { ...facts, mergedAt: "2026-07-26T00:00:00Z", state: "MERGED" }
        : facts;
    },
  };
};

const checkSuccessfulSweepHead = async (): Promise<void> => {
  const queue = [
    context(BOTTOM_PULL),
    context(MIDDLE_PULL),
    context(UPPER_PULL),
  ] satisfies NonEmpty<PrContext>;
  const state = createQueueState(queue, START);
  const first = await openSnapshot(queue[0]);
  const { state: afterFirst } = applyQueueSnapshot(state, first, START, options);
  expect(afterFirst.work).toMatchObject({
    kind: "whole-stack-sweep",
    remaining: [{ number: MIDDLE_PULL }, { number: UPPER_PULL }],
  });
  const second = await openSnapshot(queue[1]);
  const { state: afterSecond } = applyQueueSnapshot(afterFirst, second, NEXT_READ_AT, options);
  expect(afterSecond.work).toMatchObject({
    kind: "whole-stack-sweep",
    remaining: [{ number: UPPER_PULL }],
  });
};

const checkSweepRetry = async (): Promise<void> => {
  const middle = context(MIDDLE_PULL);
  const base = fakeReader();
  const failOnce = { pending: true };
  const timeline: string[] = [];
  const reader = {
    ...base,
    async pullRequest(pr: PrContext) {
      if (pr.number === middle.number && failOnce.pending) {
        failOnce.pending = false;
        timeline.push(`fail:${pr.number}`);
        throw queryFailure("rate limited");
      }
      timeline.push(`read:${pr.number}`);
      return base.pullRequest(pr);
    },
  } satisfies GitHubReader;
  const running = runQueued({
    contexts: [context(BOTTOM_PULL), middle, context(UPPER_PULL)],
    dependencies: {
      clock: recordedClock(timeline, "stop after resume proof"),
      emit(verdict) {
        timeline.push(`emit:${verdict.kind}`);
      },
      reader,
    },
    options,
  });
  await expectStop(running, "stop after resume proof");
  expect(timeline).toEqual([
    "emit:QUEUE",
    "read:20",
    "fail:21",
    "emit:RETRY",
    "sleep",
    "read:21",
    "read:22",
    "emit:STATUS",
    "emit:WAITING",
    "sleep",
  ]);
};

const checkCompletedSweep = async (): Promise<void> => {
  const queue = [context(FIRST_SWEEP_PULL), context(FINAL_SWEEP_PULL)] satisfies NonEmpty<PrContext>;
  const state = createQueueState(queue, START);
  const first = applyQueueSnapshot(
    state,
    await openSnapshot(queue[0]),
    START,
    options
  );
  expect(first.completedSweepRows).toBeNull();
  const second = applyQueueSnapshot(
    first.state,
    await openSnapshot(queue[1]),
    FINAL_READ_AT,
    options
  );
  expect(
    second.completedSweepRows?.map((row) => Number(row.context.number))
  ).toEqual([FIRST_SWEEP_PULL, FINAL_SWEEP_PULL]);
  expect(second.state.nextSweepAt).toBe(FOLLOWING_SWEEP_AT);
};

const checkImmediateAdvance = async (): Promise<void> => {
  const contexts = [context(OLD_FRONTIER), context(NEW_FRONTIER)] satisfies NonEmpty<PrContext>;
  const timeline: string[] = [];
  const reader = mergeOnSecondRead(contexts[0], timeline);
  const emitted: ProgressVerdict[] = [];
  const running = runQueued({
    contexts,
    dependencies: {
      clock: recordedClock(timeline, "stop after advance proof"),
      emit(verdict) {
        emitted.push(verdict);
        timeline.push(`emit:${verdict.kind}`);
      },
      reader,
    },
    options,
  });
  await expectStop(running, "stop after advance proof");
  expect(emitted.some((event) => event.kind === "ADVANCE")).toBe(true);
  const firstSleep = timeline.indexOf("sleep");
  expect(timeline.slice(firstSleep, firstSleep + ADVANCE_PHASE_EVENTS)).toEqual([
    "sleep",
    "read:40",
    "emit:ADVANCE",
    "read:41",
    "emit:WAITING",
  ]);
};

const checkDuplicateWaits = async (): Promise<void> => {
  const queue = [context(SINGLE_PULL)] satisfies NonEmpty<PrContext>;
  const state = createQueueState(queue, START);
  const { state: seen } = applyQueueSnapshot(
    state,
    await openSnapshot(queue[0]),
    START,
    options
  );
  const first = evaluateQueue(seen, START, options);
  expect(first).toMatchObject({ emit: true, kind: "waiting" });
  const second = evaluateQueue(first.state, options.interval, options);
  expect(second).toMatchObject({ emit: false, kind: "waiting" });
  expect(planQueue(second.state, options.sweepInterval).work?.kind).toBe("whole-stack-sweep");
};

describe("queued-stack cadence", () => {

  it("drops a sweep head only after its snapshot succeeds", checkSuccessfulSweepHead);

  it("resumes the sweep at the PR whose read failed", checkSweepRetry);

  it("emits a completed sweep only after its final successful snapshot", checkCompletedSweep);

  it("ADVANCE continues directly to the new frontier without sleeping", checkImmediateAdvance);

  it("deduplicates identical waits and schedules the next due sweep", checkDuplicateWaits);
});

it("uses the specified retry floor and cap", () => {
  expect(queryBackoffSeconds(UNDER_FLOOR, FIRST_READ)).toBe(BACKOFF_FLOOR);
  expect(queryBackoffSeconds(UNDER_FLOOR, SECOND_FAILURE)).toBe(DOUBLE_BACKOFF);
  expect(queryBackoffSeconds(BACKOFF_FLOOR, CAPPED_FAILURES)).toBe(BACKOFF_CAP);
});
