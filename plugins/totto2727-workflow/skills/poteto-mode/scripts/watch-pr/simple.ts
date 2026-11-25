import { classifyPr, selectTierMajorStackDecision } from "./decision.ts";
import { matchesNull } from "./native-predicates.ts";
import { pollUntilTerminal } from "./polling.ts";
import type { RunDependencies, StepResult } from "./polling.ts";
import { readSnapshot } from "./snapshot.ts";
import { nonEmpty } from "./types.ts";
import type { NonEmpty, PollingOptions, PrContext, PrDecision, PrSnapshot, StackDecision, TerminalVerdict, WatchMode } from "./types.ts";
import { blockerVerdict, verdictFactory } from "./verdict.ts";
import type { VerdictStamp } from "./verdict.ts";

const EXIT_SUCCESS = 0;
const EXIT_TIMEOUT = 5;
const FIRST_CONTEXT = 0;

type SimpleInput = Readonly<{
  dependencies: RunDependencies;
  contexts: NonEmpty<PrContext>;
  mode: WatchMode;
  statusOnly: boolean;
  options: PollingOptions;
}>;

const readRows = async ({ contexts, dependencies, options }: SimpleInput): Promise<NonEmpty<PrSnapshot>> => {
  const rows: PrSnapshot[] = [];
  // oxlint-disable-next-line rules/no-for-loops -- Read a stack's PRs in order and stop on the first query failure.
  for (const context of contexts) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A PR's result or failure is observed before any later PR is queried.
    const row = await readSnapshot({ allowDraft: options.allowDraft, context, pendingHistory: "include", reader: dependencies.reader });
    rows.push(row);
  }
  const complete = nonEmpty(rows);
  if (matchesNull(complete)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native watcher error for an empty context.
    throw new Error("watch context cannot be empty");
  }
  return complete;
};

type SimpleStep = StepResult<TerminalVerdict>;
type ReadyVerdict = Extract<TerminalVerdict, { kind: "READY" }>;
type ReadyScope = ReadyVerdict["scope"];
type ReadyMode = ReadyVerdict["mode"];

interface SimpleRun {
  args: SimpleInput;
  stamp: VerdictStamp;
}

const terminal = (verdict: TerminalVerdict): SimpleStep => ({ kind: "terminal", verdict });

const ready = (scope: ReadyScope, stamp: VerdictStamp, mode: ReadyMode): SimpleStep =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized successful watcher envelope.
  terminal(stamp({ kind: "READY", terminal: true, exitCode: EXIT_SUCCESS, scope }, mode));

const wait = (decision: Extract<PrDecision, { kind: "waiting" }>, { args, stamp }: SimpleRun): SimpleStep => {
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the watcher envelope and reason field order.
  args.dependencies.emit(stamp({ kind: "WAITING", terminal: false, frontier: decision.frontier, reason: { kind: "pending-checks", pending: decision.pending } }));
  return {
    kind: "sleep",
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized timeout envelope and waiting reason.
    onDeadline: () => stamp({ kind: "TIMEOUT", terminal: true, exitCode: EXIT_TIMEOUT, reason: { kind: "pending-checks", pending: decision.pending } }),
    seconds: args.options.interval,
  };
};

const stepFor = (decision: PrDecision | StackDecision, mode: ReadyMode, run: SimpleRun): SimpleStep => {
  const { stamp } = run;
  if (decision.kind === "blocker") {return terminal(blockerVerdict(stamp, decision.blocker));}
  if (decision.kind === "ready" || decision.kind === "merged") {return ready({ kind: "single", pr: decision.pr }, stamp, mode);}
  if (decision.kind === "clear") {return ready({ kind: "stack", prs: decision.prs }, stamp, mode);}
  return wait(decision, run);
};

const readStep = async (run: SimpleRun): Promise<SimpleStep> => {
  const { args, stamp } = run;
  const rows = await readRows(args);
  if (args.statusOnly) {
    // oxlint-disable-next-line eslint/sort-keys -- Keep the public status-only report in its existing field order.
    return terminal(stamp({ kind: "STATUS", terminal: true, exitCode: EXIT_SUCCESS, reason: "status-only", rows }));
  }
  if (args.mode === "queued-stack") {
    // oxlint-disable-next-line rules/require-tagged-error -- Keep the existing native error for an invalid queued run.
    throw new Error("queued-stack requires status-only in the simple runner");
  }
  if (args.mode === "stack") {
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized polling status fields.
    args.dependencies.emit(stamp({ kind: "STATUS", terminal: false, reason: "poll", rows }, args.mode));
  }
  const decision = args.mode === "single"
    ? classifyPr(rows[FIRST_CONTEXT], args.options.allowDraft)
    : selectTierMajorStackDecision(rows, args.options.allowDraft);
  return stepFor(decision, args.mode, run);
};

export const runSimple = async function runSimple(args: SimpleInput): Promise<TerminalVerdict> {
  const stamp = verdictFactory(args.dependencies.clock, args.mode);
  return pollUntilTerminal({
    dependencies: args.dependencies,
    options: args.options,
    stamp,
    step: async () => readStep({ args, stamp }),
  });
};
