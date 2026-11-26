import { WatcherQueryError } from "./github.ts";
import type { PollingOptions, PrContext } from "./types.ts";
import { parsePrNumber } from "./types.ts";

export const START = 0;
export const FIRST_READ = 1;
export const OBSERVED_AT = "2026-07-26T00:00:00.000Z";
const FAILED_COMMAND = 1;

export const context = (number: number): PrContext => ({
  number: parsePrNumber(number),
  owner: "owner",
  repo: "repo",
});

export const options = {
  allowDraft: false,
  interval: 10,
  maxQueryErrors: 5,
  sweepInterval: 300,
  timeout: 0,
} satisfies PollingOptions;

export const queryFailure = (detail: string): WatcherQueryError =>
  new WatcherQueryError({ code: FAILED_COMMAND, detail, kind: "command-exit", retryable: true });

// oxlint-disable-next-line rules/require-tagged-error -- A native fixture error ends simulated polling independently from tagged watcher query retries.
export const stopPolling = (message: string): Error => new Error(message);
