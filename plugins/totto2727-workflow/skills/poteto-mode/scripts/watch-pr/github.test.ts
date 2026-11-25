import { spawn } from "bun";
import { describe, expect, it } from "bun:test";
// oxlint-disable-next-line rules/no-node-imports -- The standalone watcher tests write a real gh executable in a temporary directory.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone watcher tests use the host's private temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Fixture paths follow the standalone watcher's host platform.
import path from "node:path";
import { fakeReader } from "./fakes.test-helper.ts";
import { orderStack, resolveContext } from "./github.ts";
import { WIRE_NULL } from "./github-json.ts";
import { watchContext as context, WATCH_PULL_NUMBER } from "./github-test-fixtures.ts";
import { parsePrNumber } from "./types.ts";

const LOWER_PULL = 41;
const UPPER_PULL = 43;
const ONE_PULL = 1;
const EXIT_OK = 0;
const PROCESS_TIMEOUT_MS = 2000;
const EXECUTABLE_FIXTURE = 0o755;
const watcherModule = JSON.stringify(path.join(import.meta.dir, "github.ts"));

const ghScript = `#!/bin/sh
case "$*" in
  *number,headRefName,baseRefName,isCrossRepository*) ;;
  *) exit 2 ;;
esac
printf '%s\\n' '[{"number":42,"headRefName":"feature","baseRefName":"main","isCrossRepository":true}]'
`;

const readProgram = async (program: string, env?: NodeJS.ProcessEnv): Promise<unknown> => {
  const child = spawn([process.execPath, "-e", program], { env, stdout: "pipe" });
  const timeout = setTimeout(() => {child.kill();}, PROCESS_TIMEOUT_MS);
  try {
    const [status, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    expect(status).toBe(EXIT_OK);
    const result: unknown = JSON.parse(stdout);
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

const checkStackOrder = (): void => {
  const ordered = orderStack(context, [
    {
      baseRefName: "main",
      headRefName: "base-feature",
      isCrossRepository: false,
      number: parsePrNumber(LOWER_PULL),
    },
    {
      baseRefName: "base-feature",
      headRefName: "feature",
      isCrossRepository: false,
      number: context.number,
    },
    {
      baseRefName: "feature",
      headRefName: "upstack",
      isCrossRepository: false,
      number: parsePrNumber(UPPER_PULL),
    },
  ]);
  expect(ordered.map((item) => Number(item.number))).toEqual([LOWER_PULL, WATCH_PULL_NUMBER, UPPER_PULL]);
};

const checkUnrelatedFork = async (): Promise<void> => {
  // Bound the subprocess so this regression reports a failure instead of hanging the suite.
  const program = `import { orderStack } from ${watcherModule};
    console.log(JSON.stringify(orderStack(${JSON.stringify(context)}, [
      { number: 41, headRefName: "main", baseRefName: "main", isCrossRepository: true },
      { number: 42, headRefName: "feature", baseRefName: "main", isCrossRepository: false }
    ])));`;
  const rows = await readProgram(program);
  expect(rows).toHaveLength(ONE_PULL);
  expect(rows).toMatchObject([{ number: WATCH_PULL_NUMBER }]);
};

const checkGhForkIdentity = async (): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "watch-pr-fork-"));
  try {
    await writeFile(path.join(directory, "gh"), ghScript, { mode: EXECUTABLE_FIXTURE });
    const program = `import { GhGitHubReader } from ${watcherModule};
      console.log(JSON.stringify(await new GhGitHubReader().openPullRequests({ owner: "owner", repo: "repo" })));`;
    // oxlint-disable-next-line node/no-process-env -- The isolated child needs its fixture gh first and inherits the host environment.
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
    expect(await readProgram(program, env)).toEqual([
      { baseRefName: "main", headRefName: "feature", isCrossRepository: true, number: WATCH_PULL_NUMBER },
    ]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

const checkSameNamedFork = (): void => {
  const ordered = orderStack(context, [
    { baseRefName: "main", headRefName: "base-feature", isCrossRepository: true, number: parsePrNumber(LOWER_PULL) },
    { baseRefName: "base-feature", headRefName: "feature", isCrossRepository: false, number: context.number },
  ]);
  expect(ordered.map((item) => Number(item.number))).toEqual([WATCH_PULL_NUMBER]);
};

describe("context and stack discovery", () => {
  it("returns a fully explicit context without any reader call", async () => {
    const reader = fakeReader();
    expect(
      await resolveContext({
        owner: "explicit",
        pr: context.number,
        reader,
        repo: "repo",
      })
    ).toEqual({ number: context.number, owner: "explicit", repo: "repo" });
    expect(reader.calls).toEqual([]);
  });

  it("uses the local origin before currentPr for an explicit number", async () => {
    const reader = fakeReader({ origin: { owner: "local", repo: "checkout" } });
    expect(
      await resolveContext({
        owner: WIRE_NULL,
        pr: context.number,
        reader,
        repo: WIRE_NULL,
      })
    ).toEqual({ number: context.number, owner: "local", repo: "checkout" });
    expect(reader.calls).toEqual(["originRepo"]);
  });

  it("orders the connected stack bottom-to-top", checkStackOrder);
  it("does not use a fork's same-named head as a stack parent", checkSameNamedFork);

  it("does not attach upstream branch children to a fork head", () => {
    const ordered = orderStack(context, [
      { baseRefName: "main", headRefName: "feature", isCrossRepository: true, number: context.number },
      { baseRefName: "feature", headRefName: "upstack", isCrossRepository: false, number: parsePrNumber(UPPER_PULL) },
    ]);
    expect(ordered.map((item) => Number(item.number))).toEqual([WATCH_PULL_NUMBER]);
  });

  it("does not attach a fork PR as a child of a stack branch", () => {
    const ordered = orderStack(context, [
      { baseRefName: "main", headRefName: "feature", isCrossRepository: false, number: context.number },
      { baseRefName: "feature", headRefName: "patch", isCrossRepository: true, number: parsePrNumber(UPPER_PULL) },
    ]);
    expect(ordered.map((item) => Number(item.number))).toEqual([WATCH_PULL_NUMBER]);
  });

  it("terminates when an unrelated fork opens main against main", checkUnrelatedFork);

  it("requests and parses fork identity from gh before stack discovery", checkGhForkIdentity);
});
