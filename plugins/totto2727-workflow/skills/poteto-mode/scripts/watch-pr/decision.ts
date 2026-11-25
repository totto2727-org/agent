import { matchesNull, matchesUndefined } from "./native-predicates.ts";
import { nonEmpty } from "./types.ts";
import type { MergeBlocker, MergeGateReason, MergedPr, NonEmpty, PrDecision, PrSnapshot, ReadyPr, StackDecision } from "./types.ts";

const conflictBlocker = (row: PrSnapshot): MergeBlocker | undefined => {
  if (row.kind !== "open") {return undefined;}
  const { mergeable, mergeStateStatus } = row.facts;
  if (mergeable !== "CONFLICTING" && mergeStateStatus !== "DIRTY" && mergeStateStatus !== "CONFLICTING") {return undefined;}
  // oxlint-disable-next-line eslint/sort-keys -- Retain the watcher's serialized blocker fields.
  return { kind: "merge-conflicts", pr: row.context, facts: row.facts };
};

const threadBlocker = (row: PrSnapshot): MergeBlocker | undefined => {
  if (row.kind !== "open") {return undefined;}
  const threads = nonEmpty(row.threads);
  return matchesNull(threads) ? undefined : { kind: "review-threads", pr: row.context, threads };
};

const ciBlocker = (row: PrSnapshot): MergeBlocker | undefined => {
  if (row.kind !== "open" || (row.ci.kind !== "ci-failing" && row.ci.kind !== "ci-github-rejected")) {return undefined;}
  // oxlint-disable-next-line eslint/sort-keys -- Retain the watcher's serialized CI blocker fields.
  return { kind: "failing-checks", pr: row.context, ci: row.ci };
};

const gateReason = (row: PrSnapshot, allowDraft: boolean): MergeGateReason | undefined => {
  if (row.kind === "merged") {return undefined;}
  if (row.kind === "closed") {return "closed-without-merge";}
  if (row.facts.isDraft && !allowDraft) {return "draft-pr";}
  return row.facts.reviewDecision === "CHANGES_REQUESTED" ? "changes-requested" : undefined;
};

const gateBlocker = (row: PrSnapshot, allowDraft: boolean): MergeBlocker | undefined => {
  const reason = gateReason(row, allowDraft);
  if (matchesUndefined(reason) || (reason === "draft-pr" && row.kind === "open" && row.ci.kind === "ci-pending")) {
    return undefined;
  }
  return { kind: "merge-gate", pr: row.context, reason };
};

const readyContribution = (row: PrSnapshot, allowDraft: boolean): ReadyPr | MergedPr | undefined => {
  if (row.kind === "merged") {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the watcher's serialized proof of a merged PR.
    return { kind: "merged-pr", context: row.context, mergedAt: row.facts.mergedAt };
  }
  if (
    row.kind !== "open" || row.ci.kind !== "ci-clean" || Boolean(row.threads.length) ||
    !matchesUndefined(conflictBlocker(row)) || !matchesUndefined(gateReason(row, allowDraft))
  ) {return undefined;}
  const { reviewDecision } = row.facts;
  if (reviewDecision === "CHANGES_REQUESTED") {return undefined;}
  // oxlint-disable-next-line eslint/sort-keys -- Retain state, review decision, and draft status order in serialized ready proofs.
  const gate: ReadyPr["proof"]["gate"] = { state: "OPEN", reviewDecision, draft: row.facts.isDraft ? "draft-allowed" : "not-draft" };
  // oxlint-disable-next-line eslint/sort-keys -- Keep ready proof fields in their original serialized order.
  const proof: ReadyPr["proof"] = { mergeability: "clear", threads: [], ci: row.ci, gate };
  // oxlint-disable-next-line eslint/sort-keys -- Keep the decision's serialized fields in their original order.
  return { kind: "ready-pr", context: row.context, proof };
};

type Waiting = Extract<PrDecision, { kind: "waiting" }>;
type Blocked = Extract<PrDecision, { kind: "blocker" }>;

const waitingOn = (row: PrSnapshot): Waiting | undefined => {
  if (row.kind !== "open" || row.ci.kind !== "ci-pending") {return undefined;}
  // oxlint-disable-next-line eslint/sort-keys -- Keep the original waiting decision field order.
  return { kind: "waiting", frontier: row.context, pending: row.ci.pending };
};

const blocked = (blocker: MergeBlocker): Blocked =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep the original blocker decision field order.
  ({ kind: "blocker", blocker });

export const classifyPr = function classifyPr(row: PrSnapshot, allowDraft = false): PrDecision {
  const blocker = [conflictBlocker(row), threadBlocker(row), ciBlocker(row), gateBlocker(row, allowDraft)]
    .find((candidate) => !matchesUndefined(candidate));
  if (!matchesUndefined(blocker)) {return blocked(blocker);}
  const waiting = waitingOn(row);
  if (!matchesUndefined(waiting)) {return waiting;}
  const ready = readyContribution(row, allowDraft);
  if (matchesUndefined(ready)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the standalone watcher's internal invariant failure.
    throw new Error("snapshot has no classified decision");
  }
  return ready.kind === "merged-pr" ? { kind: "merged", pr: ready } : { kind: "ready", pr: ready };
};

const firstMatching = <Result>(rows: NonEmpty<PrSnapshot>, read: (row: PrSnapshot) => Result | undefined): Result | undefined => {
  // oxlint-disable-next-line rules/no-for-loops -- A stack decision uses the first matching PR in its original order.
  for (const row of rows) {
    const decision = read(row);
    if (!matchesUndefined(decision)) {return decision;}
  }
  return undefined;
};

export const selectTierMajorStackDecision = function selectTierMajorStackDecision(rows: NonEmpty<PrSnapshot>, allowDraft = false): StackDecision {
  const blocker =
    firstMatching(rows, conflictBlocker) ?? firstMatching(rows, threadBlocker) ??
    firstMatching(rows, ciBlocker) ?? firstMatching(rows, (row) => gateBlocker(row, allowDraft));
  if (!matchesUndefined(blocker)) {return blocked(blocker);}
  const waiting = firstMatching(rows, waitingOn);
  if (!matchesUndefined(waiting)) {return waiting;}
  const prs = nonEmpty(rows.map((row) => readyContribution(row, allowDraft)).filter((row) => !matchesUndefined(row)));
  if (matchesNull(prs) || prs.length !== rows.length) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native invariant failure when a stack lacks a classified decision.
    throw new Error("stack has no classified decision");
  }
  return { kind: "clear", prs };
};
