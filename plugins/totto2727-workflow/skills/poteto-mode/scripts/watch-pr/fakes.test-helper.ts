import type {
  Check,
  ChecksFastPath,
  CommitRollup,
  GitHubReader,
  OpenPullRequest,
  PrContext,
  PullRequestFacts,
  Repository,
  RawReviewThread,
  ReviewThread,
  ReviewThreadPage,
  RollupPage,
} from "./types.ts";
import { parsePrNumber } from "./types.ts";
import { WIRE_NULL } from "./github-json.ts";
import { matchesUndefined } from "./native-predicates.ts";

export type FakeReaderOptions = Readonly<{
  facts?: Partial<Omit<PullRequestFacts, "context">>;
  fastPath?: ChecksFastPath;
  rollupPages?: Readonly<RollupPage[]>;
  threads?: Readonly<ReviewThread[]>;
  threadPages?: Readonly<ReviewThreadPage[]>;
  commitRollups?: Readonly<CommitRollup[]>;
  openPullRequests?: Readonly<OpenPullRequest[]>;
  origin?: Repository | null;
  current?: PrContext;
}>;

const toRawThread = function (thread: ReviewThread): RawReviewThread {
  return { firstComment: thread.firstComment, id: thread.id, resolved: false };
};

export const passingCheck = function passingCheck(name = "ci"): Check {
  return {
    description: "",
    kind: "passed",
    link: "",
    name,
    reportedState: "SUCCESS",
    workflow: "",
  };
};

export const pendingCheck = function pendingCheck(name = "ci"): Check {
  return {
    description: "",
    kind: "pending",
    link: "",
    name,
    reportedState: "PENDING",
    workflow: "",
  };
};

export const failedCheck = function failedCheck(name = "ci"): Check {
  return {
    description: "",
    kind: "failed",
    link: "",
    name,
    reportedState: "FAILURE",
    workflow: "",
  };
};

const FIRST_FAKE_PULL = 1;
const FIRST_PAGE = 0;
const PAGE_STEP = 1;

const fakeFacts = (context: PrContext): PullRequestFacts => ({
  baseRefName: "main",
  context,
  headRefName: "feature",
  headRefOid: "head",
  isDraft: false,
  mergeStateStatus: "CLEAN",
  mergeable: "MERGEABLE",
  mergedAt: WIRE_NULL,
  reviewDecision: "APPROVED",
  state: "OPEN",
});

const takePage = (cursor: { page: number }): number => {
  const { page } = cursor;
  cursor.page += PAGE_STEP;
  return page;
};

const fakePages = (options: FakeReaderOptions, calls: string[]): Pick<GitHubReader, "checkRollupPage" | "reviewThreadPage"> => {
  const checks = { page: FIRST_PAGE };
  const review = { page: FIRST_PAGE };
  return {
    async checkRollupPage(_requested, after) {
      calls.push(`checkRollupPage:${after ?? "null"}`);
      const value = options.rollupPages?.[takePage(checks)] ?? { checks: [], endCursor: WIRE_NULL };
      await Promise.resolve();
      return value;
    },
    async reviewThreadPage(_requested, after) {
      calls.push(`reviewThreadPage:${after ?? "null"}`);
      const value = options.threadPages?.[takePage(review)] ?? {
        endCursor: WIRE_NULL,
        threads: (options.threads ?? []).map((thread) => toRawThread(thread)),
      };
      await Promise.resolve();
      return value;
    },
  };
};

export const fakeReader = function fakeReader(
  options: FakeReaderOptions = {}
): GitHubReader & Readonly<{ calls: Readonly<string[]> }> {
  const calls: string[] = [];
  const context = options.current ?? { number: parsePrNumber(FIRST_FAKE_PULL), owner: "owner", repo: "repo" };
  const defaults = fakeFacts(context);
  return {
    ...fakePages(options, calls),
    calls,
    async checksFastPath() {
      calls.push("checksFastPath");
      const value = options.fastPath ?? { checks: [passingCheck()], kind: "checks" };
      await Promise.resolve();
      return value;
    },
    async commitRollups() {
      calls.push("commitRollups");
      const value = options.commitRollups ?? [{ oid: "head", state: "SUCCESS" }];
      await Promise.resolve();
      return value;
    },
    async currentPr(pr) {
      calls.push("currentPr");
      const value = { ...context, number: pr ?? context.number };
      await Promise.resolve();
      return value;
    },
    async openPullRequests() {
      calls.push("openPullRequests");
      const value = options.openPullRequests ?? [];
      await Promise.resolve();
      return value;
    },
    async originRepo() {
      calls.push("originRepo");
      const value = matchesUndefined(options.origin) ? { owner: "owner", repo: "repo" } : options.origin;
      await Promise.resolve();
      return value;
    },
    async pullRequest(requested) {
      calls.push("pullRequest");
      const value = { ...defaults, ...options.facts, context: requested };
      await Promise.resolve();
      return value;
    },
  };
};
