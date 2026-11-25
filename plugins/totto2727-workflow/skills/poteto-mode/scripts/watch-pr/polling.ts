import { EXIT_TIMEOUT } from "./verdict-contract.ts";
import { WatcherQueryError } from "./github.ts";
import { matchesUndefined } from "./native-predicates.ts";
import type { BlockerVerdict, GitHubReader, PollingOptions, ProgressVerdict, QueryFailure, TimeoutVerdict } from "./types.ts";
import { statusQueryVerdict } from "./verdict.ts";
import type { VerdictStamp, WatchClock } from "./verdict.ts";

const BACKOFF_MINIMUM_SECONDS = 60;
const BACKOFF_MAXIMUM_SECONDS = 300;
const BACKOFF_MULTIPLIER = 2;
const INITIAL_FAILURE_COUNT = 1;
const NO_TIMEOUT = 0;
const NO_FAILURES = 0;
const MINIMUM_SLEEP = 0;

export const queryBackoffSeconds = (interval: number, failures: number): number => Math.min(
  Math.max(interval, BACKOFF_MINIMUM_SECONDS) * BACKOFF_MULTIPLIER ** (failures - INITIAL_FAILURE_COUNT),
  BACKOFF_MAXIMUM_SECONDS,
);

export type RunDependencies = Readonly<{
  reader: GitHubReader;
  clock: WatchClock;
  emit: (verdict: ProgressVerdict) => void;
}>;

export const deadlinePassed = (started: number, options: PollingOptions, now: number): boolean =>
  options.timeout > NO_TIMEOUT && now - started >= options.timeout;

export type StepResult<Verdict> =
  | Readonly<{ kind: "terminal"; verdict: Verdict }>
  | Readonly<{ kind: "sleep"; seconds: number; onDeadline?: () => Verdict }>
  | Readonly<{ kind: "continue" }>;

interface PollInput<Verdict> {
  dependencies: RunDependencies;
  options: PollingOptions;
  stamp: VerdictStamp;
  step: () => Promise<StepResult<Verdict>>;
}

interface PollState {
  failures: number;
  started: number;
}

type Attempt<Verdict> =
  | Readonly<{ kind: "observed"; step: StepResult<Verdict> }>
  | Readonly<{ kind: "query-failed"; queryError: WatcherQueryError }>;

const attempt = async <Verdict>(step: () => Promise<StepResult<Verdict>>): Promise<Attempt<Verdict>> => {
  try {
    return { kind: "observed", step: await step() };
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) {throw error;}
    return { kind: "query-failed", queryError: error };
  }
};

type PollTerminal<Verdict> = Verdict | BlockerVerdict | TimeoutVerdict;

const onFailure = <Verdict>(
  failure: QueryFailure,
  state: PollState,
  { dependencies, options, stamp }: PollInput<Verdict>,
): StepResult<PollTerminal<Verdict>> => {
  state.failures += INITIAL_FAILURE_COUNT;
  if (!failure.retryable || state.failures >= options.maxQueryErrors) {
    return { kind: "terminal", verdict: statusQueryVerdict(stamp, state.failures, failure) };
  }
  const retryInSeconds = queryBackoffSeconds(options.interval, state.failures);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing serialized order of retry status fields.
  dependencies.emit(stamp({ kind: "RETRY", terminal: false, failure, consecutiveFailures: state.failures, retryInSeconds }));
  if (deadlinePassed(state.started, options, dependencies.clock.now())) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing timeout reason and envelope fields.
    const verdict = stamp({ kind: "TIMEOUT", terminal: true, exitCode: EXIT_TIMEOUT, reason: { kind: "status-unavailable", failure } });
    return { kind: "terminal", verdict };
  }
  return { kind: "sleep", seconds: retryInSeconds };
};

const onObservation = <Verdict>(step: StepResult<Verdict>, state: PollState, { dependencies, options }: PollInput<Verdict>): StepResult<Verdict> => {
  state.failures = NO_FAILURES;
  if (step.kind === "sleep" && !matchesUndefined(step.onDeadline) && deadlinePassed(state.started, options, dependencies.clock.now())) {
    return { kind: "terminal", verdict: step.onDeadline() };
  }
  return step;
};

const boundedSleep = async <Verdict>(seconds: number, state: PollState, { dependencies, options }: PollInput<Verdict>): Promise<void> => {
  const remaining = options.timeout > NO_TIMEOUT
    ? Math.max(MINIMUM_SLEEP, options.timeout - (dependencies.clock.now() - state.started))
    : seconds;
  await dependencies.clock.sleep(Math.min(seconds, remaining));
};

export const pollUntilTerminal = async <Verdict>(args: PollInput<Verdict>): Promise<PollTerminal<Verdict>> => {
  const state = { failures: NO_FAILURES, started: args.dependencies.clock.now() };
  // oxlint-disable-next-line rules/no-for-loops -- Each poll waits for the previous result or backoff before choosing its next action.
  for (;;) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- One poll must complete before the next one starts.
    const result = await attempt(args.step);
    const next = result.kind === "observed"
      ? onObservation(result.step, state, args)
      : onFailure(result.queryError.failure, state, args);
    if (next.kind === "terminal") {return next.verdict;}
    if (next.kind === "sleep") {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Apply the deadline-capped delay before making another GitHub read.
      await boundedSleep(next.seconds, state, args);
    }
  }
};
