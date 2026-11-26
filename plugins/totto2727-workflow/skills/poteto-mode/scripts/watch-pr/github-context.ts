import { errorMessage, WatcherQueryError } from "./github-error.ts";
import { WIRE_NULL } from "./github-json.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";
import type * as Types from "./types.ts";
import { parsePrNumber } from "./types.ts";

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

export const parseRemote = function (value: string): Types.Repository | null {
  try {
    const url = new URL(normalizeRemote(value));
    const parts = url.pathname
      .replace(/\.git$/u, "")
      .split("/")
      .filter(Boolean);
    if (!isCanonicalGitHub(url) || parts.length !== REPOSITORY_PATH_PARTS)
      {return WIRE_NULL;}
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return WIRE_NULL;
  }
};
const invalidContext = function (value: string, reason: string): WatcherQueryError {
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of existing context errors.
  return new WatcherQueryError({
    kind: "invalid-context-url",
    retryable: false,
    rawValue: value,
    detail: `could not infer owner/repo from PR URL: ${value} (${reason})`,
  });
};

const prContext = (url: URL): Types.PrContext | null => {
  const parts = url.pathname.split("/").filter(Boolean);
  if (!isCanonicalGitHub(url) || parts.length !== PULL_PATH_PARTS || parts[PULL_PATH_SEGMENT] !== "pull") {
    return WIRE_NULL;
  }
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of PR context fields.
  return { owner: parts[0], repo: parts[1], number: parsePrNumber(Number(parts[PULL_NUMBER_SEGMENT])) };
};

export const parsePrUrl = function (value: string): Types.PrContext {
  const parse = (): Types.PrContext | null => {
    try {return prContext(new URL(value));}
    catch (error) {throw invalidContext(value, errorMessage(error));}
  };
  const context = parse();
  if (matchesNull(context)) {throw invalidContext(value, "not a canonical GitHub pull URL");}
  return context;
};

export const resolveContext = async function resolveContext(args: Readonly<{
  reader: Types.GitHubReader;
  owner: string | null;
  repo: string | null;
  pr: Types.PrNumber | null;
}>): Promise<Types.PrContext> {
  if (!matchesNull(args.pr) && !matchesNull(args.owner) && !matchesNull(args.repo)) {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized PR context field order.
    return { owner: args.owner, repo: args.repo, number: args.pr };
  }
  if (!matchesNull(args.pr)) {
    const origin = await args.reader.originRepo();
    if (!matchesNull(origin)) {
      // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized PR context field order.
      return { owner: args.owner ?? origin.owner, repo: args.repo ?? origin.repo, number: args.pr };
    }
  }
  const inferred = await args.reader.currentPr(args.pr);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized PR context field order.
  return {
    owner: args.owner ?? inferred.owner,
    repo: args.repo ?? inferred.repo,
    number: args.pr ?? inferred.number,
  };
};
