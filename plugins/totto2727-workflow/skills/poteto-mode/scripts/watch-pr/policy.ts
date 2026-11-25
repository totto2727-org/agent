import { WatcherQueryError } from "./github.ts";
import { readSnapshot } from "./snapshot.ts";
import type * as T from "./types.ts";
import { nonEmpty } from "./types.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";

export { assessGitHubMerge, readSnapshot } from "./snapshot.ts";

const conflictBlocker = (row: T.PrSnapshot): T.MergeBlocker | null =>
  row.kind === "open" &&
  (row.facts.mergeable === "CONFLICTING" ||
    row.facts.mergeStateStatus === "DIRTY" ||
    row.facts.mergeStateStatus === "CONFLICTING")
    ? { kind: "merge-conflicts", pr: row.context, facts: row.facts }
    : null;
const threadBlocker = function (row: T.PrSnapshot): T.MergeBlocker | null {
  if (row.kind !== "open") {return null;}
  const threads = nonEmpty(row.threads);
  return matchesNull(threads)
    ? null
    : { kind: "review-threads", pr: row.context, threads };
};
const ciBlocker = (row: T.PrSnapshot): T.MergeBlocker | null =>
  row.kind === "open" &&
  (row.ci.kind === "ci-failing" || row.ci.kind === "ci-github-rejected")
    ? { kind: "failing-checks", pr: row.context, ci: row.ci }
    : null;
const gateReason = function (
  row: T.PrSnapshot,
  allowDraft: boolean
): T.MergeGateReason | null {
  if (row.kind === "merged") {return null;}
  if (row.kind === "closed") {return "closed-without-merge";}
  if (row.facts.isDraft && !allowDraft) {return "draft-pr";}
  return row.facts.reviewDecision === "CHANGES_REQUESTED"
    ? "changes-requested"
    : null;
};
const gateBlocker = function (
  row: T.PrSnapshot,
  allowDraft: boolean
): T.MergeBlocker | null {
  const reason = gateReason(row, allowDraft);
  return matchesNull(reason) ||
    (reason === "draft-pr" &&
      row.kind === "open" &&
      row.ci.kind === "ci-pending")
    ? null
    : { kind: "merge-gate", pr: row.context, reason };
};
const readyContribution = function (
  row: T.PrSnapshot,
  allowDraft: boolean
): T.ReadyPr | T.MergedPr | null {
  if (row.kind === "merged")
    {return {
      kind: "merged-pr",
      context: row.context,
      mergedAt: row.facts.mergedAt,
    };}
  if (
    row.kind !== "open" ||
    row.ci.kind !== "ci-clean" ||
    row.threads.length !== 0 ||
    !matchesNull(conflictBlocker(row)) ||
    !matchesNull(gateReason(row, allowDraft))
  )
    {return null;}
  const {reviewDecision} = row.facts;
  if (reviewDecision === "CHANGES_REQUESTED") {return null;}
  return {
    kind: "ready-pr",
    context: row.context,
    proof: {
      mergeability: "clear",
      threads: [],
      ci: row.ci,
      gate: {
        state: "OPEN",
        reviewDecision,
        draft: row.facts.isDraft ? "draft-allowed" : "not-draft",
      },
    },
  };
};
export const classifyPr = function classifyPr(
  row: T.PrSnapshot,
  allowDraft = false
): T.PrDecision {
  for (const blocker of [
    conflictBlocker(row),
    threadBlocker(row),
    ciBlocker(row),
    gateBlocker(row, allowDraft),
  ])
    {if (!matchesNull(blocker)) {return { kind: "blocker", blocker };}}
  if (row.kind === "open" && row.ci.kind === "ci-pending")
    {return { kind: "waiting", frontier: row.context, pending: row.ci.pending };}
  const ready = readyContribution(row, allowDraft);
  if (matchesNull(ready)) {throw new Error("snapshot has no classified decision");}
  return ready.kind === "merged-pr"
    ? { kind: "merged", pr: ready }
    : { kind: "ready", pr: ready };
};
export const selectTierMajorStackDecision = function selectTierMajorStackDecision(
  rows: T.NonEmpty<T.PrSnapshot>,
  allowDraft = false
): T.StackDecision {
  for (const tier of [conflictBlocker, threadBlocker, ciBlocker])
    {for (const row of rows) {
      const blocker = tier(row);
      if (!matchesNull(blocker)) {return { kind: "blocker", blocker };}
    }}
  for (const row of rows) {
    const blocker = gateBlocker(row, allowDraft);
    if (!matchesNull(blocker)) {return { kind: "blocker", blocker };}
  }
  for (const row of rows)
    {if (row.kind === "open" && row.ci.kind === "ci-pending")
      {return {
        kind: "waiting",
        frontier: row.context,
        pending: row.ci.pending,
      };}}
  const prs = nonEmpty(
    rows
      .map((row) => readyContribution(row, allowDraft))
      .filter((row): row is T.ReadyPr | T.MergedPr => !matchesNull(row))
  );
  if (matchesNull(prs) || prs.length !== rows.length)
    {throw new Error("stack has no classified decision");}
  return { kind: "clear", prs };
};
export const queryBackoffSeconds = (
  interval: number,
  failures: number
): number => Math.min(Math.max(interval, 60) * 2 ** (failures - 1), 300);
type Envelope<M extends T.WatchMode> = Readonly<{
  schemaVersion: 1;
  sequence: number;
  observedAt: string;
  mode: M;
}>;
type Payload<V> = V extends unknown
  ? Omit<V, keyof Envelope<T.WatchMode>>
  : never;
