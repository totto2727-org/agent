import type { BlockerVerdict, MergeBlocker, QueryFailure, WatcherVerdict, WatchMode } from "./types.ts";

const VERDICT_SCHEMA_VERSION = 1;
const INITIAL_VERDICT_SEQUENCE = 0;
const VERDICT_SEQUENCE_STEP = 1;
const EXIT_CONFLICTS = 2;
const EXIT_THREADS = 3;
const EXIT_CHECKS = 4;
const EXIT_GATE = 6;
const EXIT_QUERY = 7;

export interface WatchClock {
  now: () => number;
  observedAt: () => string;
  // oxlint-disable-next-line typescript/method-signature-style -- Retain the public clock's method assignability for standalone watcher consumers.
  sleep(seconds: number): Promise<void>;
}

type Envelope<Mode extends WatchMode> = Readonly<{
  schemaVersion: typeof VERDICT_SCHEMA_VERSION;
  sequence: number;
  observedAt: string;
  mode: Mode;
}>;
type Payload<Value> = Value extends unknown ? Omit<Value, keyof Envelope<WatchMode>> : never;
type VerdictPayload = Payload<WatcherVerdict>;

export interface VerdictStamp<Mode extends WatchMode = WatchMode> {
  <const Data extends VerdictPayload>(payload: Data): Envelope<Mode> & Data;
  <const Data extends VerdictPayload, Override extends WatchMode>(payload: Data, mode: Override): Envelope<Override> & Data;
}

export const verdictFactory = function verdictFactory<Mode extends WatchMode>(clock: WatchClock, mode: Mode): VerdictStamp<Mode> {
  const counter = { sequence: INITIAL_VERDICT_SEQUENCE };
  function stamp<const Data extends VerdictPayload>(payload: Data): Envelope<Mode> & Data;
  function stamp<const Data extends VerdictPayload, Override extends WatchMode>(payload: Data, mode: Override): Envelope<Override> & Data;
  function stamp<const Data extends VerdictPayload>(payload: Data, override?: WatchMode): Envelope<WatchMode> & Data {
    counter.sequence += VERDICT_SEQUENCE_STEP;
    // oxlint-disable-next-line eslint/sort-keys -- Keep the public NDJSON envelope's field order before the payload.
    return { schemaVersion: VERDICT_SCHEMA_VERSION, sequence: counter.sequence, observedAt: clock.observedAt(), mode: override ?? mode, ...payload };
  }
  return stamp;
};

export const blockerVerdict = (stamp: VerdictStamp, blocker: MergeBlocker): BlockerVerdict => {
  switch (blocker.kind) {
    case "merge-conflicts": {
      // oxlint-disable-next-line eslint/sort-keys -- Retain the existing serialized blocker envelope.
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: EXIT_CONFLICTS, blocker });
    }
    case "review-threads": {
      // oxlint-disable-next-line eslint/sort-keys -- Retain the existing serialized blocker envelope.
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: EXIT_THREADS, blocker });
    }
    case "failing-checks": {
      // oxlint-disable-next-line eslint/sort-keys -- Retain the existing serialized blocker envelope.
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: EXIT_CHECKS, blocker });
    }
    case "merge-gate": {
      // oxlint-disable-next-line eslint/sort-keys -- Retain the existing serialized blocker envelope.
      return stamp({ kind: "BLOCKER", terminal: true, exitCode: EXIT_GATE, blocker });
    }
    default: {
      const exhaustive: never = blocker;
      return exhaustive;
    }
  }
};

export const statusQueryVerdict = function statusQueryVerdict(stamp: VerdictStamp, failures: number, failure: QueryFailure): BlockerVerdict {
  // oxlint-disable-next-line eslint/sort-keys -- Retain blocker envelope and query failure field order in NDJSON.
  return stamp({ kind: "BLOCKER", terminal: true, exitCode: EXIT_QUERY, blocker: { kind: "status-query", failures, failure } });
};
