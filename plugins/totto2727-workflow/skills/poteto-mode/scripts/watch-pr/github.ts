import { parseFastCheck } from "./github-check-decode.ts";
import { parseJson, run, runJson } from "./github-command.ts";
import { boolean, enumValue, list, nullableEnum, optionalString, record, string, WIRE_NULL } from "./github-json.ts";
import { WatcherQueryError } from "./github-error.ts";
import { parsePrUrl, parseRemote } from "./github-context.ts";
import { parseReviewThreadPage } from "./github-review-threads.ts";
import { parseCheckRollupPage, parseCommitRollups } from "./github-rollup.ts";
import type * as Types from "./types.ts";
import { parsePrNumber } from "./types.ts";
import { matchesNull } from "./native-predicates.ts";

export const REVIEW_THREADS_QUERY =
  "\nquery ReviewThreads($owner: String!, $repo: String!, $pr: Int!, $after: String) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      reviewThreads(first: 100, after: $after) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        nodes {\n          id\n          isResolved\n          comments(first: 10) {\n            nodes {\n              body\n              createdAt\n              path\n              line\n              author { login }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
export const PR_COMMIT_STATUS_QUERY =
  "\nquery PrCommitStatuses($owner: String!, $repo: String!, $pr: Int!) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      commits(last: 50) {\n        nodes {\n          commit {\n            oid\n            statusCheckRollup {\n              state\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
export const PR_CHECK_ROLLUP_QUERY =
  "\nquery PrCheckRollup($owner: String!, $repo: String!, $pr: Int!, $after: String) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      commits(last: 1) {\n        nodes {\n          commit {\n            statusCheckRollup {\n              contexts(first: 100, after: $after) {\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n                nodes {\n                  __typename\n                  ... on CheckRun {\n                    name\n                    status\n                    conclusion\n                    detailsUrl\n                  }\n                  ... on StatusContext {\n                    context\n                    state\n                    targetUrl\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";

export { resolveContext } from "./github-context.ts";
export { discoverStack, orderStack } from "./github-stack.ts";
export { buildReviewThreads, parseReviewThreadPage, resolveReviewThreads } from "./github-review-threads.ts";
export { mapRollupNode, parseFastCheck } from "./github-check-decode.ts";
export { ChecksUnavailable, resolveChecks } from "./github-checks.ts";
export { errorMessage, WatcherQueryError } from "./github-error.ts";

const MERGE_STATES = [
  "BEHIND",
  "BLOCKED",
  "CLEAN",
  "CONFLICTING",
  "DIRTY",
  "DRAFT",
  "HAS_HOOKS",
  "UNKNOWN",
  "UNSTABLE",
] as const satisfies Readonly<Types.MergeStateStatus[]>;
const REVIEW_DECISIONS = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REVIEW_REQUIRED",
] as const;
// `gh pr view` reports no review decision as "", not null. Only this field does
// It, so the normalization stays here rather than in nullableEnum, where it
// Would stop a genuinely unexpected rollup state from failing closed.
const EMPTY_REVIEW_DECISION = "";
const reviewDecision = (value: unknown): Types.ReviewDecision =>
  nullableEnum(
    value === EMPTY_REVIEW_DECISION ? WIRE_NULL : value,
    REVIEW_DECISIONS,
    "pull request.reviewDecision"
  );
export const parsePullRequest = function parsePullRequest(
  value: unknown,
  context: Types.PrContext
): Types.PullRequestFacts {
  const object = record(value, "pull request");
  const isDraft = boolean(object.isDraft, "pull request.isDraft");
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized field order of decoded pull requests.
  return {
    context,
    mergeable: enumValue(
      object.mergeable,
      ["MERGEABLE", "CONFLICTING", "UNKNOWN"] as const,
      "pull request.mergeable"
    ),
    mergeStateStatus: enumValue(
      object.mergeStateStatus,
      MERGE_STATES,
      "pull request.mergeStateStatus"
    ),
    reviewDecision: reviewDecision(object.reviewDecision),
    headRefOid: optionalString(object.headRefOid, "pull request.headRefOid"),
    headRefName: string(object.headRefName, "pull request.headRefName"),
    baseRefName: string(object.baseRefName, "pull request.baseRefName"),
    state: enumValue(
      object.state,
      ["OPEN", "CLOSED", "MERGED"] as const,
      "pull request.state"
    ),
    mergedAt: optionalString(object.mergedAt, "pull request.mergedAt"),
    isDraft,
  };
};
const COMMAND_SUCCESS = 0;
const CHECKS_FAILED = 1;
const CHECKS_PENDING = 8;
const CHECKS_RESULT_CODES = new Set([COMMAND_SUCCESS, CHECKS_FAILED, CHECKS_PENDING]);

const graphqlArgs = function (
  query: string,
  context: Types.PrContext
): [string, ...string[]] {
  return [
    "gh",
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-f",
    `owner=${context.owner}`,
    "-f",
    `repo=${context.repo}`,
    "-F",
    `pr=${context.number}`,
  ];
};

