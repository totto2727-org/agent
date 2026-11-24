// oxlint-disable-next-line rules/no-node-imports -- The standalone Bun watcher uses this built-in to remove terminal control codes before writing the watcher's report.
import { stripVTControlCharacters } from "node:util";
import type * as Watch from "./types.ts";
import { visitItems } from "./native-iteration.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";

const EMPTY = 0;
const SINGULAR_COUNT = 1;
const FIRST_LINE_COUNT = 1;
const BODY_PREVIEW_LENGTH = 180;
const pluralSuffix = (count: number): string => count === SINGULAR_COUNT ? "" : "s";

export const renderJson = (verdict: Watch.WatcherVerdict): string =>
  `${JSON.stringify(verdict)}\n`;
const ciCell = function (row: Watch.PrSnapshot): string {
  if (row.kind !== "open") {return "\u2014";}
  const was = row.ci.hadPreviousPassingCi ? ", was ✅" : "";
  switch (row.ci.kind) {
    case "ci-clean": {
      return "✅";
    }
    case "ci-pending": {
      return `⏳ ${row.ci.pending.length} pending${was}`;
    }
    case "ci-failing": {
      return `❌ ${row.ci.failed.length} failed${row.ci.pending.length > EMPTY ? `, ${row.ci.pending.length} pending` : ""}${was}`;
    }
    case "ci-github-rejected": {
      return `❌ GitHub reports failing checks${was}`;
    }
    default: {
      const exhaustive: never = row.ci;
      return exhaustive;
    }
  }
};
const reviewCell = function (row: Watch.PrSnapshot): string {
  if (row.kind !== "open") {return "\u2014";}
  const open = row.threads.length;
  if (row.reviewAutomationRunning) {
    return open > EMPTY ? `🤖 running, ${open} open` : "🤖 running";
  }
  return open > EMPTY ? `📝 ${open} open` : "✅";
};
const mergeCell = function (row: Watch.PrSnapshot): string {
  if (row.kind === "merged") {return "✅ merged";}
  if (row.kind === "closed") {return "❌ closed";}
  if (row.facts.isDraft) {return "⏸ draft";}
  if (row.facts.reviewDecision === "CHANGES_REQUESTED")
    {return "⚠️ changes requested";}
  return row.facts.mergeable === "CONFLICTING" ||
    row.facts.mergeStateStatus === "DIRTY" ||
    row.facts.mergeStateStatus === "CONFLICTING"
    ? "⚠️ conflict"
    : "✅";
};
export const renderStatusTable = function renderStatusTable(rows: Watch.NonEmpty<Watch.PrSnapshot>): string {
  const lines = ["| PR | CI | Review | Merge |", "| --- | --- | --- | --- |"];
  visitItems(rows, (row) => {
    const url = `https://github.com/${row.context.owner}/${row.context.repo}/pull/${row.context.number}`;
    lines.push(
      `| [#${row.context.number}](${url}) | ${ciCell(row)} | ${reviewCell(row)} | ${mergeCell(row)} |`
    );
  });
  return `${lines.join("\n")}\n`;
};
const sanitizeText = function (value: string): string {
  return stripVTControlCharacters(value).replaceAll(/\p{Cc}/gu, "");
};
const displayText = (value: string | null | undefined): string => {
  if (matchesNull(value) || matchesUndefined(value)) {return "None";}
  return value.length === EMPTY ? "None" : sanitizeText(value);
};
const threadLine = function (thread: Watch.ReviewThread): string {
  const comment = thread.firstComment;
  const path = displayText(comment?.path);
  const authorLogin = displayText(comment?.authorLogin);
  const [bodyLine = ""] = (comment?.body ?? "").split(/\r?\n/u, FIRST_LINE_COUNT);
  const sanitizedBody = sanitizeText(bodyLine).slice(EMPTY, BODY_PREVIEW_LENGTH);
  return [
    thread.id,
    path,
    comment?.line ?? "None",
    authorLogin,
    `isBugBot=${thread.isBugbot}`,
    `bugbotReviewPasses=${thread.bugbotReviewPasses}`,
    sanitizedBody,
  ].join(" ");
};
type StatusQueryBlocker = Readonly<{
  kind: "status-query";
  failures: number;
  failure: Readonly<{ detail: string }>;
}>;
type FailingChecksBlocker = Extract<Watch.MergeBlocker, { kind: "failing-checks" }>;
const renderFailingChecks = (blocker: FailingChecksBlocker): string => {
  const failed = blocker.ci.kind === "ci-failing" ? blocker.ci.failed : [];
  const details = failed.map(
    (check) => `${check.name} ${check.reportedState} ${check.description} ${check.link}`,
  );
  if (blocker.ci.kind === "ci-github-rejected") {
    details.push(
      `mergeStateStatus=${blocker.ci.github.mergeStateStatus}`,
      `headRollupState=${blocker.ci.github.headRollupState}`,
    );
  }
  return [
    "BLOCKER: failing-checks",
    `pr=${blocker.pr.number}`,
    `failed=${failed.length}`,
    ...details,
  ].join("\n");
};

type MergeGate = Extract<Watch.MergeBlocker, { kind: "merge-gate" }>;
const mergeGateAction = (reason: MergeGate["reason"]): string => {
  if (reason === "closed-without-merge") {return "restore or remove the closed PR from the queued stack";}
  if (reason === "draft-pr") {return "mark the PR ready for review before waiting for the merge queue";}
  return "resolve the changes-requested review before waiting for the merge queue";
};

