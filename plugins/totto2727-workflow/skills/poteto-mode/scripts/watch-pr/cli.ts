import { setTimeout as delay } from "node:timers/promises";
import { parseArgs as parseOptions } from "node:util";
import { GhGitHubReader, WatcherQueryError, discoverStack, resolveContext } from "./github.ts";
import {
  runQueued,
  runSimple,
  statusQueryVerdict,
  verdictFactory,
  type WatchClock,
} from "./policy.ts";
import { renderJson, renderPretty } from "./render.ts";
import type * as T from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
export interface CliOptions {
  readonly owner: string | null;
  readonly repo: string | null;
  readonly pr: T.PrNumber | null;
  readonly mode: T.WatchMode;
  readonly stackPrs: readonly T.PrNumber[];
  readonly statusOnly: boolean;
  readonly pretty: boolean;
  readonly polling: T.PollingOptions;
}
function positiveNumber(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${option}: ${value} must be greater than zero`);
  return parsed;
}
function nonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("must be zero or greater");
  return parsed;
}
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("must be a positive integer");
  return parsed;
}
function prNumber(value: string): T.PrNumber {
  try {
    return parsePrNumber(Number(value.replace(/^#/, "")));
  } catch {
    throw new Error("must be a positive integer");
  }
}
function stackPrList(value: string): T.NonEmpty<T.PrNumber> {
  const numbers = value.split(",").map((part) => prNumber(part.trim()));
  if (new Set(numbers).size !== numbers.length) throw new Error("contains a duplicate PR");
  const parsed = nonEmpty(numbers);
  if (parsed === null) throw new Error("cannot be empty");
  return parsed;
}
const usage = [
  "Usage: watch-pr [--owner OWNER] [--repo REPO] [--pr NUMBER]",
  "  [--stack | --queued-stack [--stack-prs N,...]]",
  "  [--interval SECONDS] [--sweep-interval SECONDS] [--timeout SECONDS]",
  "  [--max-query-errors COUNT] [--allow-draft] [--status-only] [--pretty]",
  "JSON (NDJSON while polling) is the default. A timeout of zero disables the deadline.",
].join("\n");
export function parseArgs(argv: readonly string[]): CliOptions {
  const { values: raw } = parseOptions({
    args: [...argv],
    strict: true,
    allowPositionals: false,
    options: {
      owner: { type: "string" },
      repo: { type: "string" },
      pr: { type: "string" },
      stack: { type: "boolean" },
      "queued-stack": { type: "boolean" },
      "stack-prs": { type: "string" },
      interval: { type: "string" },
      "sweep-interval": { type: "string" },
      timeout: { type: "string" },
      "max-query-errors": { type: "string" },
      "status-only": { type: "boolean" },
      "allow-draft": { type: "boolean" },
      pretty: { type: "boolean" },
    },
  });
  if (raw.stack && raw["queued-stack"]) throw new Error("--stack conflicts with --queued-stack");
  if (raw["stack-prs"] !== undefined && !raw["queued-stack"])
    throw new Error("--stack-prs requires --queued-stack");
  return {
    owner: raw.owner ?? null,
    repo: raw.repo ?? null,
    pr: raw.pr === undefined ? null : prNumber(raw.pr),
    mode: raw["queued-stack"] ? "queued-stack" : raw.stack ? "stack" : "single",
    stackPrs: raw["stack-prs"] === undefined ? [] : stackPrList(raw["stack-prs"]),
    statusOnly: raw["status-only"] ?? false,
    pretty: raw.pretty ?? false,
    polling: {
      interval: positiveNumber(raw.interval ?? "60", "--interval"),
      sweepInterval: positiveNumber(raw["sweep-interval"] ?? "300", "--sweep-interval"),
      timeout: nonNegativeNumber(raw.timeout ?? "0"),
      maxQueryErrors: positiveInteger(raw["max-query-errors"] ?? "5"),
      allowDraft: raw["allow-draft"] ?? false,
    },
  };
}
export interface CliRuntime {
  readonly reader: T.GitHubReader;
  readonly clock: WatchClock;
  readonly stdout: (value: string) => void;
  readonly stderr: (value: string) => void;
}
function realRuntime(): CliRuntime {
  return {
    reader: new GhGitHubReader(),
    clock: {
      now: () => performance.now() / 1_000,
      observedAt: () => new Date().toISOString(),
      sleep: async (seconds) => {
        await delay(seconds * 1_000);
      },
    },
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  };
}
export async function main(
  argv: readonly string[],
  runtime: CliRuntime = realRuntime(),
): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    runtime.stdout(`${usage}\n`);
    return 0;
  }
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    runtime.stderr(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 64;
  }
  const render = options.pretty ? renderPretty : renderJson;
  const emit = (verdict: T.ProgressVerdict): void => runtime.stdout(render(verdict));
  let contexts: T.NonEmpty<T.PrContext>;
  try {
    const seed = await resolveContext({
      reader: runtime.reader,
      owner: options.owner,
      repo: options.repo,
      pr: options.pr ?? options.stackPrs[0] ?? null,
    });
    contexts =
      nonEmpty(options.stackPrs.map((number) => ({ ...seed, number }))) ??
      (options.mode === "single" ? [seed] : await discoverStack(runtime.reader, seed));
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) throw error;
    const verdict = statusQueryVerdict(
      verdictFactory(runtime.clock, options.mode),
      1,
      error.failure,
    );
    runtime.stdout(render(verdict));
    return verdict.exitCode;
  }
  const dependencies = { reader: runtime.reader, clock: runtime.clock, emit };
  const verdict =
    options.mode === "queued-stack" && !options.statusOnly
      ? await runQueued({ dependencies, contexts, options: options.polling })
      : await runSimple({
          dependencies,
          contexts,
          mode: options.mode,
          statusOnly: options.statusOnly,
          options: options.polling,
        });
  runtime.stdout(render(verdict));
  return verdict.exitCode;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
