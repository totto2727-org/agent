import { EXIT_SUCCESS, EXIT_TIMEOUT } from "./verdict-contract.ts";
import { matchesNull } from "./native-predicates.ts";
import { pollUntilTerminal } from "./polling.ts";
import type { RunDependencies, StepResult } from "./polling.ts";
import { applyQueueSnapshot, createQueueState, evaluateQueue, planQueue } from "./queue-state.ts";
import type { QueueEvaluation, QueueState, QueueWork } from "./queue-state.ts";
import { readSnapshot } from "./snapshot.ts";
import type { MergedPr, NonEmpty, PollingOptions, PrContext, QueueTerminalVerdict } from "./types.ts";
import { blockerVerdict, verdictFactory } from "./verdict.ts";
import type { VerdictStamp } from "./verdict.ts";

const SWEEP_HEAD = 0;

type QueueInput = Readonly<{
  dependencies: RunDependencies;
  contexts: NonEmpty<PrContext>;
  options: PollingOptions;
}>;

interface QueueRun {
  args: QueueInput;
  stamp: VerdictStamp<"queued-stack">;
  state: QueueState;
}

type QueueStep = StepResult<QueueTerminalVerdict>;
type Advance = Extract<QueueEvaluation, { kind: "advance" }>;
type Waiting = Extract<QueueEvaluation, { kind: "waiting" }>;
type Timeout = Extract<QueueEvaluation, { kind: "timeout" }>;

const terminal = (verdict: QueueTerminalVerdict): QueueStep => ({ kind: "terminal", verdict });

const completed = (merged: NonEmpty<MergedPr>, { stamp, state }: QueueRun): QueueStep =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain the queued completion envelope's serialized field order.
  terminal(stamp({ kind: "COMPLETE", terminal: true, exitCode: EXIT_SUCCESS, queue: state.queue, merged }));

const timedOut = ({ frontier, unmergedCount }: Timeout, { stamp }: QueueRun): QueueStep =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain the public timeout envelope and its queued reason field order.
  terminal(stamp({ kind: "TIMEOUT", terminal: true, exitCode: EXIT_TIMEOUT, reason: { kind: "queued-stack", frontier, unmergedCount } }));

const progress = (step: Advance | Waiting, { args, stamp }: QueueRun): QueueStep => {
  if (step.kind === "advance") {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the existing watcher advance envelope order.
    args.dependencies.emit(stamp({ kind: "ADVANCE", terminal: false, merged: step.merged, frontier: step.frontier, remaining: step.remaining }));
    return { kind: "continue" };
  }
  if (step.emit) {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the existing queued waiting envelope order.
    args.dependencies.emit(stamp({ kind: "WAITING", terminal: false, frontier: step.frontier, reason: step.reason }));
  }
  return { kind: "sleep", seconds: args.options.interval };
};

const evaluatedStep = (evaluation: QueueEvaluation, run: QueueRun): QueueStep => {
  run.state = evaluation.state;
  if (evaluation.kind === "complete") {return completed(evaluation.merged, run);}
  if (evaluation.kind === "blocker") {return terminal(blockerVerdict(run.stamp, evaluation.blocker));}
  if (evaluation.kind === "timeout") {return timedOut(evaluation, run);}
  return progress(evaluation, run);
};

const readWork = async (work: QueueWork, run: QueueRun): Promise<QueueStep> => {
  const { dependencies, options } = run.args;
  const context = work.kind === "whole-stack-sweep" ? work.remaining[SWEEP_HEAD] : work.frontier;
  const snapshot = await readSnapshot({ allowDraft: options.allowDraft, context, pendingHistory: "omit", reader: dependencies.reader });
  const { completedSweepRows, state } = applyQueueSnapshot(run.state, snapshot, dependencies.clock.now(), options);
  run.state = state;
  if (!matchesNull(completedSweepRows)) {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized sweep status fields and emit before evaluating the queue.
    dependencies.emit(run.stamp({ kind: "STATUS", terminal: false, reason: "whole-stack-sweep", rows: completedSweepRows }));
  }
  if (!matchesNull(state.work)) {return { kind: "continue" };}
  return evaluatedStep(evaluateQueue(state, dependencies.clock.now(), options), run);
};

const nextStep = async (run: QueueRun): Promise<QueueStep> => {
  const { dependencies, options } = run.args;
  run.state = planQueue(run.state, dependencies.clock.now());
  const { work } = run.state;
  if (!matchesNull(work)) {return readWork(work, run);}
  const evaluation = evaluateQueue(run.state, dependencies.clock.now(), options);
  if (evaluation.kind !== "complete") {
    // oxlint-disable-next-line rules/require-tagged-error -- Keep the watcher's native error when a queue is active without work.
    throw new Error("queue has no work while active");
  }
  return completed(evaluation.merged, run);
};

export const runQueued = async function runQueued(args: QueueInput): Promise<QueueTerminalVerdict> {
  const { contexts, dependencies, options } = args;
  const state = createQueueState(contexts, dependencies.clock.now());
  const stamp = verdictFactory(dependencies.clock, "queued-stack");
  // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized initial queue envelope before its first poll.
  dependencies.emit(stamp({ kind: "QUEUE", terminal: false, queue: contexts }));
  const run = { args, stamp, state };
  return pollUntilTerminal({ dependencies, options, stamp, step: async () => nextStep(run) });
};
