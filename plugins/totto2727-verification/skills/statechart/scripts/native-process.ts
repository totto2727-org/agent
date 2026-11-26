// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the bytes and UTF-8 boundaries in the host's streams.
import { Buffer } from "node:buffer";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { execFile, spawn } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to type the real subprocess status and streams.
import type { ChildProcess, ExecFileException, SpawnOptions } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The standalone tool checks paths through the native filesystem.
import { stat } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { splitLines } from "./frontends/dot.ts";
import { PART, hasObjectType, isNumber, isString, matchesNull, matchesUndefined, visitItems } from "./ir.ts";
import type { Output } from "./ir.ts";

export const fileExists = async (file: string): Promise<boolean> => {
  try {
    // Deno 2.0 never resolves the Node compatibility layer's access promise.
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

const BUFFER_START = 0;
const NEXT_BYTE = 1;
const LINE_FEED_BYTE = 10;
const NO_LINE_FEED = -1;
const BUFFER_GROWTH = 2;
// oxlint-disable-next-line unicorn/no-null -- A null read position advances the native descriptor's cursor.
const CURRENT_POSITION = null;

interface LineBuffer {
  bytes: Buffer;
  kept: number;
}

const readFileBlock = (descriptor: number, buffer: LineBuffer): number => {
  if (buffer.kept === buffer.bytes.length) {
    buffer.bytes = Buffer.concat([buffer.bytes], buffer.bytes.length * BUFFER_GROWTH);
  }
  // oxlint-disable-next-line node/no-sync -- The synchronous line iterator preserves the parser's existing streaming input contract.
  return fs.readSync(descriptor, buffer.bytes, buffer.kept, buffer.bytes.length - buffer.kept, CURRENT_POSITION);
};

const completedLines = function* (buffer: LineBuffer, end: number): Generator<string> {
  const newline = buffer.bytes.lastIndexOf(LINE_FEED_BYTE, end - NEXT_BYTE);
  if (newline === NO_LINE_FEED) {
    buffer.kept = end;
    return;
  }
  yield* splitLines(buffer.bytes.toString("utf8", BUFFER_START, newline));
  buffer.kept = buffer.bytes.copy(buffer.bytes, BUFFER_START, newline + NEXT_BYTE, end);
};

const lineBlocks = function* (descriptor: number): Generator<string> {
  const buffer: LineBuffer = { bytes: Buffer.allocUnsafe(PART), kept: BUFFER_START };
  // oxlint-disable-next-line rules/no-for-loops -- Yield line blocks as the lexer asks for them, stopping when the native read reaches EOF.
  for (;;) {
    const read = readFileBlock(descriptor, buffer);
    if (!read) {break;}
    yield* completedLines(buffer, buffer.kept + read);
  }
  yield* splitLines(buffer.bytes.toString("utf8", BUFFER_START, buffer.kept));
};

export const fileLines = function* (file: string): Generator<string> {
  // oxlint-disable-next-line node/no-sync -- Open the source on the same synchronous iterator used by the native lexer.
  const descriptor = fs.openSync(file, "r");
  try {
    yield* lineBlocks(descriptor);
  } finally {
    // oxlint-disable-next-line node/no-sync -- Close the native descriptor on iterator completion and cancellation.
    fs.closeSync(descriptor);
  }
};

export interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error: ExecFileException | undefined;
}

interface ChildOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  windowsHide?: boolean;
}

const MAX_CAPTURE_BYTES = 1_073_741_824;
export const CHILD_SUCCESS = 0;
// oxlint-disable-next-line unicorn/no-null -- Native subprocess results report a null status for signal or launch failure.
const NO_NATIVE_STATUS = null;

const exitStatus = (error: ExecFileException | null): number | null => {
  if (!error) {return CHILD_SUCCESS;}
  return isNumber(error.code) ? error.code : NO_NATIVE_STATUS;
};

export const runChild = async (file: string, args: string[], options: ChildOptions): Promise<ChildResult> => {
  const { promise, resolve } = Promise.withResolvers<ChildResult>();
  execFile(
    file,
    args,
    { encoding: "utf8", maxBuffer: MAX_CAPTURE_BYTES, windowsHide: true, ...options },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Capture exit status, stdout, and stderr together through the native execFile callback.
    (error, stdout, stderr) => {
      // oxlint-disable-next-line eslint/sort-keys -- Keep the native subprocess result's established field order.
      resolve({ status: exitStatus(error), stdout, stderr, error: isString(error?.code) ? error : undefined });
    },
  );
  return promise;
};

