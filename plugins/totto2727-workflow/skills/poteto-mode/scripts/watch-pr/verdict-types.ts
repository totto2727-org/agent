import type { MergeBlocker, MergedPr, NonEmpty, PendingCheck, PrContext, PrSnapshot, QueryFailure, ReadyPr } from "./types.ts";
import type { EXIT_CHECKS, EXIT_CONFLICTS, EXIT_GATE, EXIT_QUERY, EXIT_SUCCESS, EXIT_THREADS, EXIT_TIMEOUT, VERDICT_SCHEMA_VERSION } from "./verdict-contract.ts";

export type WatchMode = "single" | "stack" | "queued-stack";
type EventBase<K extends string, M extends WatchMode = WatchMode> = Readonly<{
  schemaVersion: typeof VERDICT_SCHEMA_VERSION;
  sequence: number;
  observedAt: string;
  mode: M;
  kind: K;
}>;
type Progress<K extends string, M extends WatchMode = WatchMode> = EventBase<K, M> & Readonly<{
  terminal: false;
}>;
type Terminal<
  K extends string,
  C extends number,
  M extends WatchMode = WatchMode,
> = EventBase<K, M> & Readonly<{
  terminal: true;
  exitCode: C;
}>;
export type ProgressVerdict =
  | (Progress<"QUEUE", "queued-stack"> & Readonly<{
      queue: NonEmpty<PrContext>;
    }>)
  | (Progress<"STATUS", "stack" | "queued-stack"> & Readonly<{
      reason: "poll" | "whole-stack-sweep";
      rows: NonEmpty<PrSnapshot>;
    }>)
  | (Progress<"WAITING"> & Readonly<{
      frontier: PrContext;
      reason:
        | Readonly<{
            kind: "pending-checks";
            pending: NonEmpty<PendingCheck>;
          }>
        | Readonly<{ kind: "merge-queue"; unmergedCount: number }>;
    }>)
  | (Progress<"ADVANCE", "queued-stack"> & Readonly<{
      merged: PrContext;
      frontier: PrContext;
      remaining: number;
    }>)
  | (Progress<"RETRY"> & Readonly<{
      failure: QueryFailure;
      consecutiveFailures: number;
      retryInSeconds: number;
    }>);
export type BlockerVerdict =
  | (Terminal<"BLOCKER", typeof EXIT_CONFLICTS> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "merge-conflicts" }>
      >;
    }>)
  | (Terminal<"BLOCKER", typeof EXIT_THREADS> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "review-threads" }>
      >;
    }>)
  | (Terminal<"BLOCKER", typeof EXIT_CHECKS> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "failing-checks" }>
      >;
    }>)
  | (Terminal<"BLOCKER", typeof EXIT_GATE> & Readonly<{
      blocker: Extract<MergeBlocker, Readonly<{ kind: "merge-gate" }>>;
    }>)
  | (Terminal<"BLOCKER", typeof EXIT_QUERY> & Readonly<{
      blocker: Readonly<{
        kind: "status-query";
        failures: number;
        failure: QueryFailure;
      }>;
    }>);
export type TimeoutVerdict = Terminal<"TIMEOUT", typeof EXIT_TIMEOUT> & Readonly<{
  reason:
    | Readonly<{
        kind: "pending-checks";
        pending: NonEmpty<PendingCheck>;
      }>
    | Readonly<{ kind: "status-unavailable"; failure: QueryFailure }>
    | Readonly<{
        kind: "queued-stack";
        frontier: PrContext;
        unmergedCount: number;
      }>;
}>;
export type TerminalVerdict =
  | (Terminal<"STATUS", typeof EXIT_SUCCESS> & Readonly<{
      reason: "status-only";
      rows: NonEmpty<PrSnapshot>;
    }>)
  | (Terminal<"READY", typeof EXIT_SUCCESS, "single" | "stack"> & Readonly<{
      scope:
        | Readonly<{ kind: "single"; pr: ReadyPr | MergedPr }>
        | Readonly<{
            kind: "stack";
            prs: NonEmpty<ReadyPr | MergedPr>;
          }>;
    }>)
  | (Terminal<"COMPLETE", typeof EXIT_SUCCESS, "queued-stack"> & Readonly<{
      queue: NonEmpty<PrContext>;
      merged: NonEmpty<MergedPr>;
    }>)
  | BlockerVerdict
  | TimeoutVerdict;
export type WatcherVerdict = ProgressVerdict | TerminalVerdict;
export type ExitCode = TerminalVerdict["exitCode"];
export type QueueTerminalVerdict =
  | Extract<TerminalVerdict, Readonly<{ kind: "COMPLETE" }>>
  | BlockerVerdict
  | TimeoutVerdict;
