import { describe, expect, it } from "bun:test";
import { main, parseArgs } from "./cli.ts";
import type { CliRuntime } from "./cli.ts";
import { fakeReader, passingCheck } from "./fakes.test-helper.ts";
import { renderJson, renderPretty } from "./render.ts";
import type { GitHubReader, WatcherVerdict } from "./types.ts";
import { parsePrNumber } from "./types.ts";

const SUCCESS = 0;
const ONE_RESULT = 1;
const USAGE_ERROR = 64;
const HIDDEN_CI_REFUSAL = 4;
const FIRST_PULL = 1;
const BASE_PULL = 10;
const MIDDLE_PULL = 11;
const TIP_PULL = 12;
const QUEUED_NUMBERS = [BASE_PULL, MIDDLE_PULL, TIP_PULL];
const OBSERVED_AT = "2026-07-26T00:00:00.000Z";
// oxlint-disable-next-line unicorn/no-null -- A missing CLI owner, repository, or PR is represented as null.
const UNSPECIFIED = null;

const testRuntime = function (reader: GitHubReader): Readonly<{
  runtime: CliRuntime;
  stdout: string[];
  stderr: string[];
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    runtime: {
      clock: {
        now: () => SUCCESS,
        observedAt: () => OBSERVED_AT,
        async sleep() {
          // oxlint-disable-next-line rules/require-tagged-error -- This harness failure describes an unexpected wait in a one-shot CLI test.
          await Promise.reject(new Error("test unexpectedly slept"));
        },
      },
      reader,
      stderr: (value) => {stderr.push(value);},
      stdout: (value) => {stdout.push(value);},
    },
    stderr,
    stdout,
  };
};

const DEFAULT_ARGUMENTS = {
  mode: "single",
  owner: UNSPECIFIED,
  polling: {
    allowDraft: false,
    interval: 60,
    maxQueryErrors: 5,
    sweepInterval: 300,
    timeout: 0,
  },
  pr: UNSPECIFIED,
  pretty: false,
  repo: UNSPECIFIED,
  stackPrs: [],
  statusOnly: false,
};

const FROZEN_STACK_ARGS = [
  "--queued-stack", "--stack-prs", "#10, 11,#12",
  "--interval", "2.5", "--sweep-interval", "30", "--timeout", "0",
  "--max-query-errors", "3", "--allow-draft", "--pretty",
];

const INVALID_ARGUMENTS = [
  ["--unknown"],
  ["--interval", "0"],
  ["--sweep-interval", "-1"],
  ["--timeout", "-1"],
  ["--max-query-errors", "1.5"],
  ["--stack", "--queued-stack"],
  ["--stack-prs", "1,2"],
  ["--queued-stack", "--stack-prs", "1,1"],
];

describe("parseArgs", () => {
  it("uses the specified defaults", () => {
    expect(parseArgs([])).toMatchObject(DEFAULT_ARGUMENTS);
  });

  it("parses a frozen queued stack bottom-to-top", () => {
    const parsed = parseArgs(FROZEN_STACK_ARGS);
    expect(parsed.mode).toBe("queued-stack");
    expect(parsed.stackPrs.map(Number)).toEqual(QUEUED_NUMBERS);
    expect(parsed.polling).toEqual({
      allowDraft: true,
      interval: 2.5,
      maxQueryErrors: 3,
      sweepInterval: 30,
      timeout: 0,
    });
    expect(parsed.pretty).toBe(true);
  });

  it("rejects every invalid mode and numeric shape as usage", async () => {
    // oxlint-disable-next-line rules/no-for-loops -- Run each full CLI invocation to completion before starting the next fixture.
    for (const argv of INVALID_ARGUMENTS) {
      const harness = testRuntime(fakeReader());
      // oxlint-disable-next-line eslint/no-await-in-loop -- A measured CLI invocation must finish before the next fixture starts.
      expect(await main(argv, harness.runtime)).toBe(USAGE_ERROR);
      expect(harness.stdout).toEqual([]);
      expect(harness.stderr.join("")).toContain("error:");
    }
  });
});

const pull = {
  number: parsePrNumber(FIRST_PULL),
  owner: "owner",
  repo: "repo",
};

const status = {
  exitCode: 0,
  kind: "STATUS",
  mode: "single",
  observedAt: OBSERVED_AT,
  reason: "status-only",
  rows: [{
    context: pull,
    facts: {
      baseRefName: "main",
      context: pull,
      headRefName: "feature",
      headRefOid: "head",
      isDraft: false,
      mergeStateStatus: "CLEAN",
      mergeable: "MERGEABLE",
      mergedAt: "now",
      reviewDecision: "APPROVED",
      state: "MERGED",
    },
    kind: "merged",
  }],
  schemaVersion: 1,
  sequence: 1,
  terminal: true,
} satisfies WatcherVerdict;

