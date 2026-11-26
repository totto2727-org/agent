// oxlint-disable-next-line rules/no-node-imports -- Read the native git and gh subprocess outputs without loading additional runtime dependencies.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Type the streaming native command output without a runtime import.
import type { Readable } from "node:stream";
import { errorMessage, WatcherQueryError } from "./github-error.ts";

type Argv = Readonly<[string, ...string[]]>;
type CommandResult = Readonly<{
  code: number;
  stdout: string;
  stderr: string;
}>;

const FIRST_LINE_ONLY = 1;
const LINE_START = 0;
const COMMAND_DETAIL_WIDTH = 240;
const SUCCESS_EXIT = 0;
const SIGNAL_EXIT = -1;

export const firstLine = (value: string): string => {
  const [line = ""] = value.trim().split(/\r?\n/u, FIRST_LINE_ONLY);
  return line.slice(LINE_START, COMMAND_DETAIL_WIDTH);
};

const collect = (stream: Readable): string[] => {
  const chunks: string[] = [];
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {chunks.push(chunk);});
  return chunks;
};

export const run = async function run([file, ...args]: Argv): Promise<CommandResult> {
  const { promise, reject, resolve } = Promise.withResolvers<CommandResult>();
  const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  child.on("error", reject);
  child.on("close", (code) => {
    const output = stdout.join("");
    resolve({ code: code ?? SIGNAL_EXIT, stderr: stderr.join(""), stdout: output });
  });
  return promise;
};

export const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    // oxlint-disable-next-line eslint/sort-keys -- Keep the serialized JSON failure field order.
    throw new WatcherQueryError({ kind: "json-parse", retryable: true, detail: `${label}: ${errorMessage(error)}` });
  }
};

export const runJson = async (argv: Argv): Promise<unknown> => {
  const result = await run(argv);
  if (result.code !== SUCCESS_EXIT) {
    const summary = firstLine(result.stderr);
    const detail = summary || `${argv.join(" ")} exited ${result.code}`;
    // oxlint-disable-next-line eslint/sort-keys -- Keep the serialized failure shape for the command, exit code and stderr.
    throw new WatcherQueryError({ kind: "command-exit", retryable: true, code: result.code, detail });
  }
  return parseJson(result.stdout, argv.join(" "));
};
