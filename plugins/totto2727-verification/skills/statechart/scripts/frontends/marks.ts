import { EC, isString, matchesUndefined, memo, visitItems } from '../ir.ts';
import type { Mark, Part, TraceState, Value } from '../ir.ts';
import { actionOf, messageState } from "./messages.ts";
import { BRACKET, isSpace, parseValue, tokenEnd, unreadable } from "./value.ts";

const markTexts = (chunk: string, top: number[], inner: number[]) => {
  if (top.length !== 2) {return undefined;}
  const [a, b] = top;
  const open = chunk.indexOf("<<", a);
  const close = chunk.lastIndexOf(">>", b);
  const end = chunk.trimEnd().length - 2;
  if (open === -1 || chunk.slice(a + 1, open).trim() || chunk.slice(close + 2, b).trim())
    {return undefined;}
  if (!chunk.startsWith(">>", end)) {return undefined;}
  const cuts = [open + 1];
  visitItems(inner, (k) => {if (k > open && k < close) {cuts.push(k);}});
  cuts.push(close);
  const texts: string[] = [];
  for (let k = 1; k < cuts.length; k++) {texts.push(chunk.slice(cuts[k - 1] + 1, cuts[k]));}
  return { values: texts, rules: chunk.slice(b + 1, end) };
};

const ruleNames = (currentValue: Value): string[] | undefined => {
  if (typeof currentValue !== "object" || currentValue.kind !== "set") {return undefined;}
  const names: string[] = [];
  for (const valueItem of currentValue.members) {
    if (!isString(valueItem)) {return undefined;}
    names.push(valueItem);
  }
  return names;
};

export function* readMarks(messages: Iterable<Part>, tag: string): Generator<Mark> {
  const read = memo(parseValue);
  const start = `"${tag}",`;
  let chunk = "";
  let depth = 0;
  let top: number[] = [];
  let inner: number[] = [];
  for (const line of messages) {
    if (!isString(line)) {continue;}
    if (!chunk) {
      if (!line.startsWith("<<") || !line.slice(2).trimStart().startsWith(start)) {continue;}
      depth = 0;
      top = [];
      inner = [];
    }
    const base = chunk.length;
    chunk += `${line  }\n`;
    let i = 0;
    let last = 0;
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (isSpace(c)) {
        i++;
        continue;
      }
      const j = tokenEnd(line, i);
      if (j === -1) {throw unreadable(`${line  }\n`, last);}
      if (c === 44 && depth === 1) {top.push(base + i);}
      else if (c === 44 && depth === 2) {inner.push(base + i);}
      depth += BRACKET[c];
      i = last = j;
    }
    if (depth > 0) {continue;}
    const texts = markTexts(chunk, top, inner);
    const values: Value[] = [];
    if (texts) {visitItems(texts.values, (value) => {values.push(read(value));});}
    const broken = texts && ruleNames(read(texts.rules));
    if (!broken)
      {throw new Error(`TLC printed a mark that the command cannot read:\n${chunk.slice(0, 2000)}`);}
    chunk = "";
    yield { values, broken };
  }
  if (chunk)
    {throw new Error(
      `TLC's output ends inside a marked state, so the command cannot tell which rules it breaks:\n${chunk.slice(0, 2000)}`,
    );}
}

export function readCounterexample(messages: Iterable<Part>) {
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
}