type VerdictPayload = Payload<T.WatcherVerdict>;
export interface VerdictStamp<M extends T.WatchMode = T.WatchMode> {
  <const P extends VerdictPayload>(payload: P): Envelope<M> & P;
  <const P extends VerdictPayload, M2 extends T.WatchMode>(
    payload: P,
    mode: M2
  ): Envelope<M2> & P;
}
export const verdictFactory = function verdictFactory<M extends T.WatchMode>(
  clock: WatchClock,
  mode: M
): VerdictStamp<M> {
  let sequence = 0;
  function stamp<const P extends VerdictPayload>(payload: P): Envelope<M> & P;
  function stamp<const P extends VerdictPayload, M2 extends T.WatchMode>(
    payload: P,
    mode: M2
  ): Envelope<M2> & P;
  function stamp<const P extends VerdictPayload>(
    payload: P,
    override?: T.WatchMode
  ): Envelope<T.WatchMode> & P {
    return {
      schemaVersion: 1,
      sequence: (sequence += 1),
      observedAt: clock.observedAt(),
      mode: override ?? mode,
      ...payload,
    };
  }
  return stamp;
};
const blockerVerdict = function (
  stamp: VerdictStamp,
  blocker: T.MergeBlocker
): T.BlockerVerdict {
  switch (blocker.kind) {
    case "merge-conflicts": {
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: 2, blocker });
    }
    case "review-threads": {
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: 3, blocker });
    }
    case "failing-checks": {
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: 4, blocker });
    }
    case "merge-gate": {
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: 6, blocker });
    }
    default: {
      const exhaustive: never = blocker;
      return exhaustive;
    }
  }
};
export const statusQueryVerdict = function statusQueryVerdict(
  stamp: VerdictStamp,
  failures: number,
  failure: T.QueryFailure
): T.BlockerVerdict {
  return stamp({
    kind: "BLOCKER",
    terminal: true,
    exitCode: 7,
    blocker: { kind: "status-query", failures, failure },
  });
};
export interface WatchClock {
  now(): number;
  observedAt(): string;
  sleep(seconds: number): Promise<void>;
}
export type RunDependencies = Readonly<{
  reader: T.GitHubReader;
  clock: WatchClock;
  emit: (verdict: T.ProgressVerdict) => void;
}>;
const deadlinePassed = (
  started: number,
  options: T.PollingOptions,
  now: number
): boolean => options.timeout > 0 && now - started >= options.timeout;
type StepResult<V> =
  | Readonly<{ kind: "terminal"; verdict: V }>
  | Readonly<{
      kind: "sleep";
      seconds: number;
      onDeadline?: () => V;
    }>
  | Readonly<{ kind: "continue" }>;
