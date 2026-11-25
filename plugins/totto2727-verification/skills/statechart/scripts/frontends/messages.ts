import type { Message, Part, Vars } from "#statechart/ir.ts";
import { linesOf, parseState } from "./dot.ts";
import { isString, matchesNull, matchesUndefined } from "#statechart/ir.ts";

const START = /@!@!@STARTMSG (?<code>\d+):(?<level>\d+) @!@!@$/u;
const END = /^@!@!@ENDMSG \d+ @!@!@$/u;

const FIRST_FRAME = 0;
const ROOT_FRAME_COUNT = 1;
const LAST_FRAME = -1;
const EMPTY_LENGTH = 0;
const START_LINE = 0;
const FIRST_STATE_LINE = 1;
const NO_BLANK_LINE = -1;

const isCutMarker = (lastLine: string): boolean => lastLine.startsWith("@!@!@");

const cutMessage = (open: Message[]): Message | undefined => {
  while (open.length > ROOT_FRAME_COUNT && open.at(LAST_FRAME)?.body.length === EMPTY_LENGTH) {
    open.pop();
    open.at(LAST_FRAME)?.body.pop();
  }
  const root = open[FIRST_FRAME];
  return !matchesUndefined(root) && root.body.length > EMPTY_LENGTH ? root : undefined;
};

const openMessage = (start: RegExpExecArray, line: string, open: Message[]): void => {
  const { groups, index } = start;
  // oxlint-disable-next-line eslint/sort-keys -- Keep the TLC message's established protocol key order.
  const message: Message = { code: Number(groups?.code), level: Number(groups?.level), body: [] };
  if (index > START_LINE) {message.beforeMarker = line.slice(START_LINE, index);}
  open.at(LAST_FRAME)?.body.push(message);
  open.push(message);
};

const closeMessage = (open: Message[]): Message | undefined => {
  const done = open.pop();
  return open.length === EMPTY_LENGTH ? done : undefined;
};

const readLine = (line: string, open: Message[]): Part | undefined => {
  const start = START.exec(line);
  if (!matchesNull(start)) {
    openMessage(start, line, open);
    return undefined;
  }
  if (END.test(line)) {return closeMessage(open);}
  const frame = open.at(LAST_FRAME);
  frame?.body.push(line);
  return matchesUndefined(frame) ? line : undefined;
};

const readParts = function* (lines: Iterator<string>, open: Message[]): Generator<Part> {
  // oxlint-disable-next-line rules/no-let -- Keep one native lookahead result so the final incomplete marker is recognized without buffering TLC output.
  let next = lines.next();
  while (next.done !== true) {
    const line = next.value;
    next = lines.next();
    if (next.done === true && (!line || isCutMarker(line))) {break;}
    const part = readLine(line, open);
    if (!matchesUndefined(part)) {yield part;}
  }
};

export const readMessages = function* (tlcOut: string | Iterable<string>): Generator<Part> {
  const lines = linesOf(tlcOut)[Symbol.iterator]();
  const open: Message[] = [];
  try {
    yield* readParts(lines, open);
  } finally {
    lines.return?.();
  }
  const cut = cutMessage(open);
  if (cut) {yield cut;}
};

export const textOf = ({ body }: Message): string =>
  body.filter((part) => isString(part)).join("\n");

export const actionOf = (message: Message): string | undefined =>
  /^\d+: (?:Back to state: )?<(?<action>[^\s>]+)/u.exec(textOf(message))?.groups?.action;

export const messageState = (message: Message): Vars => {
  const lines = textOf(message).split("\n");
  const blank = lines.findIndex((line, index) => index >= FIRST_STATE_LINE && !line.trim());
  const body = lines.slice(FIRST_STATE_LINE, blank === NO_BLANK_LINE ? undefined : blank);
  return parseState(body.join("\n"));
};
