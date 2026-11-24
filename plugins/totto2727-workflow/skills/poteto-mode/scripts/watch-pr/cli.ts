// oxlint-disable-next-line rules/no-node-imports -- The standalone watcher waits between polls using Bun's native timer.
import { setTimeout as delay } from "node:timers/promises";
// oxlint-disable-next-line rules/no-node-imports -- Parse the same switches in the standalone watcher on its supported Bun versions.
import { parseArgs as parseOptions } from "node:util";
import { GhGitHubReader, WatcherQueryError, discoverStack, errorMessage, resolveContext } from "./github.ts";
import { runQueued, runSimple, statusQueryVerdict, verdictFactory } from './policy.ts';
import type { WatchClock } from './policy.ts';
import { renderJson, renderPretty } from "./render.ts";
import type * as Watch from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
import { matchesNull, matchesUndefined } from "./native-predicates.ts";

export type CliOptions = Readonly<{
  owner: string | null;
  repo: string | null;
  pr: Watch.PrNumber | null;
  mode: Watch.WatchMode;
  stackPrs: Readonly<Watch.PrNumber[]>;
  statusOnly: boolean;
  pretty: boolean;
  polling: Watch.PollingOptions;
}>;
const NONNEGATIVE_MINIMUM = 0;
const MILLISECONDS_PER_SECOND = 1000;
const PROCESS_ARGUMENT_START = 2;
const FIRST_STACK_PR = 0;
const FIRST_QUERY_ATTEMPT = 1;
const EXIT_SUCCESS = 0;
const EXIT_USAGE = 64;
// oxlint-disable-next-line unicorn/no-null -- Absent values in the existing CLI option shape use null.
const UNSUPPLIED = null;

const usageError = (message: string): never => {
  // oxlint-disable-next-line rules/require-tagged-error -- Keep native Error messages and constructors for CLI usage failures.
  throw new Error(message);
};

