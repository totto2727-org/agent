import { EC, LEVEL, PART, isString, matchesUndefined } from '#statechart/ir.ts';
import type { Message, Part } from '#statechart/ir.ts';

const PREFIX: Record<number, string> = {
  [LEVEL.ERROR]: "Error: ",
  [LEVEL.TLCBUG]: "TLC Bug: ",
  [LEVEL.WARNING]: "Warning: ",
  [LEVEL.STATE]: "State ",
};
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const TWO_DIGITS = 2;
const JANUARY = 0;
const FIRST_DAY = 1;
const WARNING_HINT = "(Use the -nowarning option to disable this warning.)";

const pad = (time: number): string => String(time).padStart(TWO_DIGITS, "0");

export const runtime = function runtime(milliseconds: number): string {
  // oxlint-disable-next-line rules/no-js-date -- Translate TLC's elapsed time using the native UTC fields that its plain-text report expects.
  const date = new Date(milliseconds > DAY ? milliseconds - DAY : milliseconds);
  const [hours, minutes, seconds] = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map((time) => pad(time));
  if (milliseconds > DAY) {
    // oxlint-disable-next-line rules/no-js-date -- Preserve the legacy UTC day-of-year rollover in TLC's displayed duration.
    const yearStart = Date.UTC(date.getUTCFullYear(), JANUARY, FIRST_DAY);
    return `${Math.floor((date.getTime() - yearStart) / DAY) + FIRST_DAY}d ${hours}h`;
  }
  if (milliseconds > HOUR) {return `${hours}h ${minutes}min`;}
  if (milliseconds > MINUTE) {return `${minutes}min ${seconds}s`;}
  return `${seconds}s`;
};

const firstLine = ({ code, level }: Message, line: string): string => {
  if (code === EC.TLC_BACK_TO_STATE)
    {return line.replace(/^(?<state>\d+): Back to state: /u, "Back to state $<state>: ");}
  if (code === EC.TLC_FINISHED)
    {return line.replace(
      /^Finished in (?<milliseconds>\d+)ms/u,
      (_match, milliseconds: string) => `Finished in ${runtime(Number(milliseconds))}`,
    );}
  return (PREFIX[level] ?? "") + line;
};

const render = (message: Message): string =>
  (message.beforeMarker ?? "") +
  firstLine(message, message.body.map((part) => (isString(part) ? part : render(part))).join("\n"));

interface PrintState {
  progress: Message | undefined;
  warned: boolean;
}

const printMessage = function* (message: Message, state: PrintState): Generator<string> {
  if (message.code === EC.TLC_PROGRESS_STATS) {state.progress = message;}
  else if (message.body.length) {yield render(message);}
  if (message.level === LEVEL.WARNING && !state.warned) {
    yield WARNING_HINT;
    state.warned = true;
  }
};

const printPart = function* (part: Part, state: PrintState): Generator<string> {
  const { progress } = state;
  if (!matchesUndefined(progress) && progress.body.length && (isString(part) || part.code !== EC.TLC_STATS)) {
    yield render(progress);
  }
  state.progress = undefined;
  if (isString(part)) {
    yield part;
    return;
  }
  if (part.code === EC.TLC_SANY_START || part.code === EC.TLC_SANY_END) {return;}
  yield* printMessage(part, state);
};

const printed = function* (parts: Iterable<Part>): Generator<string> {
  const state: PrintState = { progress: undefined, warned: false };
  // oxlint-disable-next-line rules/no-for-loops -- Emit the consumed part before pulling the next one from the native TLC stream.
  for (const part of parts) {yield* printPart(part, state);}
  const { progress } = state;
  if (!matchesUndefined(progress) && progress.body.length) {yield render(progress);}
};

export const plainText = function* (parts: Iterable<Part>): Generator<string> {
  const buffer = { chunk: "" };
  // oxlint-disable-next-line rules/no-for-loops -- Yield complete text chunks to the writer without reading the remaining TLC stream.
  for (const line of printed(parts)) {
    buffer.chunk += `${line}\n`;
    if (buffer.chunk.length >= PART) {
      yield buffer.chunk;
      buffer.chunk = "";
    }
  }
  if (buffer.chunk) {yield buffer.chunk;}
};
