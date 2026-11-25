import { selectTierMajorStackDecision } from "./decision.ts";
import { readSnapshot } from "./snapshot.ts";
import { deadlinePassed, pollUntilTerminal } from "./polling.ts";
import type { RunDependencies, StepResult } from "./polling.ts";
import { blockerVerdict, verdictFactory } from "./verdict.ts";
import type * as T from "./types.ts";
import { nonEmpty } from "./types.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";

export { assessGitHubMerge, readSnapshot } from "./snapshot.ts";

export { classifyPr, selectTierMajorStackDecision } from "./decision.ts";

export { queryBackoffSeconds } from "./polling.ts";
export type { RunDependencies } from "./polling.ts";
export { statusQueryVerdict, verdictFactory } from "./verdict.ts";
export type { VerdictStamp, WatchClock } from "./verdict.ts";

export { runSimple } from "./simple.ts";

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
