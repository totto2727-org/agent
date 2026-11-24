declare const prNumberBrand: unique symbol;
export type PrNumber = number & Readonly<{ [prNumberBrand]: "PrNumber" }>;
export type NonEmpty<T> = Readonly<[T, ...T[]]>;
export function nonEmpty<T>(items: Readonly<T[]>): NonEmpty<T> | null {
  return items.length === 0 ? null : [items[0], ...items.slice(1)];
}
export function parsePrNumber(value: unknown, label = "PR number"): PrNumber {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0)
    {throw new Error(`${label} must be a positive integer`);}
  return value as PrNumber;
}
export interface Repository {
  readonly owner: string;
  readonly repo: string;
}
export interface PrContext extends Repository {
  readonly number: PrNumber;
}
export type MergeStateStatus =
  | "BEHIND"
  | "BLOCKED"
  | "CLEAN"
  | "CONFLICTING"
  | "DIRTY"
  | "DRAFT"
  | "HAS_HOOKS"
  | "UNKNOWN"
  | "UNSTABLE";
export type RollupState =
  | "ERROR"
  | "EXPECTED"
  | "FAILURE"
  | "PENDING"
  | "SUCCESS"
  | null;
export type ReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REVIEW_REQUIRED"
  | null;
export interface PullRequestFacts {
  readonly context: PrContext;
  readonly mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  readonly mergeStateStatus: MergeStateStatus;
  readonly reviewDecision: ReviewDecision;
  readonly headRefOid: string | null;
  readonly headRefName: string;
  readonly baseRefName: string;
  readonly state: "OPEN" | "CLOSED" | "MERGED";
  readonly mergedAt: string | null;
  readonly isDraft: boolean;
}
export interface OpenPullRequest {
  readonly number: PrNumber;
  readonly isCrossRepository: boolean;
  readonly headRefName: string;
  readonly baseRefName: string;
}
export interface ReviewComment {
  readonly authorLogin: string | null;
  readonly body: string;
  readonly path: string | null;
  readonly line: number | null;
  readonly createdAt: string;
}
export interface ReviewThread {
  readonly id: string;
  readonly firstComment: ReviewComment | null;
  readonly isBugbot: boolean;
  readonly bugbotReviewPasses: number;
}
interface CheckDetails {
  readonly name: string;
  readonly reportedState: string;
  readonly description: string;
  readonly link: string;
  readonly workflow: string;
}
export type Check =
  | (CheckDetails & Readonly<{ kind: "passed" }>)
  | (CheckDetails & Readonly<{ kind: "skipped" }>)
  | (CheckDetails & Readonly<{ kind: "failed" }>)
  | (CheckDetails & Readonly<{ kind: "pending" }>)
  | (CheckDetails & Readonly<{
      kind: "code-review-gate";
      name: "Code Review Gate";
    }>);
export type FailedCheck = Extract<Check, Readonly<{ kind: "failed" }>>;
export type PendingCheck = Extract<Check, Readonly<{ kind: "pending" }>>;
export interface CheckRead {
  readonly source: "gh-pr-checks" | "graphql-rollup";
  readonly checks: NonEmpty<Check>;
}
export interface CommitRollup {
  readonly oid: string;
  readonly state: RollupState;
}
export interface GitHubMergeRefusal {
  readonly kind: "refused";
  readonly mergeStateStatus: "BLOCKED";
  readonly headRollupState: "ERROR" | "FAILURE";
}
export type GitHubMergeAllowed =
  | Readonly<{
      kind: "allowed";
      basis: "merge-state";
      mergeStateStatus: Exclude<MergeStateStatus, "BLOCKED">;
      headRollupState: RollupState;
    }>
  | Readonly<{
      kind: "allowed";
      basis: "rollup";
      mergeStateStatus: "BLOCKED";
      headRollupState: Exclude<RollupState, "ERROR" | "FAILURE">;
    }>;
