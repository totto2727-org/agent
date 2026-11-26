import { describe, expect, it } from "bun:test";
import { fakeReader, passingCheck, pendingCheck } from "./fakes.test-helper.ts";
import { visitItems } from "./native-iteration.ts";
import { runQueued, runSimple } from "./policy.ts";
import type { WatchClock } from "./policy.ts";
import { context, FIRST_READ, OBSERVED_AT, options, queryFailure, START } from "./policy-test-fixtures.ts";
import type { PullRequestFacts } from "./types.ts";

const WAIT_PULL = 1;
const DEADLINE = 5;
const INTERVAL = 60;
const NO_DEADLINE = 0;

const pendingReader = (): ReturnType<typeof fakeReader> => fakeReader({ fastPath: { checks: [pendingCheck()], kind: "checks" } });
const passReader = (): ReturnType<typeof fakeReader> => fakeReader({ fastPath: { checks: [passingCheck()], kind: "checks" } });

const ignoreProgress = (): void => {
  // These tests assert the measured sleep schedule and the returned verdict.
};

const fakeClock = function (): { clock: WatchClock; sleeps: number[] } {
  const time = { now: START };
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => time.now,
      observedAt: () => OBSERVED_AT,
      async sleep(seconds) {
        sleeps.push(seconds);
        time.now += seconds;
        await Promise.resolve();
      },
    },
    sleeps,
  };
};

type Mode = "single" | "queued-stack" | "query-retry";

const checkDeadline = async (mode: Mode): Promise<void> => {
  const { clock, sleeps } = fakeClock();
  const pending = pendingReader();
  const reader = mode === "query-retry"
    ? { ...pending, async pullRequest(): Promise<PullRequestFacts> {
      await Promise.resolve();
      throw queryFailure("temporary failure");
    } }
    : pending;
  const dependencies = { clock, emit: ignoreProgress, reader };
  const polling = { ...options, interval: INTERVAL, timeout: DEADLINE };
  const result = mode === "queued-stack"
    ? await runQueued({ contexts: [context(WAIT_PULL)], dependencies, options: polling })
    : await runSimple({ contexts: [context(WAIT_PULL)], dependencies, mode: "single", options: polling, statusOnly: false });
  expect(result.kind).toBe("TIMEOUT");
  expect(sleeps).toEqual([DEADLINE]);
  expect(clock.now()).toBe(DEADLINE);
};

const checkWithoutDeadline = async (): Promise<void> => {
  const read = { count: START };
  const { clock, sleeps } = fakeClock();
  const pending = pendingReader();
  const passed = passReader();
  const result = await runSimple({
    contexts: [context(WAIT_PULL)],
    dependencies: {
      clock,
      emit: ignoreProgress,
      reader: {
        ...pending,
        async checksFastPath(pr) {
          read.count += FIRST_READ;
          return (read.count === FIRST_READ ? pending.checksFastPath(pr) : passed.checksFastPath(pr));
        },
      },
    },
    mode: "single",
    options: { ...options, interval: INTERVAL, timeout: NO_DEADLINE },
    statusOnly: false,
  });
  expect(result.kind).toBe("READY");
  expect(sleeps).toEqual([INTERVAL]);
};

describe("polling deadline sleeps", () => {
  visitItems(["single", "queued-stack", "query-retry"] as const, (mode) => {
    it(`caps ${mode} sleeps at the configured deadline`, async () => {
      await checkDeadline(mode);
    });
  });
  it("preserves the polling interval when the deadline is disabled", checkWithoutDeadline);
});
