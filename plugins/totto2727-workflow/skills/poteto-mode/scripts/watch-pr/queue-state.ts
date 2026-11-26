import { selectTierMajorStackDecision } from "./decision.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";
import { deadlinePassed } from "./polling.ts";
import { nonEmpty } from "./types.ts";
import type * as Types from "./types.ts";

// oxlint-disable-next-line unicorn/no-null -- Keep the established empty queue fields in watcher state and snapshots.
const EMPTY_QUEUE_FIELD = null;
const FIRST_QUEUE_ROW = 0;

const invariant = (message: string): Error =>
  // oxlint-disable-next-line rules/require-tagged-error -- Internal queue invariants retain their native errors at the watcher boundary.
  new Error(message);

export type QueueWork =
  | Readonly<{
      kind: "whole-stack-sweep";
      remaining: Types.NonEmpty<Types.PrContext>;
    }>
  | Readonly<{ kind: "frontier-poll"; frontier: Types.PrContext }>;
export type QueueState = Readonly<{
  queue: Types.NonEmpty<Types.PrContext>;
  snapshots: ReadonlyMap<Types.PrNumber, Types.PrSnapshot>;
  work: QueueWork | null;
  nextSweepAt: number;
  frontier: Types.PrContext | null;
  lastWaitKey: string | null;
  startedAt: number;
}>;
export type QueueSnapshotResult = Readonly<{
  state: QueueState;
  completedSweepRows: Types.NonEmpty<Types.PrSnapshot> | null;
}>;
export type QueueEvaluation =
  | Readonly<{
      kind: "complete";
      state: QueueState;
      merged: Types.NonEmpty<Types.MergedPr>;
    }>
  | Readonly<{
      kind: "blocker";
      state: QueueState;
      blocker: Types.MergeBlocker;
    }>
  | Readonly<{
      kind: "advance";
      state: QueueState;
      merged: Types.PrContext;
      frontier: Types.PrContext;
      remaining: number;
    }>
  | Readonly<{
      kind: "timeout";
      state: QueueState;
      frontier: Types.PrContext;
      unmergedCount: number;
    }>
  | Readonly<{
      kind: "waiting";
      state: QueueState;
      frontier: Types.PrContext;
      reason:
        | Readonly<{
            kind: "pending-checks";
            pending: Types.NonEmpty<Types.PendingCheck>;
          }>
        | Readonly<{ kind: "merge-queue"; unmergedCount: number }>;
      emit: boolean;
    }>;

export const createQueueState = (queue: Types.NonEmpty<Types.PrContext>, now: number): QueueState =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain the existing serialized queue field order.
  ({ queue, snapshots: new Map(), work: { kind: "whole-stack-sweep", remaining: queue }, nextSweepAt: now, frontier: EMPTY_QUEUE_FIELD, lastWaitKey: EMPTY_QUEUE_FIELD, startedAt: now });

const orderedRows = (state: QueueState): Types.PrSnapshot[] =>
  state.queue.flatMap((context) => {
    const row = state.snapshots.get(context.number);
    return matchesUndefined(row) ? [] : [row];
  });

const activeRows = (state: QueueState): Types.PrSnapshot[] =>
  orderedRows(state).filter((row) => row.kind !== "merged");

export const planQueue = function planQueue(state: QueueState, now: number): QueueState {
  if (!matchesNull(state.work)) {return state;}
  if (!state.snapshots.size || now >= state.nextSweepAt) {
    const remaining = nonEmpty(state.queue.filter((context) => state.snapshots.get(context.number)?.kind !== "merged"));
    if (!matchesNull(remaining)) {return { ...state, work: { kind: "whole-stack-sweep", remaining } };}
  }
  const frontier = activeRows(state)[FIRST_QUEUE_ROW]?.context;
  // oxlint-disable-next-line eslint/sort-keys -- Keep the frontier work fields ordered as before.
  return matchesUndefined(frontier) ? state : { ...state, work: { kind: "frontier-poll", frontier } };
};

const snapshotResult = (state: QueueState, completedSweepRows: Types.NonEmpty<Types.PrSnapshot> | null = EMPTY_QUEUE_FIELD): QueueSnapshotResult =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep the snapshot result's order for consumers that serialize queue state.
  ({ state, completedSweepRows });

interface SweepCompletion {
  now: number;
  options: Types.PollingOptions;
  work: Extract<QueueWork, { kind: "whole-stack-sweep" }>;
}