export const messageOf = (error: unknown): string =>
  hasObjectType(error) &&
  !matchesNull(error) &&
  "message" in error &&
  isString(error.message)
    ? error.message
    : inspect(error);

interface OutputFile {
  descriptor: number;
  size: number;
}

const outputFile = (file: string): OutputFile => {
  // oxlint-disable-next-line node/no-sync -- Keep the descriptor available to repeated synchronous replays after stage cleanup removes its path.
  const descriptor = fs.openSync(file, "r");
  // oxlint-disable-next-line node/no-sync -- Capture the byte length with the descriptor before handing the output to its readers.
  return { descriptor, size: fs.fstatSync(descriptor).size };
};

const outputBytes = function* ({ descriptor, size }: OutputFile): Generator<Uint8Array> {
  const position = { offset: BUFFER_START };
  while (position.offset < size) {
    const bytes = Buffer.allocUnsafe(Math.min(PART, size - position.offset));
    // oxlint-disable-next-line node/no-sync -- Each replay reads from the captured descriptor at its own byte offset.
    const read = fs.readSync(descriptor, bytes, BUFFER_START, bytes.length, position.offset);
    if (!read) {break;}
    position.offset += read;
    yield bytes.subarray(BUFFER_START, read);
  }
};

const joined = (files: string[]): Output => {
  const opened: OutputFile[] = [];
  visitItems(files, (file) => {opened.push(outputFile(file));});
  return {
    *[Symbol.iterator](): Generator<Uint8Array> {
      // oxlint-disable-next-line rules/no-for-loops -- Keep artifact replays ordered and yield bounded file slices without buffering the complete stream.
      for (const artifact of opened) {yield* outputBytes(artifact);}
    },
  };
};

const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });

export const outputLines = function* (output: Output): Generator<string> {
  const pending: { bytes: Uint8Array } = { bytes: new Uint8Array() };
  // oxlint-disable-next-line rules/no-for-loops -- Yield complete lines lazily and keep a partial line only until the next input slice.
  for (const part of output) {
    const bytes = pending.bytes.length ? Buffer.concat([pending.bytes, part]) : part;
    const newline = bytes.lastIndexOf(LINE_FEED_BYTE);
    if (newline === NO_LINE_FEED) {
      pending.bytes = bytes;
    } else {
      yield* splitLines(utf8.decode(bytes.subarray(BUFFER_START, newline)));
      pending.bytes = bytes.subarray(newline + NEXT_BYTE);
    }
  }
  yield* splitLines(utf8.decode(pending.bytes));
};

export interface FileResult {
  status: number | null;
  stdout: string;
  output: Output;
  error: Error | undefined;
}

type ArtifactPaths = [stdout: string, stderr: string];

const launchWithArtifacts = (
  command: { args: string[]; file: string },
  files: ArtifactPaths,
  options: SpawnOptions,
): ChildProcess => {
  const descriptors: number[] = [];
  try {
    visitItems(files, (artifact) => {
      // oxlint-disable-next-line node/no-sync -- Open these descriptors on the same turn as the native spawn that inherits them.
      descriptors.push(fs.openSync(artifact, "w"));
    });
    return spawn(command.file, command.args, { ...options, stdio: ["ignore", ...descriptors], windowsHide: true });
  } finally {
    visitItems(descriptors, (descriptor) => {
      // oxlint-disable-next-line node/no-sync -- Release the parent's copies before attaching the native child's event handlers.
      fs.closeSync(descriptor);
    });
  }
};

export const runToFiles = async (
  file: string,
  args: string[],
  { out, ...options }: { out: string; cwd: string; env: NodeJS.ProcessEnv },
): Promise<FileResult> => {
  const files: ArtifactPaths = [`${out}.stdout`, `${out}.stderr`];
  const child = launchWithArtifacts({ args, file }, files, options);
  const { promise, resolve } = Promise.withResolvers<FileResult>();
  const [stdout] = files;
  const observed: { error?: Error } = {};
  const settle = (code: number | null): void => {
    const { error } = observed;
    // oxlint-disable-next-line eslint/sort-keys -- Keep the native file result's field order.
    resolve({ status: error ? NO_NATIVE_STATUS : code, stdout, output: joined(files), error });
  };
  child.on("error", (error) => {
    observed.error = error;
    if (matchesUndefined(child.pid)) {settle(NO_NATIVE_STATUS);}
  });
  child.on("close", (code) => {
    if (!matchesUndefined(child.pid)) {settle(code);}
  });
  return promise;
};
