import { mapRollupNode } from "./github-check-decode.ts";
import { at, boolean, list, nullableEnum, optionalString, record, string, WIRE_NULL } from "./github-json.ts";
import { isEmptyArray, matchesNull } from "./native-predicates.ts";
import type * as Types from "./types.ts";

const ROLLUP_STATES = [
  "ERROR",
  "EXPECTED",
  "FAILURE",
  "PENDING",
  "SUCCESS",
] as const;
const LAST_COMMIT = -1;

const commitNodes = (value: unknown): Readonly<unknown[]> =>
  list(at(value, ["data", "repository", "pullRequest", "commits", "nodes"]), "commits.nodes");

const contextCursor = (value: unknown): string | null => {
  const page = record(value, "contexts.pageInfo");
  const hasNextPage = boolean(page.hasNextPage, "contexts.pageInfo.hasNextPage");
  const cursor = optionalString(page.endCursor, "contexts.pageInfo.endCursor");
  return hasNextPage && Boolean(cursor) ? cursor : WIRE_NULL;
};

export const parseCheckRollupPage = (value: unknown): Types.RollupPage => {
  const commits = commitNodes(value);
  if (isEmptyArray(commits)) {return { checks: [], endCursor: WIRE_NULL };}
  const commit = record(at(commits.at(LAST_COMMIT), ["commit"]), "commit");
  if (matchesNull(commit.statusCheckRollup)) {return { checks: [], endCursor: WIRE_NULL };}
  const contexts = record(at(commit, ["statusCheckRollup", "contexts"]), "contexts");
  const checks = list(contexts.nodes, "contexts.nodes")
    .map((node) => mapRollupNode(node))
    .filter((check) => !matchesNull(check));
  return { checks, endCursor: contextCursor(contexts.pageInfo) };
};

export const parseCommitRollups = (value: unknown): Readonly<Types.CommitRollup[]> =>
  commitNodes(value).map((item, index) => {
    const commit = record(at(item, ["commit"]), `commits[${index}].commit`);
    const rollup = commit.statusCheckRollup;
    return {
      oid: string(commit.oid, `commits[${index}].oid`),
      state: matchesNull(rollup)
        ? WIRE_NULL
        : nullableEnum(at(rollup, ["state"]), ROLLUP_STATES, `commits[${index}].statusCheckRollup.state`),
    };
  });