const completeSweep = (state: QueueState, snapshot: Types.PrSnapshot, { now, options, work }: SweepCompletion): QueueSnapshotResult => {
  const [head, ...tail] = work.remaining;
  if (head.number !== snapshot.context.number) {throw invariant("snapshot does not match sweep head");}
  const remaining = nonEmpty(tail);
  if (!matchesNull(remaining)) {return snapshotResult({ ...state, work: { kind: "whole-stack-sweep", remaining } });}
  const rows = nonEmpty(orderedRows(state));
  if (matchesNull(rows) || rows.length !== state.queue.length) {throw invariant("sweep completed without every snapshot");}
  return snapshotResult({ ...state, nextSweepAt: now + options.sweepInterval, work: EMPTY_QUEUE_FIELD }, rows);
};

// oxlint-disable-next-line eslint/max-params -- Preserve the queue state update signature used by the watcher and its consumers.
export const applyQueueSnapshot = function applyQueueSnapshot(state: QueueState, snapshot: Types.PrSnapshot, now: number, options: Types.PollingOptions): QueueSnapshotResult {
  const { work } = state;
  if (matchesNull(work)) {throw invariant("queue has no read in flight");}
  const snapshots = new Map([...state.snapshots, [snapshot.context.number, snapshot]]);
  const base = { ...state, snapshots };
  return work.kind === "frontier-poll"
    ? snapshotResult({ ...base, work: EMPTY_QUEUE_FIELD })
    : completeSweep(base, snapshot, { now, options, work });
};

const allMerged = (state: QueueState): QueueEvaluation => {
  const merged = nonEmpty(orderedRows(state).flatMap((row) => {
    if (row.kind !== "merged") {return [];}
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing merged PR payload order.
    return [{ kind: "merged-pr" as const, context: row.context, mergedAt: row.facts.mergedAt }];
  }));
  if (matchesNull(merged)) {throw invariant("empty queue cannot complete");}
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public queue evaluation field order.
  return { kind: "complete", state, merged };
};

type WaitingReason = Extract<QueueEvaluation, { kind: "waiting" }>["reason"];

const waitingReason = (row: Types.PrSnapshot, unmergedCount: number): WaitingReason =>
  row.kind === "open" && row.ci.kind === "ci-pending"
    ? { kind: "pending-checks", pending: row.ci.pending }
    : { kind: "merge-queue", unmergedCount };

const waiting = (state: QueueState, rows: Types.NonEmpty<Types.PrSnapshot>, frontier: Types.PrContext): QueueEvaluation => {
  const reason = waitingReason(rows[FIRST_QUEUE_ROW], rows.length);
  const key = reason.kind === "pending-checks"
    ? `pending:${frontier.number}:${reason.pending.length}`
    : `queue:${frontier.number}:${reason.unmergedCount}`;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public waiting result's field order.
  return { kind: "waiting", state: { ...state, frontier, lastWaitKey: key }, frontier, reason, emit: state.lastWaitKey !== key };
};

const evaluateFrontier = (state: QueueState, rows: Types.NonEmpty<Types.PrSnapshot>, { now, options }: { now: number; options: Types.PollingOptions }): QueueEvaluation => {
  const frontier = rows[FIRST_QUEUE_ROW].context;
  if (!matchesNull(state.frontier) && state.frontier.number !== frontier.number) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the queue advance record's field order.
    return { kind: "advance", state: { ...state, frontier, lastWaitKey: EMPTY_QUEUE_FIELD }, merged: state.frontier, frontier, remaining: rows.length };
  }
  if (deadlinePassed(state.startedAt, options, now)) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the queue timeout record's field order.
    return { kind: "timeout", state: { ...state, frontier }, frontier, unmergedCount: rows.length };
  }
  return waiting(state, rows, frontier);
};

export const evaluateQueue = function evaluateQueue(state: QueueState, now: number, options: Types.PollingOptions): QueueEvaluation {
  const rows = nonEmpty(activeRows(state));
  if (matchesNull(rows)) {return allMerged(state);}
  const decision = selectTierMajorStackDecision(rows, options.allowDraft);
  if (decision.kind === "blocker") {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the public blocker evaluation field order.
    return { kind: "blocker", state, blocker: decision.blocker };
  }
  return evaluateFrontier(state, rows, { now, options });
};
