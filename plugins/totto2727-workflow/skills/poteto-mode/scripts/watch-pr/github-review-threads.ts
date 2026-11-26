import { at, boolean, list, missing, optionalString, record, string, WIRE_NULL } from "./github-json.ts";
import { visitItems } from "./native-iteration.ts";
import { isEmptyArray, isNumber, matchesNull } from "./native-predicates.ts";
import type * as Types from "./types.ts";

const lineNumber = (comment: Record<string, unknown>): number | null => {
  if (matchesNull(comment.line)) {return WIRE_NULL;}
  return isNumber(comment.line) && Number.isInteger(comment.line)
    ? comment.line
    : missing("review comment.line", comment.line);
};

const parseComment = function (value: unknown): Types.ReviewComment {
  const object = record(value, "review comment");
  const author =
    matchesNull(object.author)
      ? WIRE_NULL
      : record(object.author, "review comment.author");
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of review-comment fields.
  return {
    authorLogin:
      matchesNull(author)
        ? WIRE_NULL
        : optionalString(author.login, "review comment.author.login"),
    body: string(object.body, "review comment.body"),
    path: optionalString(object.path, "review comment.path"),
    line: lineNumber(object),
    createdAt: string(object.createdAt, "review comment.createdAt"),
  };
};
const isBugbot = function (comment: Types.ReviewComment | null): boolean {
  if (matchesNull(comment)) {return false;}
  const author = (comment.authorLogin ?? "").toLowerCase();
  const body = comment.body.toLowerCase();
  return (
    author.includes("bugbot") ||
    (author === "cursor" &&
      [
        "bugbot",
        "cursor_automation_id",
        "agentic security review",
        "description start",
        "severity",
      ].some((token) => body.includes(token)))
  );
};
const passKey = (comment: Types.ReviewComment | null): string | null => {
  if (matchesNull(comment)) {return WIRE_NULL;}
  return /RUN_ID:\s*(?<id>[a-zA-Z0-9_.:-]+)/u.exec(comment.body)?.groups?.id
    ?? /CURSOR_AUTOMATION_ID:\s*(?<id>[a-zA-Z0-9_.:-]+)/u.exec(comment.body)?.groups?.id
    ?? WIRE_NULL;
};

const FIRST_COMMENT = 0;
const NO_PASSES = 0;

export const parseReviewThreadPage = function parseReviewThreadPage(value: unknown): Types.ReviewThreadPage {
  const reviewThreads = record(
    at(value, ["data", "repository", "pullRequest", "reviewThreads"]),
    "reviewThreads"
  );
  const nodes = list(reviewThreads.nodes, "reviewThreads.nodes");
  const threads: Types.RawReviewThread[] = [];
  visitItems(nodes, (node) => {
    const thread = record(node, "review thread");
    const resolved = boolean(thread.isResolved, "review thread.isResolved");
    const comments = list(
      at(thread, ["comments", "nodes"]),
      "review thread.comments.nodes"
    );
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of raw review-thread fields.
    threads.push({
      id: string(thread.id, "review thread.id"),
      firstComment: isEmptyArray(comments) ? WIRE_NULL : parseComment(comments[FIRST_COMMENT]),
      resolved,
    });
  });
  const page = record(reviewThreads.pageInfo, "reviewThreads.pageInfo");
  const hasNextPage = boolean(page.hasNextPage, "reviewThreads.pageInfo.hasNextPage");
  const cursor = optionalString(
    page.endCursor,
    "reviewThreads.pageInfo.endCursor"
  );
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of review pagination fields.
  return { threads, endCursor: hasNextPage && Boolean(cursor) ? cursor : WIRE_NULL };
};
export const buildReviewThreads = function buildReviewThreads(
  threads: Readonly<Types.RawReviewThread[]>
): Readonly<Types.ReviewThread[]> {
  const keys = new Set<string>();
  const passesSeen = { keyless: false };
  visitItems(threads, (thread) => {
    if (!isBugbot(thread.firstComment)) {return;}
    const key = passKey(thread.firstComment);
    if (matchesNull(key)) {passesSeen.keyless = true;}
    else {keys.add(key);}
  });
  const passes = keys.size === NO_PASSES ? Number(passesSeen.keyless) : keys.size;
  return threads
    .filter((thread) => !thread.resolved)
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized order of open review-thread fields.
    .map(({ id, firstComment }) => ({
      id,
      firstComment,
      isBugbot: isBugbot(firstComment),
      bugbotReviewPasses: passes,
    }));
};
export const resolveReviewThreads = async function resolveReviewThreads(
  reader: Types.GitHubReader,
  context: Types.PrContext
): Promise<Readonly<Types.ReviewThread[]>> {
  const threads: Types.RawReviewThread[] = [];
  const cursor: { after: string | null } = { after: WIRE_NULL };
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- GitHub supplies each next cursor in the immediately preceding page.
    const page = await reader.reviewThreadPage(context, cursor.after);
    threads.push(...page.threads);
    cursor.after = page.endCursor;
  } while (!matchesNull(cursor.after));
  return buildReviewThreads(threads);
};