const pollUntilTerminal = async function <V>(args: Readonly<{
  dependencies: RunDependencies;
  options: T.PollingOptions;
  stamp: VerdictStamp;
  step: () => Promise<StepResult<V>>;
}>): Promise<V | T.BlockerVerdict | T.TimeoutVerdict> {
  let failures = 0;
  const started = args.dependencies.clock.now();
  const sleep = async (seconds: number): Promise<void> => {
    const remaining = args.options.timeout > 0
      ? Math.max(0, args.options.timeout - (args.dependencies.clock.now() - started))
      : seconds;
    await args.dependencies.clock.sleep(Math.min(seconds, remaining));
  };
  while (true) {
    let result: StepResult<V>;
    try {
      result = await args.step();
      failures = 0;
    } catch (error) {
      if (!(error instanceof WatcherQueryError)) {throw error;}
      failures += 1;
      if (!error.failure.retryable || failures >= args.options.maxQueryErrors)
        {return statusQueryVerdict(args.stamp, failures, error.failure);}
      const retryInSeconds = queryBackoffSeconds(
        args.options.interval,
        failures
      );
      args.dependencies.emit(
        args.stamp({
          kind: "RETRY",
          terminal: false,
          failure: error.failure,
          consecutiveFailures: failures,
          retryInSeconds,
        })
      );
      if (deadlinePassed(started, args.options, args.dependencies.clock.now()))
        {return args.stamp({
          kind: "TIMEOUT",
          terminal: true,
          exitCode: 5,
          reason: { kind: "status-unavailable", failure: error.failure },
        });}
      await sleep(retryInSeconds);
      continue;
    }
    if (result.kind === "terminal") {return result.verdict;}
    if (result.kind === "sleep") {
      if (
        !matchesUndefined(result.onDeadline) &&
        deadlinePassed(started, args.options, args.dependencies.clock.now())
      )
        {return result.onDeadline();}
      await sleep(result.seconds);
    }
  }
};
export const runSimple = async function runSimple(args: Readonly<{
  dependencies: RunDependencies;
  contexts: T.NonEmpty<T.PrContext>;
  mode: T.WatchMode;
  statusOnly: boolean;
  options: T.PollingOptions;
}>): Promise<T.TerminalVerdict> {
  const stamp = verdictFactory(args.dependencies.clock, args.mode);
  const step = async (): Promise<StepResult<T.TerminalVerdict>> => {
    const rows: T.PrSnapshot[] = [];
    for (const context of args.contexts)
      {rows.push(
        await readSnapshot({
          reader: args.dependencies.reader,
          context,
          pendingHistory: "include",
          allowDraft: args.options.allowDraft,
        })
      );}
    const complete = nonEmpty(rows);
    if (matchesNull(complete)) {throw new Error("watch context cannot be empty");}
    if (args.statusOnly)
      {return {
        kind: "terminal",
        verdict: stamp({
          kind: "STATUS",
          terminal: true,
          exitCode: 0,
          reason: "status-only",
          rows: complete,
        }),
      };}
    if (args.mode === "queued-stack")
      {throw new Error("queued-stack requires status-only in the simple runner");}
    if (args.mode === "stack")
      {args.dependencies.emit(
        stamp(
          { kind: "STATUS", terminal: false, reason: "poll", rows: complete },
          args.mode
        )
      );}
    const decision =
      args.mode === "single"
        ? classifyPr(complete[0], args.options.allowDraft)
        : selectTierMajorStackDecision(complete, args.options.allowDraft);
    if (decision.kind === "blocker")
      {return {
        kind: "terminal",
        verdict: blockerVerdict(stamp, decision.blocker),
      };}
    if (decision.kind === "ready" || decision.kind === "merged")
      {return {
        kind: "terminal",
        verdict: stamp(
          {
            kind: "READY",
            terminal: true,
            exitCode: 0,
            scope: { kind: "single", pr: decision.pr },
          },
          args.mode
        ),
      };}
    if (decision.kind === "clear")
      {return {
        kind: "terminal",
        verdict: stamp(
          {
            kind: "READY",
            terminal: true,
            exitCode: 0,
            scope: { kind: "stack", prs: decision.prs },
          },
          args.mode
        ),
      };}
    args.dependencies.emit(
      stamp({
        kind: "WAITING",
        terminal: false,
        frontier: decision.frontier,
        reason: { kind: "pending-checks", pending: decision.pending },
      })
    );
    return {
      kind: "sleep",
      seconds: args.options.interval,
      onDeadline: () =>
        stamp({
          kind: "TIMEOUT",
          terminal: true,
          exitCode: 5,
          reason: { kind: "pending-checks", pending: decision.pending },
        }),
    };
  };
  return pollUntilTerminal({
    dependencies: args.dependencies,
    options: args.options,
    stamp,
    step,
  });
};
export type QueueWork =
  | Readonly<{
      kind: "whole-stack-sweep";
      remaining: T.NonEmpty<T.PrContext>;
    }>
  | Readonly<{ kind: "frontier-poll"; frontier: T.PrContext }>;
export type QueueState = Readonly<{
  queue: T.NonEmpty<T.PrContext>;
  snapshots: ReadonlyMap<T.PrNumber, T.PrSnapshot>;
  work: QueueWork | null;
  nextSweepAt: number;
  frontier: T.PrContext | null;
  lastWaitKey: string | null;
  startedAt: number;
}>;
export const createQueueState = (
  queue: T.NonEmpty<T.PrContext>,
  now: number
): QueueState => ({
  queue,
  snapshots: new Map(),
  work: { kind: "whole-stack-sweep", remaining: queue },
  nextSweepAt: now,
  frontier: null,
  lastWaitKey: null,
  startedAt: now,
});
const orderedRows = (state: QueueState): T.PrSnapshot[] =>
  state.queue.flatMap((context) => {
    const row = state.snapshots.get(context.number);
    return matchesUndefined(row) ? [] : [row];
  });