const positiveNumber = function (value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= NONNEGATIVE_MINIMUM)
    {usageError(`${option}: ${value} must be greater than zero`);}
  return parsed;
};
const nonNegativeNumber = function (value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < NONNEGATIVE_MINIMUM) {usageError("must be zero or greater");}
  return parsed;
};
const positiveInteger = function (value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= NONNEGATIVE_MINIMUM) {usageError("must be a positive integer");}
  return parsed;
};
const prNumber = function (value: string): Watch.PrNumber {
  try {
    return parsePrNumber(Number(value.replace(/^#/u, "")));
  } catch {
    return usageError("must be a positive integer");
  }
};
const stackPrList = function (value: string): Watch.NonEmpty<Watch.PrNumber> {
  const numbers = value.split(",").map((part) => prNumber(part.trim()));
  if (new Set(numbers).size !== numbers.length) {usageError("contains a duplicate PR");}
  const parsed = nonEmpty(numbers);
  if (matchesNull(parsed)) {return usageError("cannot be empty");}
  return parsed;
};
const usage = [
  "Usage: watch-pr [--owner OWNER] [--repo REPO] [--pr NUMBER]",
  "  [--stack | --queued-stack [--stack-prs N,...]]",
  "  [--interval SECONDS] [--sweep-interval SECONDS] [--timeout SECONDS]",
  "  [--max-query-errors COUNT] [--allow-draft] [--status-only] [--pretty]",
  "JSON (NDJSON while polling) is the default. A timeout of zero disables the deadline.",
].join("\n");
export const parseArgs = function parseArgs(argv: Readonly<string[]>): CliOptions {
  const { values: raw } = parseOptions({
    allowPositionals: false,
    args: [...argv],
    options: {
      "allow-draft": { type: "boolean" },
      interval: { type: "string" },
      "max-query-errors": { type: "string" },
      owner: { type: "string" },
      pr: { type: "string" },
      pretty: { type: "boolean" },
      "queued-stack": { type: "boolean" },
      repo: { type: "string" },
      stack: { type: "boolean" },
      "stack-prs": { type: "string" },
      "status-only": { type: "boolean" },
      "sweep-interval": { type: "string" },
      timeout: { type: "string" },
    },
    strict: true,
  });
  const stack = raw.stack ?? false;
  const queuedStack = raw["queued-stack"] ?? false;
  if (stack && queuedStack) {usageError("--stack conflicts with --queued-stack");}
  if (!matchesUndefined(raw["stack-prs"]) && !queuedStack)
    {usageError("--stack-prs requires --queued-stack");}
  const classicMode = stack ? "stack" : "single";
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the exported parser's option field order.
  return {
    owner: raw.owner ?? UNSUPPLIED,
    repo: raw.repo ?? UNSUPPLIED,
    pr: matchesUndefined(raw.pr) ? UNSUPPLIED : prNumber(raw.pr),
    mode: queuedStack ? "queued-stack" : classicMode,
    stackPrs: matchesUndefined(raw["stack-prs"]) ? [] : stackPrList(raw["stack-prs"]),
    statusOnly: raw["status-only"] ?? false,
    pretty: raw.pretty ?? false,
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the exported parser's polling field order and validation order.
    polling: {
      interval: positiveNumber(raw.interval ?? "60", "--interval"),
      sweepInterval: positiveNumber(raw["sweep-interval"] ?? "300", "--sweep-interval"),
      timeout: nonNegativeNumber(raw.timeout ?? "0"),
      maxQueryErrors: positiveInteger(raw["max-query-errors"] ?? "5"),
      allowDraft: raw["allow-draft"] ?? false,
    },
  };
};
export type CliRuntime = Readonly<{
  reader: Watch.GitHubReader;
  clock: WatchClock;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}>;
const realRuntime = function (): CliRuntime {
  return {
    clock: {
      now: () => performance.now() / MILLISECONDS_PER_SECOND,
      // oxlint-disable-next-line rules/no-js-date -- The review observation protocol records the current wall-clock time as ISO 8601.
      observedAt: () => new Date().toISOString(),
      sleep: async (seconds) => {
        await delay(seconds * MILLISECONDS_PER_SECOND);
      },
    },
    reader: new GhGitHubReader(),
    stderr: (value) => {process.stderr.write(value);},
    stdout: (value) => {process.stdout.write(value);},
  };
};

type OptionsResult = { options: CliOptions } | { error: unknown };
const readOptions = (argv: Readonly<string[]>): OptionsResult => {
  try {
    return { options: parseArgs(argv) };
  } catch (error) {
    return { error };
  }
};

type ContextResult = { contexts: Watch.NonEmpty<Watch.PrContext> } | { error: WatcherQueryError };
const queryContexts = async (runtime: CliRuntime, options: CliOptions): Promise<ContextResult> => {
  try {
    const seed = await resolveContext({
      owner: options.owner,
      pr: options.pr ?? options.stackPrs.at(FIRST_STACK_PR) ?? UNSUPPLIED,
      reader: runtime.reader,
      repo: options.repo,
    });
    const explicitStack = nonEmpty(options.stackPrs.map((number) => ({ ...seed, number })));
    const contexts = explicitStack ?? (options.mode === "single" ? [seed] : await discoverStack(runtime.reader, seed));
    return { contexts };
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) {throw error;}
    return { error };
  }
};

const renderVerdict = (pretty: boolean, verdict: Watch.WatcherVerdict): string =>
  pretty ? renderPretty(verdict) : renderJson(verdict);

const watchContexts = async (
  runtime: CliRuntime,
  options: CliOptions,
  contexts: Watch.NonEmpty<Watch.PrContext>,
): Promise<Watch.TerminalVerdict> => {
  const emit = (verdict: Watch.ProgressVerdict): void => {
    runtime.stdout(renderVerdict(options.pretty, verdict));
  };
  const dependencies = { clock: runtime.clock, emit, reader: runtime.reader };
  if (options.mode === "queued-stack" && !options.statusOnly) {
    return runQueued({ contexts, dependencies, options: options.polling });
  }
  return runSimple({ contexts, dependencies, mode: options.mode, options: options.polling, statusOnly: options.statusOnly });
};

const watch = async (runtime: CliRuntime, options: CliOptions): Promise<number> => {
  const resolution = await queryContexts(runtime, options);
  const verdict = "error" in resolution
    ? statusQueryVerdict(verdictFactory(runtime.clock, options.mode), FIRST_QUERY_ATTEMPT, resolution.error.failure)
    : await watchContexts(runtime, options, resolution.contexts);
  runtime.stdout(renderVerdict(options.pretty, verdict));
  return verdict.exitCode;
};

export const main = async function main(
  argv: Readonly<string[]>,
  runtime: CliRuntime = realRuntime(),
): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    runtime.stdout(`${usage}\n`);
    return EXIT_SUCCESS;
  }
  const parsed = readOptions(argv);
  if ("error" in parsed) {
    runtime.stderr(`error: ${errorMessage(parsed.error)}\n`);
    return EXIT_USAGE;
  }
  return watch(runtime, parsed.options);
};

if (import.meta.main) {process.exitCode = await main(process.argv.slice(PROCESS_ARGUMENT_START));}