const renderBlocker = function (blocker: Watch.MergeBlocker | StatusQueryBlocker): string {
  switch (blocker.kind) {
    case "merge-conflicts": {
      return [
        "BLOCKER: merge-conflicts",
        `pr=${blocker.pr.number}`,
        `mergeable=${blocker.facts.mergeable}`,
        `mergeStateStatus=${blocker.facts.mergeStateStatus}`,
        "action=resolve merge conflicts before waiting for CI",
      ].join("\n");
    }
    case "review-threads": {
      return [
        "BLOCKER: review-threads",
        `pr=${blocker.pr.number}`,
        `unresolved=${blocker.threads.length}`,
        ...blocker.threads.map(threadLine),
      ].join("\n");
    }
    case "failing-checks": {
      return renderFailingChecks(blocker);
    }
    case "merge-gate": {
      return [
        `BLOCKER: ${blocker.reason}`,
        `pr=${blocker.pr.number}`,
        `action=${mergeGateAction(blocker.reason)}`,
      ].join("\n");
    }
    case "status-query": {
      return [
        "BLOCKER: status-query",
        `failures=${blocker.failures}`,
        `detail=${blocker.failure.detail}`,
        "action=verify current PR context, GitHub authentication, and API availability, then rearm",
      ].join("\n");
    }
    default: {
      const exhaustive: never = blocker;
      return exhaustive;
    }
  }
};
type WaitingVerdict = Extract<Watch.ProgressVerdict, { kind: "WAITING" }>;
const renderWaiting = (verdict: WaitingVerdict): string => {
  if (verdict.reason.kind === "pending-checks") {
    const count = verdict.reason.pending.length;
    return `WAITING: frontier=#${verdict.frontier.number}; ${count} check${pluralSuffix(count)} pending\n`;
  }
  const count = verdict.reason.unmergedCount;
  return `WAITING: frontier=#${verdict.frontier.number} is blocker-free; waiting for merge queue (${count} PR${pluralSuffix(count)} unmerged)\n`;
};

type ProgressMessage = Exclude<Watch.ProgressVerdict, { kind: "STATUS" }>;
const renderProgress = (verdict: ProgressMessage): string => {
  switch (verdict.kind) {
    case "QUEUE": {
      const { length } = verdict.queue;
      return `QUEUE: captured ${length} PR${pluralSuffix(length)} bottom-to-top: ${verdict.queue.map((pr) => `#${pr.number}`).join(",")}\n`;
    }
    case "WAITING": {
      return renderWaiting(verdict);
    }
    case "ADVANCE": {
      return `ADVANCE: merged #${verdict.merged.number}; next=#${verdict.frontier.number}; remaining=${verdict.remaining}\n`;
    }
    case "RETRY": {
      return `RETRY: GitHub status query failed; retrying in ${verdict.retryInSeconds}s\ndetail=${verdict.failure.detail}\n`;
    }
    default: {
      const exhaustive: never = verdict;
      return exhaustive;
    }
  }
};

const renderReadyDetail = (scope: Extract<Watch.TerminalVerdict, { kind: "READY" }>["scope"]): string => {
  if (scope.kind !== "single" || scope.pr.kind !== "ready-pr") {return "";}
  const { ci, gate } = scope.pr.proof;
  const isDraft = gate.draft === "draft-allowed";
  const note = isDraft ? "\nnote=draft allowed (--allow-draft); leave draft \u2014 do not mark ready" : "";
  return `\nmergeStateStatus=${ci.github.mergeStateStatus}\nreviewDecision=${gate.reviewDecision}\nisDraft=${isDraft}${note}`;
};

const renderTimeout = (reason: Watch.TimeoutVerdict["reason"]): string => {
  if (reason.kind === "pending-checks") {return "TIMEOUT: checks still pending\n";}
  if (reason.kind === "status-unavailable") {return "TIMEOUT: GitHub status remained unavailable\n";}
  return `TIMEOUT: queued stack still has ${reason.unmergedCount} PR${pluralSuffix(reason.unmergedCount)} unmerged; frontier=#${reason.frontier.number}\n`;
};

type TerminalMessage = Exclude<Watch.TerminalVerdict, { kind: "STATUS" }>;
const renderTerminal = (verdict: TerminalMessage): string => {
  switch (verdict.kind) {
    case "BLOCKER": {
      return `${renderBlocker(verdict.blocker)}\n`;
    }
    case "READY": {
      return `READY: no merge conflicts, no unresolved review threads, no failing or pending checks${renderReadyDetail(verdict.scope)}\n`;
    }
    case "COMPLETE": {
      const { length } = verdict.queue;
      return `COMPLETE: queued stack merged (${length} PR${pluralSuffix(length)})\n`;
    }
    case "TIMEOUT": {
      return renderTimeout(verdict.reason);
    }
    default: {
      const exhaustive: never = verdict;
      return exhaustive;
    }
  }
};

export const renderPretty = (verdict: Watch.WatcherVerdict): string => {
  if (verdict.kind === "STATUS") {return renderStatusTable(verdict.rows);}
  return verdict.terminal ? renderTerminal(verdict) : renderProgress(verdict);
};