const activeRows = (state: QueueState): T.PrSnapshot[] =>
  orderedRows(state).filter((row) => row.kind !== "merged");
export const planQueue = function planQueue(state: QueueState, now: number): QueueState {
  if (!matchesNull(state.work)) {return state;}
  if (state.snapshots.size === 0 || now >= state.nextSweepAt) {
    const remaining = nonEmpty(
      state.queue.filter(
        (context) => state.snapshots.get(context.number)?.kind !== "merged"
      )
    );
    if (!matchesNull(remaining))
      {return { ...state, work: { kind: "whole-stack-sweep", remaining } };}
  }
  const frontier = activeRows(state)[0]?.context;
  return matchesUndefined(frontier)
    ? state
    : { ...state, work: { kind: "frontier-poll", frontier } };
};
export type QueueSnapshotResult = Readonly<{
  state: QueueState;
  completedSweepRows: T.NonEmpty<T.PrSnapshot> | null;
}>;
export const applyQueueSnapshot = function applyQueueSnapshot(
  state: QueueState,
  snapshot: T.PrSnapshot,
  now: number,
  options: T.PollingOptions
): QueueSnapshotResult {
  if (matchesNull(state.work)) {throw new Error("queue has no read in flight");}
  const snapshots = new Map(state.snapshots);
  snapshots.set(snapshot.context.number, snapshot);
  const base = { ...state, snapshots };
  if (state.work.kind === "frontier-poll")
    {return { state: { ...base, work: null }, completedSweepRows: null };}
  const [head, ...tail] = state.work.remaining;
  if (head.number !== snapshot.context.number)
    {throw new Error("snapshot does not match sweep head");}
  const remaining = nonEmpty(tail);
  if (!matchesNull(remaining))
    {return {
      state: { ...base, work: { kind: "whole-stack-sweep", remaining } },
      completedSweepRows: null,
    };}
  const rows = nonEmpty(
    state.queue.flatMap((context) => {
      const row = snapshots.get(context.number);
      return matchesUndefined(row) ? [] : [row];
    })
  );
  if (matchesNull(rows) || rows.length !== state.queue.length)
    {throw new Error("sweep completed without every snapshot");}
  return {
    state: { ...base, work: null, nextSweepAt: now + options.sweepInterval },
    completedSweepRows: rows,
  };
};
export type QueueEvaluation =
  | Readonly<{
      kind: "complete";
      state: QueueState;
      merged: T.NonEmpty<T.MergedPr>;
    }>
  | Readonly<{
      kind: "blocker";
      state: QueueState;
      blocker: T.MergeBlocker;
    }>
  | Readonly<{
      kind: "advance";
      state: QueueState;
      merged: T.PrContext;
      frontier: T.PrContext;
      remaining: number;
    }>
  | Readonly<{
      kind: "timeout";
      state: QueueState;
      frontier: T.PrContext;
      unmergedCount: number;
    }>
  | Readonly<{
      kind: "waiting";
      state: QueueState;
      frontier: T.PrContext;
      reason:
        | Readonly<{
            kind: "pending-checks";
            pending: T.NonEmpty<T.PendingCheck>;
          }>
        | Readonly<{ kind: "merge-queue"; unmergedCount: number }>;
      emit: boolean;
    }>;
