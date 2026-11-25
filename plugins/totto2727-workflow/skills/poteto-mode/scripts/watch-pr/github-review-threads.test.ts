import { describe, expect, it } from "bun:test";
import { fakeReader } from "./fakes.test-helper.ts";
import { buildReviewThreads, parseReviewThreadPage, resolveReviewThreads, WatcherQueryError } from "./github.ts";
import { WIRE_NULL } from "./github-json.ts";
import { watchContext as context } from "./github-test-fixtures.ts";
import type { RawReviewThread } from "./types.ts";

const UNRESOLVED_THREADS = 2;
const PAGE_REVIEW_PASSES = 3;
const CROSS_PAGE_REVIEW_PASSES = 2;
const SINGLE_PAGE_THREAD = 1;

const bugbot = (id: string, runId: string): RawReviewThread => ({
  firstComment: {
    authorLogin: "bugbot",
    body: `RUN_ID: ${runId}`,
    createdAt: "now",
    line: 1,
    path: "a.ts",
  },
  id,
  resolved: false,
});

const reviewThread = (id: string, resolved = false): RawReviewThread => ({
  firstComment: {
    authorLogin: "someone",
    body: "please fix",
    createdAt: "now",
    line: 1,
    path: "a.ts",
  },
  id,
  resolved,
});

const bugbotResponse = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: [
            {
              comments: {
                nodes: [
                  {
                    author: { login: "bugbot" },
                    body: "RUN_ID: run-1",
                    createdAt: "now",
                    line: 1,
                    path: "a.ts",
                  },
                ],
              },
              id: "one",
              isResolved: false,
            },
            {
              comments: {
                nodes: [
                  {
                    author: { login: "cursor" },
                    body: "CURSOR_AUTOMATION_ID: run-2 severity high",
                    createdAt: "now",
                    line: WIRE_NULL,
                    path: WIRE_NULL,
                  },
                ],
              },
              id: "two",
              isResolved: false,
            },
            {
              comments: {
                nodes: [
                  {
                    author: { login: "bugbot" },
                    body: "RUN_ID: run-3",
                    createdAt: "now",
                    line: WIRE_NULL,
                    path: WIRE_NULL,
                  },
                ],
              },
              id: "resolved",
              isResolved: true,
            },
          ],
          pageInfo: { endCursor: WIRE_NULL, hasNextPage: false },
        },
      },
    },
  },
};

it("annotates Bugbot threads with distinct review-pass counts", () => {
  const threads = buildReviewThreads(parseReviewThreadPage(bugbotResponse).threads);
  expect(threads).toHaveLength(UNRESOLVED_THREADS);
  expect(threads.map((thread) => thread.isBugbot)).toEqual([true, true]);
  expect(threads.map((thread) => thread.bugbotReviewPasses)).toEqual([PAGE_REVIEW_PASSES, PAGE_REVIEW_PASSES]);
});

const checkReviewPages = async (): Promise<void> => {
  const reader = fakeReader({
    threadPages: [
      { endCursor: "next", threads: [reviewThread("one")] },
      { endCursor: "last", threads: [reviewThread("two")] },
      { endCursor: WIRE_NULL, threads: [reviewThread("three")] },
    ],
  });
  const threads = await resolveReviewThreads(reader, context);
  expect(threads.map((item) => item.id)).toEqual(["one", "two", "three"]);
  expect(reader.calls).toEqual([
    "reviewThreadPage:null",
    "reviewThreadPage:next",
    "reviewThreadPage:last",
  ]);
};

const checkCrossPageBugbotPasses = async (): Promise<void> => {
  const reader = fakeReader({
    threadPages: [
      { endCursor: "next", threads: [bugbot("one", "run-1")] },
      { endCursor: WIRE_NULL, threads: [bugbot("two", "run-2")] },
    ],
  });
  const threads = await resolveReviewThreads(reader, context);
  expect(threads.map((item) => item.bugbotReviewPasses)).toEqual([CROSS_PAGE_REVIEW_PASSES, CROSS_PAGE_REVIEW_PASSES]);
};

describe("review thread pagination", () => {

  it("keeps walking pages until the cursor is exhausted", checkReviewPages);

  it("sees an unresolved thread that sits past the first page", async () => {
    const reader = fakeReader({
      threadPages: [
        { endCursor: "next", threads: [reviewThread("early", true)] },
        { endCursor: WIRE_NULL, threads: [reviewThread("late")] },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    expect(threads.map((item) => item.id)).toEqual(["late"]);
  });

  it("stops after a single page when the cursor is exhausted", async () => {
    const reader = fakeReader({
      threadPages: [{ endCursor: WIRE_NULL, threads: [reviewThread("only")] }],
    });
    const threads = await resolveReviewThreads(reader, context);
    expect(threads).toHaveLength(SINGLE_PAGE_THREAD);
    expect(reader.calls).toEqual(["reviewThreadPage:null"]);
  });

  it("counts Bugbot review passes across every page", checkCrossPageBugbotPasses);

  it("drops resolved threads from later pages too", async () => {
    const reader = fakeReader({
      threadPages: [
        { endCursor: "next", threads: [reviewThread("one")] },
        { endCursor: WIRE_NULL, threads: [reviewThread("two", true)] },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    expect(threads.map((item) => item.id)).toEqual(["one"]);
  });

  it("rejects a page that omits pageInfo instead of assuming one page", () => {
    const response = {
      data: {
        repository: {
          pullRequest: { reviewThreads: { nodes: [] } },
        },
      },
    };
    expect(() => parseReviewThreadPage(response)).toThrow(WatcherQueryError);
  });
});
