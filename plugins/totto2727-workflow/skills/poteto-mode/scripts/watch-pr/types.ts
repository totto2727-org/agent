import { isEmptyArray, isNumber } from "./native-predicates.ts";

export type { ChecksFastPath, GitHubReader, RawReviewThread, ReviewThreadPage, RollupPage } from "./github-reader-types.ts";
export type { BlockerVerdict, ExitCode, ProgressVerdict, QueueTerminalVerdict, TerminalVerdict, TimeoutVerdict, WatcherVerdict, WatchMode } from "./verdict-types.ts";

declare const prNumberBrand: unique symbol;
const FIRST_ITEM = 0;
const NEXT_ITEM = 1;
const MINIMUM_PR_NUMBER = 1;
// oxlint-disable-next-line unicorn/no-null -- The existing non-empty tuple helper returns this sentinel for an empty array.
const NO_ITEMS = null;
export type PrNumber = number & Readonly<{ [prNumberBrand]: "PrNumber" }>;
export type NonEmpty<T> = Readonly<[T, ...T[]]>;
export const nonEmpty = function nonEmpty<T>(items: Readonly<T[]>): NonEmpty<T> | null {
  return isEmptyArray(items) ? NO_ITEMS : [items[FIRST_ITEM], ...items.slice(NEXT_ITEM)];
};
export const parsePrNumber = function parsePrNumber(value: unknown, label = "PR number"): PrNumber {
  if (!isNumber(value) || !Number.isInteger(value) || value < MINIMUM_PR_NUMBER) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native validation error consumed by both CLI and GitHub context parsing.
    throw new Error(`${label} must be a positive integer`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The checked number is an integer in the PR number domain.
  return value as PrNumber;
};
export type Repository = Readonly<{
  owner: string;
  repo: string;
}>;
export type PrContext = Repository & Readonly<{
  number: PrNumber;
}>;
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
export type PullRequestFacts = Readonly<{
  context: PrContext;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: MergeStateStatus;
  reviewDecision: ReviewDecision;
  headRefOid: string | null;
  headRefName: string;
  baseRefName: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
  isDraft: boolean;
}>;
export type OpenPullRequest = Readonly<{
  number: PrNumber;
  isCrossRepository: boolean;
  headRefName: string;
  baseRefName: string;
}>;
export type ReviewComment = Readonly<{
  authorLogin: string | null;
  body: string;
  path: string | null;
  line: number | null;
  createdAt: string;
}>;
export type ReviewThread = Readonly<{
  id: string;
  firstComment: ReviewComment | null;
  isBugbot: boolean;
  bugbotReviewPasses: number;
}>;
type CheckDetails = Readonly<{
  name: string;
  reportedState: string;
  description: string;
  link: string;
  workflow: string;
}>;
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
export type CheckRead = Readonly<{
  source: "gh-pr-checks" | "graphql-rollup";
  checks: NonEmpty<Check>;
}>;
export type CommitRollup = Readonly<{
  oid: string;
  state: RollupState;
}>;
export type GitHubMergeRefusal = Readonly<{
  kind: "refused";
  mergeStateStatus: "BLOCKED";
  headRollupState: "ERROR" | "FAILURE";
}>;
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
type CiBase = Readonly<{
  source: CheckRead["source"];
  all: NonEmpty<Check>;
  hadPreviousPassingCi: boolean;
}>;
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
export type ReadyPr = Readonly<{
  kind: "ready-pr";
  context: PrContext;
  proof: Readonly<{
    mergeability: "clear";
    threads: Readonly<[]>;
    ci: CiClean;
    gate: Readonly<{
      state: "OPEN";
      reviewDecision: Exclude<ReviewDecision, "CHANGES_REQUESTED">;
      draft: "not-draft" | "draft-allowed";
    }>;
  }>;
}>;
export type MergedPr = Readonly<{
  kind: "merged-pr";
  context: PrContext;
  mergedAt: string | null;
}>;
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
export type WaitingDecision = Readonly<{
  kind: "waiting";
  frontier: PrContext;
  pending: NonEmpty<PendingCheck>;
}>;
export type PrDecision =
  | Readonly<{ kind: "blocker"; blocker: MergeBlocker }>
  | WaitingDecision
  | Readonly<{ kind: "ready"; pr: ReadyPr }>
  | Readonly<{ kind: "merged"; pr: MergedPr }>;
export type StackDecision =
  | Readonly<{ kind: "blocker"; blocker: MergeBlocker }>
  | WaitingDecision
  | Readonly<{ kind: "clear"; prs: NonEmpty<ReadyPr | MergedPr> }>;
export type PollingOptions = Readonly<{
  interval: number;
  sweepInterval: number;
  timeout: number;
  maxQueryErrors: number;
  allowDraft: boolean;
}>;
