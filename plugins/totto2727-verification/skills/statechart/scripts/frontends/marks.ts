import { EC, hasObjectType, isString, matchesUndefined, memo, visitItems } from '#statechart/ir.ts';
import type { Mark, Part, TraceState, Value } from '#statechart/ir.ts';
import { actionOf, messageState } from "./messages.ts";
import { BRACKET, isSpace, parseValue, tokenEnd, unreadable } from "./value.ts";

const TUPLE_OPEN = "<<";
const TUPLE_CLOSE = ">>";
const FIRST_COLUMN = 0;
const NEXT_COLUMN = 1;
const NOT_FOUND = -1;
const TUPLE_COMMAS = 2;
const OUTSIDE_TUPLE = 0;
const MARK_DEPTH = 1;
const VALUE_DEPTH = 2;
const COMMA_CODE_UNIT = 44;
const MAX_REPORTED_TEXT = 2000;

interface MarkScan {
  chunk: string;
  depth: number;
  inner: number[];
  top: number[];
}

interface LineCursor {
  base: number;
  lastEnd: number;
  offset: number;
}

const markBounds = ({ chunk, top }: MarkScan): { close: number; end: number; open: number; valuesEnd: number } | undefined => {
  if (top.length !== TUPLE_COMMAS) {return undefined;}
  const [tagEnd, valuesEnd] = top;
  const open = chunk.indexOf(TUPLE_OPEN, tagEnd);
  const close = chunk.lastIndexOf(TUPLE_CLOSE, valuesEnd);
  const end = chunk.trimEnd().length - TUPLE_CLOSE.length;
  if (
    open === NOT_FOUND ||
    chunk.slice(tagEnd + NEXT_COLUMN, open).trim() ||
    chunk.slice(close + TUPLE_CLOSE.length, valuesEnd).trim() ||
    !chunk.startsWith(TUPLE_CLOSE, end)
  ) {
    return undefined;
  }
  return { close, end, open, valuesEnd };
};

const markTexts = (scan: MarkScan): { rules: string; values: string[] } | undefined => {
  const bounds = markBounds(scan);
  if (matchesUndefined(bounds)) {return undefined;}
  const { close, end, open, valuesEnd } = bounds;
  const { chunk, inner } = scan;
  const cuts = [open + NEXT_COLUMN, ...inner.filter((column) => column > open && column < close), close];
  const values = cuts.slice(NEXT_COLUMN).map((column, index) => chunk.slice(cuts[index] + NEXT_COLUMN, column));
  return { rules: chunk.slice(valuesEnd + NEXT_COLUMN, end), values };
};

const ruleNames = (currentValue: Value): string[] | undefined => {
  if (!hasObjectType(currentValue) || currentValue.kind !== "set") {return undefined;}
  const names = [...currentValue.members];
  return names.every((name) => isString(name)) ? names : undefined;
};

const markError = (message: string, chunk: string): Error => (
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone CLI reports malformed TLC output as a native Error across Node, Bun, and Deno.
  new Error(`${message}\n${chunk.slice(FIRST_COLUMN, MAX_REPORTED_TEXT)}`)
);

const markFrom = (scan: MarkScan, read: (source: string) => Value): Mark => {
  const texts = markTexts(scan);
  const values = texts?.values.map((source) => read(source)) ?? [];
  const broken = texts && ruleNames(read(texts.rules));
  if (!broken) {
    throw markError("TLC printed a mark that the command cannot read:", scan.chunk);
  }
  // oxlint-disable-next-line eslint/sort-keys -- Keep the field order of the decoded TLC mark.
  return { values, broken };
};

const recordToken = (scan: MarkScan, codeUnit: number, offset: number): void => {
  if (codeUnit === COMMA_CODE_UNIT && scan.depth === MARK_DEPTH) {scan.top.push(offset);}
  else if (codeUnit === COMMA_CODE_UNIT && scan.depth === VALUE_DEPTH) {scan.inner.push(offset);}
  scan.depth += BRACKET[codeUnit];
};

const scanToken = (line: string, cursor: LineCursor, scan: MarkScan): void => {
  // oxlint-disable-next-line unicorn/prefer-code-point -- The lexer and stored offsets use UTF-16 code units, and the bracket table is indexed by code unit.
  const codeUnit = line.charCodeAt(cursor.offset);
  if (isSpace(codeUnit)) {
    cursor.offset += NEXT_COLUMN;
    return;
  }
  const end = tokenEnd(line, cursor.offset);
  if (end === NOT_FOUND) {throw unreadable(`${line}\n`, cursor.lastEnd);}
  recordToken(scan, codeUnit, cursor.base + cursor.offset);
  cursor.offset = end;
  cursor.lastEnd = end;
};

const resetTokens = (scan: MarkScan): void => {
  scan.depth = OUTSIDE_TUPLE;
  scan.top = [];
  scan.inner = [];
};

const scanLine = (line: string, scan: MarkScan): void => {
  const cursor = { base: scan.chunk.length, lastEnd: FIRST_COLUMN, offset: FIRST_COLUMN };
  scan.chunk += `${line}\n`;
  while (cursor.offset < line.length) {scanToken(line, cursor, scan);}
};

const scanPart = (part: Part, prefix: string, scan: MarkScan): boolean => {
  if (!isString(part)) {return false;}
  if (!scan.chunk) {
    if (!part.startsWith(TUPLE_OPEN) || !part.slice(TUPLE_OPEN.length).trimStart().startsWith(prefix)) {return false;}
    resetTokens(scan);
  }
  scanLine(part, scan);
  return !(scan.depth > OUTSIDE_TUPLE);
};

export const readMarks = function* (messages: Iterable<Part>, tag: string): Generator<Mark> {
  const read = memo(parseValue);
  const prefix = `"${tag}",`;
  const scan: MarkScan = { chunk: "", depth: OUTSIDE_TUPLE, inner: [], top: [] };
  // oxlint-disable-next-line rules/no-for-loops -- Yield complete marks without consuming the next part of TLC's output.
  for (const part of messages) {
    if (scanPart(part, prefix, scan)) {
      const mark = markFrom(scan, read);
      scan.chunk = "";
      yield mark;
    }
  }
  if (scan.chunk) {
    throw markError(
      "TLC's output ends inside a marked state, so the command cannot tell which rules it breaks:",
      scan.chunk,
    );
  }
};

export const readCounterexample = function readCounterexample(messages: Iterable<Part>): TraceState[] {
  const trace: TraceState[] = [];
  visitItems(messages, (message) => {
    if (isString(message)) {return;}
    const action = message.code === EC.TLC_STATE_PRINT2 ? actionOf(message) : undefined;
    if (!matchesUndefined(action)) {trace.push({ action, vars: messageState(message) });}
    else if (
      message.code === EC.TLC_INVARIANT_VIOLATED_INITIAL ||
      message.code === EC.TLC_PROPERTY_VIOLATED_INITIAL
    )
      {trace.push({ action: "", vars: messageState(message) });}
  });
  return trace;
};
