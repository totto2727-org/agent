import { mapRollupNode, parseFastCheck } from "./github-check-decode.ts";
import { parseJson, run, runJson } from "./github-command.ts";
import { at, boolean, enumValue, list, nullableEnum, optionalString, record, string, WIRE_NULL } from "./github-json.ts";
import { errorMessage, WatcherQueryError } from "./github-error.ts";
import { parseReviewThreadPage } from "./github-review-threads.ts";
import type * as Types from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";
import { visitItems } from "./native-iteration.ts";

export const REVIEW_THREADS_QUERY =
  "\nquery ReviewThreads($owner: String!, $repo: String!, $pr: Int!, $after: String) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      reviewThreads(first: 100, after: $after) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        nodes {\n          id\n          isResolved\n          comments(first: 10) {\n            nodes {\n              body\n              createdAt\n              path\n              line\n              author { login }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
export const PR_COMMIT_STATUS_QUERY =
  "\nquery PrCommitStatuses($owner: String!, $repo: String!, $pr: Int!) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      commits(last: 50) {\n        nodes {\n          commit {\n            oid\n            statusCheckRollup {\n              state\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
export const PR_CHECK_ROLLUP_QUERY =
  "\nquery PrCheckRollup($owner: String!, $repo: String!, $pr: Int!, $after: String) {\n  repository(owner: $owner, name: $repo) {\n    pullRequest(number: $pr) {\n      commits(last: 1) {\n        nodes {\n          commit {\n            statusCheckRollup {\n              contexts(first: 100, after: $after) {\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n                nodes {\n                  __typename\n                  ... on CheckRun {\n                    name\n                    status\n                    conclusion\n                    detailsUrl\n                  }\n                  ... on StatusContext {\n                    context\n                    state\n                    targetUrl\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";

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
const ROLLUP_STATES = [
  "ERROR",
  "EXPECTED",
  "FAILURE",
  "PENDING",
  "SUCCESS",
] as const;
const REVIEW_DECISIONS = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REVIEW_REQUIRED",
] as const;
// `gh pr view` reports no review decision as "", not null. Only this field does
// It, so the normalization stays here rather than in nullableEnum, where it
// Would stop a genuinely unexpected rollup state from failing closed.
const reviewDecision = (value: unknown): Types.ReviewDecision =>
  nullableEnum(
    value === "" ? WIRE_NULL : value,
    REVIEW_DECISIONS,
    "pull request.reviewDecision"
  );
const SCP_GITHUB_PREFIX = "git@github.com:";
const SSH_GITHUB_PREFIX = "ssh://git@github.com/";
const HTTPS_GITHUB_PREFIX = "https://github.com/";
const REPOSITORY_PATH_PARTS = 2;
const PULL_PATH_PARTS = 4;
const PULL_PATH_SEGMENT = 2;
const PULL_NUMBER_SEGMENT = 3;

const normalizeRemote = (value: string): string => {
  const trimmed = value.trim();
  const prefix = [SCP_GITHUB_PREFIX, SSH_GITHUB_PREFIX].find((candidate) => trimmed.startsWith(candidate));
  return matchesUndefined(prefix) ? trimmed : `${HTTPS_GITHUB_PREFIX}${trimmed.slice(prefix.length)}`;
};
const isCanonicalGitHub = (url: URL): boolean =>
  url.protocol === "https:" && url.hostname === "github.com" &&
  !url.port && !url.username && !url.password && !url.search && !url.hash;