export type GitHubMergeAssessment = GitHubMergeAllowed | GitHubMergeRefusal;
interface CiBase {
  readonly source: CheckRead["source"];
  readonly all: NonEmpty<Check>;
  readonly hadPreviousPassingCi: boolean;
}
export type CiFailing = CiBase & Readonly<{
  kind: "ci-failing";
  failed: NonEmpty<FailedCheck>;
  pending: Readonly<PendingCheck[]>;
  github: GitHubMergeAssessment;
}>;
export type CiGithubRejected = CiBase & Readonly<{
  kind: "ci-github-rejected";
  failed: Readonly<[]>;
  pending: Readonly<PendingCheck[]>;
  github: GitHubMergeRefusal;
}>;
export type CiPending = CiBase & Readonly<{
  kind: "ci-pending";
  failed: Readonly<[]>;
  pending: NonEmpty<PendingCheck>;
}>;
export type CiClean = CiBase & Readonly<{
  kind: "ci-clean";
  failed: Readonly<[]>;
  pending: Readonly<[]>;
  github: GitHubMergeAllowed;
}>;
export type CiState = CiFailing | CiGithubRejected | CiPending | CiClean;
export type PrSnapshot =
  | Readonly<{
      kind: "merged" | "closed";
      context: PrContext;
      facts: PullRequestFacts;
    }>
  | Readonly<{
      kind: "open";
      context: PrContext;
      facts: PullRequestFacts;
      threads: Readonly<ReviewThread[]>;
      ci: CiState;
      reviewAutomationRunning: boolean;
    }>;
export interface ReadyPr {
  readonly kind: "ready-pr";
  readonly context: PrContext;
  readonly proof: Readonly<{
    mergeability: "clear";
    threads: Readonly<[]>;
    ci: CiClean;
    gate: Readonly<{
      state: "OPEN";
      reviewDecision: Exclude<ReviewDecision, "CHANGES_REQUESTED">;
      draft: "not-draft" | "draft-allowed";
    }>;
  }>;
}
export interface MergedPr {
  readonly kind: "merged-pr";
  readonly context: PrContext;
  readonly mergedAt: string | null;
}
export type MergeGateReason =
  | "closed-without-merge"
  | "draft-pr"
  | "changes-requested";
export type MergeBlocker =
  | Readonly<{
      kind: "merge-conflicts";
      pr: PrContext;
      facts: PullRequestFacts;
    }>
  | Readonly<{
      kind: "review-threads";
      pr: PrContext;
      threads: NonEmpty<ReviewThread>;
    }>
  | Readonly<{
      kind: "failing-checks";
      pr: PrContext;
      ci: CiFailing | CiGithubRejected;
    }>
  | Readonly<{
      kind: "merge-gate";
      pr: PrContext;
      reason: MergeGateReason;
    }>;
export type QueryFailure =
  | Readonly<{
      kind: "json-parse";
      retryable: true;
      detail: string;
    }>
  | Readonly<{
      kind: "missing-key";
      retryable: true;
      detail: string;
      rawValue?: string;
    }>
  | Readonly<{
      kind: "command-exit";
      retryable: true;
      detail: string;
      code: number;
    }>
  | Readonly<{
      kind: "checks-unavailable";
      retryable: true;
      detail: string;
    }>
  | Readonly<{
      kind: "invalid-context-url";
      retryable: false;
      detail: string;
      rawValue: string;
    }>;
/**
 * `frontier` names the lowest unmerged PR that is actually waiting, and
 * `pending` is that PR's checks only. Pooling every row's pending under the
 * bottom PR's number misattributed upstack waits to the frontier.
 *
 * This decision serves single and `--stack` mode. Queued mode deliberately
 * reports its own merge frontier instead: when that PR is blocker-free it
 * emits a merge-queue wait that ignores upstack pending, because upstack
 * checks do not block the frontier's merge. That is the Python watcher's
 * contract, not an attribution bug.
 */
