import type { Check, CommitRollup, OpenPullRequest, PrContext, PrNumber, PullRequestFacts, Repository, ReviewComment } from "./types.ts";

export type ChecksFastPath =
  | Readonly<{ kind: "checks"; checks: Readonly<Check[]> }>
  | Readonly<{
      kind: "unusable";
      exitCode: number;
      stderr: string;
    }>;
export type RollupPage = Readonly<{
  checks: Readonly<Check[]>;
  endCursor: string | null;
}>;
export type RawReviewThread = Readonly<{
  id: string;
  firstComment: ReviewComment | null;
  resolved: boolean;
}>;
export type ReviewThreadPage = Readonly<{
  threads: Readonly<RawReviewThread[]>;
  endCursor: string | null;
}>;
export interface GitHubReader {
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  originRepo(): Promise<Repository | null>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  currentPr(pr: PrNumber | null): Promise<PrContext>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  pullRequest(context: PrContext): Promise<PullRequestFacts>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  openPullRequests(repository: Repository): Promise<Readonly<OpenPullRequest[]>>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  checksFastPath(context: PrContext): Promise<ChecksFastPath>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  checkRollupPage(
    context: PrContext,
    after: string | null
  ): Promise<RollupPage>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  reviewThreadPage(
    context: PrContext,
    after: string | null
  ): Promise<ReviewThreadPage>;
  // oxlint-disable-next-line typescript/method-signature-style -- Keep the existing native reader method contract and assignability.
  commitRollups(context: PrContext): Promise<Readonly<CommitRollup[]>>;
}
