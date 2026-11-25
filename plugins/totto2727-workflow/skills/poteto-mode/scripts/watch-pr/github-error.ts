import type { QueryFailure } from "./types.ts";

// oxlint-disable-next-line rules/require-tagged-error -- The independently installed watcher uses its existing native error class for retry policy.
export class WatcherQueryError extends Error {
  // oxlint-disable-next-line rules/no-readonly -- Keep the readonly failure payload on the published native watcher error.
  public readonly failure: QueryFailure;

  public constructor(failure: QueryFailure) {
    super(failure.detail);
    this.name = "WatcherQueryError";
    this.failure = failure;
  }
}

export const errorMessage = (error: unknown): string =>
  // oxlint-disable-next-line rules/no-instanceof-error -- Preserve native and non-Error throw diagnostics in the standalone watcher.
  error instanceof Error ? error.message : String(error);