export class GhGitHubReader implements Types.GitHubReader {
  // oxlint-disable-next-line eslint/class-methods-use-this -- GitHubReader exposes origin discovery as a stateless instance method.
  public async originRepo(): Promise<Types.Repository | null> {
    const result = await run(["git", "remote", "get-url", "origin"]);
    return result.code === COMMAND_SUCCESS ? parseRemote(result.stdout) : WIRE_NULL;
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep the GitHubReader instance method for discovery from the current checkout.
  public async currentPr(pr: Types.PrNumber | null): Promise<Types.PrContext> {
    const argv: [string, ...string[]] = ["gh", "pr", "view"];
    if (!matchesNull(pr)) {argv.push(String(pr));}
    argv.push("--json", "number,url");
    const object = record(await runJson(argv), "current PR");
    const parsed = parsePrUrl(string(object.url, "current PR.url"));
    return {
      ...parsed,
      number: pr ?? parsePrNumber(object.number, "current PR.number"),
    };
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep GitHubReader method dispatch for stateless pull request queries.
  public async pullRequest(context: Types.PrContext): Promise<Types.PullRequestFacts> {
    return parsePullRequest(
      await runJson([
        "gh",
        "pr",
        "view",
        String(context.number),
        "--repo",
        `${context.owner}/${context.repo}`,
        "--json",
        "mergeable,mergeStateStatus,reviewDecision,headRefOid,headRefName,baseRefName,state,mergedAt,isDraft",
      ]),
      context
    );
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep GitHubReader method dispatch for stateless stack discovery.
  public async openPullRequests(
    repository: Types.Repository
  ): Promise<Readonly<Types.OpenPullRequest[]>> {
    const value = await runJson([
      "gh",
      "pr",
      "list",
      "--repo",
      `${repository.owner}/${repository.repo}`,
      "--state",
      "open",
      "--limit",
      "300",
      "--json",
      "number,headRefName,baseRefName,isCrossRepository",
    ]);
    return list(value, "open PRs").map((item, index) => {
      const object = record(item, `open PRs[${index}]`);
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized field order of the open-pull-request payload.
      return {
        isCrossRepository: boolean(object.isCrossRepository, `open PRs[${index}].isCrossRepository`),
        number: parsePrNumber(object.number, `open PRs[${index}].number`),
        headRefName: string(
          object.headRefName,
          `open PRs[${index}].headRefName`
        ),
        baseRefName: string(
          object.baseRefName,
          `open PRs[${index}].baseRefName`
        ),
      };
    });
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep GitHubReader method dispatch for the stateless checks fast path.
  public async checksFastPath(context: Types.PrContext): Promise<Types.ChecksFastPath> {
    const result = await run([
      "gh",
      "pr",
      "checks",
      String(context.number),
      "--repo",
      `${context.owner}/${context.repo}`,
      "--json",
      "name,state,description,link,workflow,bucket",
    ]);
    if (CHECKS_RESULT_CODES.has(result.code) && result.stdout.trim()) {
      try {
        const value = parseJson(result.stdout, "gh pr checks");
        if (Array.isArray(value)) {
          // oxlint-disable-next-line eslint/sort-keys -- Preserve the field order of the tagged fast checks result.
          return { kind: "checks", checks: value.map((check) => parseFastCheck(check)) };
        }
      } catch (error) {
        if (!(error instanceof WatcherQueryError)) {throw error;}
      }
    }
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the field order of the tagged fast checks fallback.
    return { kind: "unusable", exitCode: result.code, stderr: result.stderr };
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep the GitHubReader instance method for cursor-based check queries.
  public async checkRollupPage(
    context: Types.PrContext,
    after: string | null
  ): Promise<Types.RollupPage> {
    const argv = graphqlArgs(PR_CHECK_ROLLUP_QUERY, context);
    if (!matchesNull(after)) {argv.push("-f", `after=${after}`);}
    return parseCheckRollupPage(await runJson(argv));
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep the GitHubReader instance method for cursor-based review queries.
  public async reviewThreadPage(
    context: Types.PrContext,
    after: string | null
  ): Promise<Types.ReviewThreadPage> {
    const argv = graphqlArgs(REVIEW_THREADS_QUERY, context);
    if (!matchesNull(after)) {argv.push("-f", `after=${after}`);}
    return parseReviewThreadPage(await runJson(argv));
  }
  // oxlint-disable-next-line eslint/class-methods-use-this -- Keep GitHubReader method dispatch for stateless commit status queries.
  public async commitRollups(
    context: Types.PrContext
  ): Promise<Readonly<Types.CommitRollup[]>> {
    return parseCommitRollups(await runJson(graphqlArgs(PR_COMMIT_STATUS_QUERY, context)));
  }
}