export interface WaitingDecision {
  readonly kind: "waiting";
  readonly frontier: PrContext;
  readonly pending: NonEmpty<PendingCheck>;
}
export type PrDecision =
  | Readonly<{ kind: "blocker"; blocker: MergeBlocker }>
  | WaitingDecision
  | Readonly<{ kind: "ready"; pr: ReadyPr }>
  | Readonly<{ kind: "merged"; pr: MergedPr }>;
export type StackDecision =
  | Readonly<{ kind: "blocker"; blocker: MergeBlocker }>
  | WaitingDecision
  | Readonly<{ kind: "clear"; prs: NonEmpty<ReadyPr | MergedPr> }>;
export type WatchMode = "single" | "stack" | "queued-stack";
interface EventBase<K extends string, M extends WatchMode = WatchMode> {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly observedAt: string;
  readonly mode: M;
  readonly kind: K;
}
interface Progress<K extends string, M extends WatchMode = WatchMode>
  extends EventBase<K, M> {
  readonly terminal: false;
}
interface Terminal<
  K extends string,
  C extends number,
  M extends WatchMode = WatchMode,
> extends EventBase<K, M> {
  readonly terminal: true;
  readonly exitCode: C;
}
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
  | (Terminal<"BLOCKER", 2> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "merge-conflicts" }>
      >;
    }>)
  | (Terminal<"BLOCKER", 3> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "review-threads" }>
      >;
    }>)
  | (Terminal<"BLOCKER", 4> & Readonly<{
      blocker: Extract<
        MergeBlocker,
        Readonly<{ kind: "failing-checks" }>
      >;
    }>)
  | (Terminal<"BLOCKER", 6> & Readonly<{
      blocker: Extract<MergeBlocker, Readonly<{ kind: "merge-gate" }>>;
    }>)
  | (Terminal<"BLOCKER", 7> & Readonly<{
      blocker: Readonly<{
        kind: "status-query";
        failures: number;
        failure: QueryFailure;
      }>;
    }>);
export type TimeoutVerdict = Terminal<"TIMEOUT", 5> & Readonly<{
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
  | (Terminal<"STATUS", 0> & Readonly<{
      reason: "status-only";
      rows: NonEmpty<PrSnapshot>;
    }>)
  | (Terminal<"READY", 0, "single" | "stack"> & Readonly<{
      scope:
        | Readonly<{ kind: "single"; pr: ReadyPr | MergedPr }>
        | Readonly<{
            kind: "stack";
            prs: NonEmpty<ReadyPr | MergedPr>;
          }>;
    }>)
  | (Terminal<"COMPLETE", 0, "queued-stack"> & Readonly<{
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
export type ChecksFastPath =
  | Readonly<{ kind: "checks"; checks: Readonly<Check[]> }>
  | Readonly<{
      kind: "unusable";
      exitCode: number;
      stderr: string;
    }>;
export interface RollupPage {
  readonly checks: Readonly<Check[]>;
  readonly endCursor: string | null;
}
export interface RawReviewThread {
  readonly id: string;
  readonly firstComment: ReviewComment | null;
  readonly resolved: boolean;
}
export interface ReviewThreadPage {
  readonly threads: Readonly<RawReviewThread[]>;
  readonly endCursor: string | null;
}
export interface GitHubReader {
  originRepo(): Promise<Repository | null>;
  currentPr(pr: PrNumber | null): Promise<PrContext>;
  pullRequest(context: PrContext): Promise<PullRequestFacts>;
  openPullRequests(repository: Repository): Promise<Readonly<OpenPullRequest[]>>;
  checksFastPath(context: PrContext): Promise<ChecksFastPath>;
  checkRollupPage(
    context: PrContext,
    after: string | null
  ): Promise<RollupPage>;
  reviewThreadPage(
    context: PrContext,
    after: string | null
  ): Promise<ReviewThreadPage>;
  commitRollups(context: PrContext): Promise<Readonly<CommitRollup[]>>;
}
export interface PollingOptions {
  readonly interval: number;
  readonly sweepInterval: number;
  readonly timeout: number;
  readonly maxQueryErrors: number;
  readonly allowDraft: boolean;
}