const parseRemote = function (value: string): Types.Repository | null {
  try {
    const url = new URL(normalizeRemote(value));
    const parts = url.pathname
      .replace(/\.git$/u, "")
      .split("/")
      .filter(Boolean);
    if (!isCanonicalGitHub(url) || parts.length !== REPOSITORY_PATH_PARTS)
      {return null;}
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
};
const parsePrUrl = function (value: string): Types.PrContext {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (!isCanonicalGitHub(url) || parts.length !== PULL_PATH_PARTS || parts[PULL_PATH_SEGMENT] !== "pull")
      {throw new Error("not a canonical GitHub pull URL");}
    return {
      owner: parts[0],
      repo: parts[1],
      number: parsePrNumber(Number(parts[PULL_NUMBER_SEGMENT])),
    };
  } catch (error) {
    throw new WatcherQueryError({
      kind: "invalid-context-url",
      retryable: false,
      rawValue: value,
      detail: `could not infer owner/repo from PR URL: ${value} (${errorMessage(error)})`,
    });
  }
};
export const parsePullRequest = function parsePullRequest(
  value: unknown,
  context: Types.PrContext
): Types.PullRequestFacts {
  const object = record(value, "pull request");
  const isDraft = boolean(object.isDraft, "pull request.isDraft");
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
  public async originRepo(): Promise<Types.Repository | null> {
    const result = await run(["git", "remote", "get-url", "origin"]);
    return result.code === 0 ? parseRemote(result.stdout) : null;
  }
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
    if ([0, 1, 8].includes(result.code) && result.stdout.trim()) {
      try {
        const value = parseJson(result.stdout, "gh pr checks");
        if (Array.isArray(value))
          {return { kind: "checks", checks: value.map(parseFastCheck) };}
      } catch (error) {
        if (!(error instanceof WatcherQueryError)) {throw error;}
      }
    }
    return { kind: "unusable", exitCode: result.code, stderr: result.stderr };
  }
  public async checkRollupPage(
    context: Types.PrContext,
    after: string | null
  ): Promise<Types.RollupPage> {
    const argv = graphqlArgs(PR_CHECK_ROLLUP_QUERY, context);
    if (!matchesNull(after)) {argv.push("-f", `after=${after}`);}
    const value = await runJson(argv);
    const commits = list(
      at(value, ["data", "repository", "pullRequest", "commits", "nodes"]),
      "commits.nodes"
    );
    if (commits.length === 0) {return { checks: [], endCursor: null };}
    const commit = record(
      at(commits.at(-1), ["commit"]),
      "commit"
    );
    if (matchesNull(commit.statusCheckRollup))
      {return { checks: [], endCursor: null };}
    const contexts = record(
      at(commit, ["statusCheckRollup", "contexts"]),
      "contexts"
    );
    const checks = list(contexts.nodes, "contexts.nodes")
      .map(mapRollupNode)
      .filter((check): check is Types.Check => !matchesNull(check));
    const page = record(contexts.pageInfo, "contexts.pageInfo");
    const hasNextPage = boolean(page.hasNextPage, "contexts.pageInfo.hasNextPage");
    const cursor = optionalString(
      page.endCursor,
      "contexts.pageInfo.endCursor"
    );
    return { checks, endCursor: hasNextPage && cursor ? cursor : null };
  }
  public async reviewThreadPage(
    context: Types.PrContext,
    after: string | null
  ): Promise<Types.ReviewThreadPage> {
    const argv = graphqlArgs(REVIEW_THREADS_QUERY, context);
    if (!matchesNull(after)) {argv.push("-f", `after=${after}`);}
    return parseReviewThreadPage(await runJson(argv));
  }
  public async commitRollups(
    context: Types.PrContext
  ): Promise<Readonly<Types.CommitRollup[]>> {
    const value = await runJson(graphqlArgs(PR_COMMIT_STATUS_QUERY, context));
    const commits = list(
      at(value, ["data", "repository", "pullRequest", "commits", "nodes"]),
      "commits.nodes"
    );
    return commits.map((item, index) => {
      const commit = record(at(item, ["commit"]), `commits[${index}].commit`);
      const rollup = commit.statusCheckRollup;
      return {
        oid: string(commit.oid, `commits[${index}].oid`),
        state:
          matchesNull(rollup)
            ? null
            : nullableEnum(
                at(rollup, ["state"]),
                ROLLUP_STATES,
                `commits[${index}].statusCheckRollup.state`
              ),
      };
    });
  }
}

export const resolveContext = async function resolveContext(args: Readonly<{
  reader: Types.GitHubReader;
  owner: string | null;
  repo: string | null;
  pr: Types.PrNumber | null;
}>): Promise<Types.PrContext> {
  if (!matchesNull(args.pr) && !matchesNull(args.owner) && !matchesNull(args.repo))
    {return { owner: args.owner, repo: args.repo, number: args.pr };}
  if (!matchesNull(args.pr)) {
    const origin = await args.reader.originRepo();
    if (!matchesNull(origin))
      {return {
        owner: args.owner ?? origin.owner,
        repo: args.repo ?? origin.repo,
        number: args.pr,
      };}
  }
  const inferred = await args.reader.currentPr(args.pr);
  return {
    owner: args.owner ?? inferred.owner,
    repo: args.repo ?? inferred.repo,
    number: args.pr ?? inferred.number,
  };
};
export const orderStack = function orderStack(
  context: Types.PrContext,
  open: Readonly<Types.OpenPullRequest[]>
): Types.NonEmpty<Types.PrContext> {
  const byNumber = new Map(open.map((pr) => [pr.number, pr]));
  // A base ref belongs to this repository. A fork head with the same name
  // Cannot be its parent, even when that name is the default branch.
  const byHead = new Map(
    open.filter((pr) => !pr.isCrossRepository).map((pr) => [pr.headRefName, pr])
  );
  const children = new Map<string, Types.OpenPullRequest[]>();
  visitItems(open, (pr) => {
    if (pr.isCrossRepository) {return;}
    children.set(pr.baseRefName, [...(children.get(pr.baseRefName) ?? []), pr]);
  });
  visitItems(children.values(), (values) => {values.sort((left, right) => left.number - right.number);});
  const start = byNumber.get(context.number);
  if (matchesUndefined(start)) {return [context];}
  const down: Types.OpenPullRequest[] = [];
  let current = start;
  while (byHead.has(current.baseRefName)) {
    const parent = byHead.get(current.baseRefName);
    if (matchesUndefined(parent)) {break;}
    down.push(parent);
    current = parent;
  }
  const seen = new Set<Types.PrNumber>([
    ...down.map((pr) => pr.number),
    start.number,
  ]);
  const up: Types.OpenPullRequest[] = [];
  const visit = (parent: Types.OpenPullRequest): void => {
    if (parent.isCrossRepository) {return;}
    visitItems(children.get(parent.headRefName) ?? [], (child) => {
      if (child.isCrossRepository) {return;}
      if (seen.has(child.number)) {return;}
      seen.add(child.number);
      up.push(child);
      visit(child);
    });
  };
  visit(start);
  return (
    nonEmpty(
      [...down.reverse(), start, ...up].map((pr) => ({
        ...context,
        number: pr.number,
      }))
    ) ?? [context]
  );
};
export const discoverStack = async function discoverStack(
  reader: Types.GitHubReader,
  context: Types.PrContext
): Promise<Types.NonEmpty<Types.PrContext>> {
  return orderStack(context, await reader.openPullRequests(context));
};