export const evaluateQueue = function evaluateQueue(
  state: QueueState,
  now: number,
  options: T.PollingOptions
): QueueEvaluation {
  const active = activeRows(state);
  if (active.length === 0) {
    const merged = nonEmpty(
      orderedRows(state).flatMap((row) =>
        row.kind === "merged"
          ? [
              {
                kind: "merged-pr" as const,
                context: row.context,
                mergedAt: row.facts.mergedAt,
              },
            ]
          : []
      )
    );
    if (matchesNull(merged)) {throw new Error("empty queue cannot complete");}
    return { kind: "complete", state, merged };
  }
  const rows = nonEmpty(active);
  if (matchesNull(rows)) {throw new Error("active queue cannot be empty");}
  const decision = selectTierMajorStackDecision(rows, options.allowDraft);
  if (decision.kind === "blocker")
    {return { kind: "blocker", state, blocker: decision.blocker };}
  const frontier = rows[0].context;
  if (!matchesNull(state.frontier) && state.frontier.number !== frontier.number)
    {return {
      kind: "advance",
      state: { ...state, frontier, lastWaitKey: null },
      merged: state.frontier,
      frontier,
      remaining: active.length,
    };}
  if (deadlinePassed(state.startedAt, options, now))
    {return {
      kind: "timeout",
      state: { ...state, frontier },
      frontier,
      unmergedCount: active.length,
    };}
  const row = rows[0];
  const pending =
    row.kind === "open" && row.ci.kind === "ci-pending" ? row.ci.pending : null;
  const reason =
    matchesNull(pending)
      ? ({ kind: "merge-queue", unmergedCount: active.length } as const)
      : ({ kind: "pending-checks", pending } as const);
  const key =
    reason.kind === "pending-checks"
      ? `pending:${frontier.number}:${reason.pending.length}`
      : `queue:${frontier.number}:${reason.unmergedCount}`;
  return {
    kind: "waiting",
    state: { ...state, frontier, lastWaitKey: key },
    frontier,
    reason,
    emit: state.lastWaitKey !== key,
  };
};
export const runQueued = async function runQueued(args: Readonly<{
  dependencies: RunDependencies;
  contexts: T.NonEmpty<T.PrContext>;
  options: T.PollingOptions;
}>): Promise<T.QueueTerminalVerdict> {
  let state = createQueueState(args.contexts, args.dependencies.clock.now());
  const stamp = verdictFactory(args.dependencies.clock, "queued-stack");
  args.dependencies.emit(
    stamp({ kind: "QUEUE", terminal: false, queue: args.contexts })
  );
  const step = async (): Promise<StepResult<T.QueueTerminalVerdict>> => {
    state = planQueue(state, args.dependencies.clock.now());
    if (matchesNull(state.work)) {
      const complete = evaluateQueue(
        state,
        args.dependencies.clock.now(),
        args.options
      );
      if (complete.kind !== "complete")
        {throw new Error("queue has no work while active");}
      return {
        kind: "terminal",
        verdict: stamp({
          kind: "COMPLETE",
          terminal: true,
          exitCode: 0,
          queue: state.queue,
          merged: complete.merged,
        }),
      };
    }
    const context =
      state.work.kind === "whole-stack-sweep"
        ? state.work.remaining[0]
        : state.work.frontier;
    const snapshot = await readSnapshot({
      reader: args.dependencies.reader,
      context,
      pendingHistory: "omit",
      allowDraft: args.options.allowDraft,
    });
    const applied = applyQueueSnapshot(
      state,
      snapshot,
      args.dependencies.clock.now(),
      args.options
    );
    state = applied.state;
    if (!matchesNull(applied.completedSweepRows))
      {args.dependencies.emit(
        stamp({
          kind: "STATUS",
          terminal: false,
          reason: "whole-stack-sweep",
          rows: applied.completedSweepRows,
        })
      );}
    if (!matchesNull(state.work)) {return { kind: "continue" };}
    const evaluation = evaluateQueue(
      state,
      args.dependencies.clock.now(),
      args.options
    );
    state = evaluation.state;
    switch (evaluation.kind) {
      case "complete": {
        return {
          kind: "terminal",
          verdict: stamp({
            kind: "COMPLETE",
            terminal: true,
            exitCode: 0,
            queue: state.queue,
            merged: evaluation.merged,
          }),
        };
      }
      case "blocker": {
        return {
          kind: "terminal",
          verdict: blockerVerdict(stamp, evaluation.blocker),
        };
      }
      case "advance": {
        args.dependencies.emit(
          stamp({
            kind: "ADVANCE",
            terminal: false,
            merged: evaluation.merged,
            frontier: evaluation.frontier,
            remaining: evaluation.remaining,
          })
        );
        return { kind: "continue" };
      }
      case "timeout": {
        return {
          kind: "terminal",
          verdict: stamp({
            kind: "TIMEOUT",
            terminal: true,
            exitCode: 5,
            reason: {
              kind: "queued-stack",
              frontier: evaluation.frontier,
              unmergedCount: evaluation.unmergedCount,
            },
          }),
        };
      }
      case "waiting": {
        if (evaluation.emit)
          {args.dependencies.emit(
            stamp({
              kind: "WAITING",
              terminal: false,
              frontier: evaluation.frontier,
              reason: evaluation.reason,
            })
          );}
        return { kind: "sleep", seconds: args.options.interval };
      }
      default: {
        const exhaustive: never = evaluation;
        return exhaustive;
      }
    }
  };
  return pollUntilTerminal({
    dependencies: args.dependencies,
    options: args.options,
    stamp,
    step,
  });
};
