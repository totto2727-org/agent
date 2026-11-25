import type { Message, Part, Vars } from "#statechart/ir.ts";
import { linesOf, parseState } from "./dot.ts";
import { isString, matchesNull, matchesUndefined } from "#statechart/ir.ts";

const START = /@!@!@STARTMSG (?<code>\d+):(?<level>\d+) @!@!@$/u;
const END = /^@!@!@ENDMSG \d+ @!@!@$/u;

const FIRST_FRAME = 0;
const FRAME_STEP = 1;
const LAST_FRAME = -1;
const EMPTY_LENGTH = 0;
const START_LINE = 0;
const FIRST_STATE_LINE = 1;
const NO_BLANK_LINE = -1;

const isCutMarker = (lastLine: string): boolean => lastLine.startsWith("@!@!@");

const cutMessage = (open: Message[]): Message | undefined => {
  let frameIndex = open.length - FRAME_STEP;
  while (frameIndex > FIRST_FRAME && open[frameIndex].body.length === EMPTY_LENGTH) {
    open[frameIndex - FRAME_STEP].body.pop();
    frameIndex -= FRAME_STEP;
  }
  const root = open[FIRST_FRAME];
  return !matchesUndefined(root) && root.body.length > EMPTY_LENGTH ? root : undefined;
};

export const readMessages = function* readMessages(tlcOut: string | Iterable<string>): Generator<Part> {
  const lines = linesOf(tlcOut)[Symbol.iterator]();
  const open: Message[] = [];
  try {
    let next = lines.next();
    while (!next.done) {
      const line = next.value;
      next = lines.next();
      if (next.done && (!line || isCutMarker(line))) {break;}
      const start = START.exec(line);
      if (!matchesNull(start)) {
        const { groups, index } = start;
        const message: Message = { code: Number(groups?.code), level: Number(groups?.level), body: [] };
        if (index > START_LINE) {message.beforeMarker = line.slice(START_LINE, index);}
        open.at(LAST_FRAME)?.body.push(message);
        open.push(message);
      } else if (END.test(line)) {
        const done = open.pop();
        if (!matchesUndefined(done) && open.length === EMPTY_LENGTH) {yield done;}
      } else if (open.length > EMPTY_LENGTH) {open.at(LAST_FRAME)?.body.push(line);}
      else {yield line;}
    }
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