const reviewBlocker = {
  blocker: {
    kind: "review-threads",
    pr: pull,
    threads: [{
      bugbotReviewPasses: 0,
      firstComment: {
        authorLogin: "evil\u001B[2K\ruser",
        body: "\u001B[31mDangerous\u001B[0m\r\nSecond line",
        createdAt: OBSERVED_AT,
        line: 12,
        path: "src/\u001B[31minvalid\u001B[0m\u0000path.ts",
      },
      id: "thread_1",
      isBugbot: false,
    }],
  },
  exitCode: 3,
  kind: "BLOCKER",
  mode: "single",
  observedAt: OBSERVED_AT,
  schemaVersion: 1,
  sequence: 1,
  terminal: true,
} satisfies WatcherVerdict;

describe("rendering", () => {
  it("emits compact valid JSON by default", () => {
    const rendered = renderJson(status);
    expect(rendered.endsWith("\n")).toBe(true);
    expect(JSON.parse(rendered)).toEqual(status);
  });

  it("renders the Markdown table from the same verdict only", () => {
    const rendered = renderPretty(status);
    expect(rendered).toContain("| PR | CI | Review | Merge |");
    expect(rendered).toContain(
      "| [#1](https://github.com/owner/repo/pull/1) | \u2014 | \u2014 | ✅ merged |"
    );
  });

  it("sanitizes review thread paths, authors, and comment bodies in blocker output", () => {
    const rendered = renderPretty(reviewBlocker);
    expect(rendered).toContain("BLOCKER: review-threads");
    expect(rendered).toContain(
      "thread_1 src/invalidpath.ts 12 eviluser isBugBot=false bugbotReviewPasses=0 Dangerous"
    );
    expect(rendered).not.toContain("\u001B");
    expect(rendered).not.toContain("\r");
    expect(rendered).not.toContain("Second line");
  });
});

const REPOSITORY_FLAGS = ["--owner", "owner", "--repo", "repo"];
const QUEUED_STATUS_FLAGS = [...REPOSITORY_FLAGS, "--queued-stack", "--stack-prs", "1", "--status-only"];
const CI_REFUSAL_FLAGS = [...REPOSITORY_FLAGS, "--pr", "1"];
const ciRefusal = {
  blocker: {
    ci: { kind: "ci-github-rejected" },
    kind: "failing-checks",
  },
  exitCode: HIDDEN_CI_REFUSAL,
  kind: "BLOCKER",
};

describe("main", () => {
  it("returns EX_USAGE 64 and writes usage errors only to stderr", async () => {
    const harness = testRuntime(fakeReader());
    expect(await main(["--interval", "0"], harness.runtime)).toBe(USAGE_ERROR);
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr.join("")).toContain(
      "--interval: 0 must be greater than zero"
    );
  });

  it("bypasses the queue machine for queued-stack status-only", async () => {
    const reader = fakeReader();
    const harness = testRuntime(reader);
    const code = await main(QUEUED_STATUS_FLAGS, harness.runtime);
    expect(code).toBe(SUCCESS);
    expect(harness.stdout).toHaveLength(ONE_RESULT);
    const verdict: unknown = JSON.parse(harness.stdout[0]);
    expect(verdict).toMatchObject({
      exitCode: 0,
      kind: "STATUS",
      mode: "queued-stack",
      terminal: true,
    });
    expect(harness.stdout[0]).not.toContain('"kind":"QUEUE"');
  });

  it("returns exit 4 for a hidden GitHub-side CI refusal", async () => {
    const reader = fakeReader({
      commitRollups: [{ oid: "head", state: "FAILURE" }],
      facts: { mergeStateStatus: "BLOCKED" },
      fastPath: { checks: [passingCheck()], kind: "checks" },
    });
    const harness = testRuntime(reader);
    const code = await main(CI_REFUSAL_FLAGS, harness.runtime);
    expect(code).toBe(HIDDEN_CI_REFUSAL);
    expect(harness.stdout).toHaveLength(ONE_RESULT);
    expect(JSON.parse(harness.stdout[0])).toMatchObject(ciRefusal);
  });

  it("shows help without touching the reader", async () => {
    const reader = fakeReader();
    const harness = testRuntime(reader);
    expect(await main(["--help"], harness.runtime)).toBe(SUCCESS);
    expect(harness.stdout.join("")).toContain("JSON (NDJSON while polling)");
    expect(reader.calls).toEqual([]);
  });
});
