import { resolveChecks, resolveReviewThreads } from "./github.ts";
import { matchesNull } from "./native-predicates.ts";
import { nonEmpty } from "./types.ts";
import type {
  Check,
  CheckRead,
  CiState,
  FailedCheck,
  GitHubMergeAssessment,
  GitHubReader,
  MergeStateStatus,
  NonEmpty,
  PendingCheck,
  PrContext,
  PrSnapshot,
  PullRequestFacts,
  RollupState,
} from "./types.ts";

// oxlint-disable-next-line unicorn/no-null -- GitHub returns a JSON null when a commit has no rollup.
const NO_ROLLUP: RollupState = null;

export const assessGitHubMerge = function assessGitHubMerge({ headRollupState, mergeStateStatus }: Readonly<{
  mergeStateStatus: MergeStateStatus;
  headRollupState: RollupState;
}>): GitHubMergeAssessment {
  if (mergeStateStatus === "BLOCKED") {
    if (headRollupState === "ERROR" || headRollupState === "FAILURE") {
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the watcher report's serialized refusal fields.
      return { kind: "refused", mergeStateStatus, headRollupState };
    }
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the watcher's serialized assessment fields.
    return { kind: "allowed", basis: "rollup", mergeStateStatus, headRollupState };
  }
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the watcher's serialized assessment fields.
  return { kind: "allowed", basis: "merge-state", mergeStateStatus, headRollupState };
};

interface MergeHistory {
  github: GitHubMergeAssessment;
  hadPreviousPassingCi: boolean;
}

const mergeHistory = async (reader: GitHubReader, facts: PullRequestFacts): Promise<MergeHistory> => {
  const commits = await reader.commitRollups(facts.context);
  const headOid = facts.headRefOid;
  const headRollupState = matchesNull(headOid) ? NO_ROLLUP : (commits.find((commit) => commit.oid === headOid)?.state ?? NO_ROLLUP);
  const hadPreviousPassingCi = commits.some((commit) => commit.oid !== headOid && commit.state === "SUCCESS");
  return { github: assessGitHubMerge({ headRollupState, mergeStateStatus: facts.mergeStateStatus }), hadPreviousPassingCi };
};

interface UnsettledChecks {
  failed: NonEmpty<FailedCheck> | null;
  pending: NonEmpty<PendingCheck> | null;
}

const assessedCi = (read: CheckRead, { failed, pending }: UnsettledChecks, { github, hadPreviousPassingCi }: MergeHistory): CiState => {
  // oxlint-disable-next-line eslint/sort-keys -- Keep CI fields in their existing JSON output order.
  const base = { source: read.source, all: read.checks, hadPreviousPassingCi };
  if (!matchesNull(failed)) {
    // oxlint-disable-next-line eslint/sort-keys -- Keep CI fields in their existing JSON output order.
    return { ...base, kind: "ci-failing", failed, pending: pending ?? [], github };
  }
  if (github.kind === "refused") {
    // oxlint-disable-next-line eslint/sort-keys -- Keep CI fields in their existing JSON output order.
    return { ...base, kind: "ci-github-rejected", failed: [], pending: pending ?? [], github };
  }
  if (matchesNull(pending)) {
    // oxlint-disable-next-line eslint/sort-keys -- Keep CI fields in their existing JSON output order.
    return { ...base, kind: "ci-clean", failed: [], pending: [], github };
  }
  // oxlint-disable-next-line eslint/sort-keys -- Keep CI fields in their existing JSON output order.
  return { ...base, kind: "ci-pending", failed: [], pending };
};

type SnapshotInput = Readonly<{
  reader: GitHubReader;
  context: PrContext;
  pendingHistory: "include" | "omit";
  allowDraft: boolean;
}>;

const readCi = async (checks: CheckRead, facts: PullRequestFacts, { reader, pendingHistory }: SnapshotInput): Promise<CiState> => {
  const failed = nonEmpty(checks.checks.filter((check) => check.kind === "failed"));
  const pending = nonEmpty(checks.checks.filter((check) => check.kind === "pending"));
  if (matchesNull(failed) && !matchesNull(pending) && pendingHistory === "omit") {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the pending fast path's existing JSON field order.
    return { kind: "ci-pending", source: checks.source, all: checks.checks, failed: [], pending, hadPreviousPassingCi: false };
  }
  return assessedCi(checks, { failed, pending }, await mergeHistory(reader, facts));
};

const AUTOMATION_TOKENS = ["bugbot", "security review", "pr review automation", "review automation"] as const;

const automationRunning = (checks: NonEmpty<Check>): boolean =>
  checks.some((check) => check.kind === "pending" &&
    AUTOMATION_TOKENS.some((token) => check.name.toLowerCase().includes(token)));

const closedSnapshot = (kind: "merged" | "closed", context: PrContext, facts: PullRequestFacts): PrSnapshot =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep terminal snapshots in their existing JSON order.
  ({ kind, context, facts });

export const readSnapshot = async function readSnapshot(args: SnapshotInput): Promise<PrSnapshot> {
  const { context, reader } = args;
  const facts = await reader.pullRequest(context);
  if (facts.state === "MERGED" || !matchesNull(facts.mergedAt)) {return closedSnapshot("merged", context, facts);}
  if (facts.state === "CLOSED") {return closedSnapshot("closed", context, facts);}
  const threads = await resolveReviewThreads(reader, context);
  const checks = await resolveChecks(reader, context);
  const ci = await readCi(checks, facts, args);
  // oxlint-disable-next-line eslint/sort-keys -- Retain the existing JSON order of open snapshots.
  return { kind: "open", context, facts, threads, ci, reviewAutomationRunning: automationRunning(checks.checks) };
};
