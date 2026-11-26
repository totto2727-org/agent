import { parsePrNumber } from "./types.ts";
import type {
  CiClean,
  GitHubMergeAllowed,
  PrContext,
  ReadyPr,
  TerminalVerdict,
} from "./types.ts";

type ReadyVerdict = Extract<TerminalVerdict, Readonly<{ kind: "READY" }>>;

const EXAMPLE_PULL = 123;

const context = {
  number: parsePrNumber(EXAMPLE_PULL),
  owner: "octocat",
  repo: "hello-world",
} satisfies PrContext;
const cleanCi = {
  all: [
    {
      description: "",
      kind: "passed",
      link: "",
      name: "ci",
      reportedState: "SUCCESS",
      workflow: "",
    },
  ],
  failed: [],
  github: {
    basis: "merge-state",
    headRollupState: "SUCCESS",
    kind: "allowed",
    mergeStateStatus: "CLEAN",
  },
  hadPreviousPassingCi: false,
  kind: "ci-clean",
  pending: [],
  source: "gh-pr-checks",
} satisfies CiClean;
const readyPr = {
  context,
  kind: "ready-pr",
  proof: {
    ci: cleanCi,
    gate: {
      draft: "not-draft",
      reviewDecision: "APPROVED",
      state: "OPEN",
    },
    mergeability: "clear",
    threads: [],
  },
} satisfies ReadyPr;
export const ready = {
  exitCode: 0,
  kind: "READY",
  mode: "single",
  observedAt: "2026-07-26T00:00:00.000Z",
  schemaVersion: 1,
  scope: { kind: "single", pr: readyPr },
  sequence: 1,
  terminal: true,
} satisfies ReadyVerdict;


// PR 179929's shape. Each assertion below stays a single short statement so a
// Reformat cannot drift the directive away from the line that actually errors.
const refused = {
  basis: "rollup",
  headRollupState: "FAILURE",
  kind: "allowed",
  mergeStateStatus: "BLOCKED",
} as const;

// @ts-expect-error BLOCKED with a failing rollup is a refusal, not an allowance.
export const refusalIsNotAllowed = (): GitHubMergeAllowed => refused;

// @ts-expect-error CI cannot be clean while GitHub refuses the merge.
export const refusalIsNotClean: CiClean = { ...cleanCi, github: refused };

// @ts-expect-error READY cannot carry the failing-checks exit code.
export const readyWithBlockerExit: ReadyVerdict = { ...ready, exitCode: 4 };

const unprovenPr = { context, kind: "ready-pr" } as const;

// @ts-expect-error An open READY row must carry positive readiness proof.
export const readyWithoutProof = (): ReadyPr => unprovenPr;
