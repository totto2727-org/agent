import type { Value } from "#statechart/ir.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";

const FIRST_OFFSET = 0;
const CODE_UNIT_WIDTH = 1;
const ESCAPE_WIDTH = 2;
const OPEN_BRACKET = 1;
const CLOSE_BRACKET = -1;
const NO_TOKEN = -1;
const LAST_ASCII = 127;
const FIRST_ASCII_SPACE = 9;
const LAST_ASCII_SPACE = 13;
const SPACE = 32;
const LF = 10;
const CR = 13;
const LINE_SEPARATOR = 0x20_28;
const PARAGRAPH_SEPARATOR = 0x20_29;
const QUOTE = 34;
const BACKSLASH = 92;
const COMMA = 44;
const MINUS = 45;
const FIRST_DIGIT = 48;
const LAST_DIGIT = 57;
const FIRST_UPPER = 65;
const LAST_UPPER = 90;
const FIRST_LOWER = 97;
const LAST_LOWER = 122;
const UNDERSCORE = 95;
const ERROR_PREVIEW_WIDTH = 20;

const codeUnit = (text: string, offset: number): number =>
  // oxlint-disable-next-line unicorn/prefer-code-point -- Token offsets index UTF-16 code units, including unmatched surrogate code units in TLC strings.
  text.charCodeAt(offset);

export const BRACKET = new Int8Array(LAST_ASCII + CODE_UNIT_WIDTH);
visitItems("<{[(", (bracket) => {BRACKET[codeUnit(bracket, FIRST_OFFSET)] = OPEN_BRACKET;});
visitItems(">}])", (bracket) => {BRACKET[codeUnit(bracket, FIRST_OFFSET)] = CLOSE_BRACKET;});
const PUNCT = new Map(["<<", ">>", "|->", ":>", "@@", ".."].map((token) => [codeUnit(token, FIRST_OFFSET), token]));
const NON_ASCII_SPACE = /\s/u;
export const isSpace = (code: number): boolean =>
  code === SPACE || (code >= FIRST_ASCII_SPACE && code <= LAST_ASCII_SPACE) ||
  // oxlint-disable-next-line unicorn/prefer-code-point -- Preserve the scanner's code-unit conversion for every numeric input.
  (code > LAST_ASCII && NON_ASCII_SPACE.test(String.fromCharCode(code)));
const isDigit = (code: number): boolean => code >= FIRST_DIGIT && code <= LAST_DIGIT;
const isWord = (code: number): boolean =>
  isDigit(code) || (code >= FIRST_UPPER && code <= LAST_UPPER) || (code >= FIRST_LOWER && code <= LAST_LOWER) || code === UNDERSCORE;
const isLineEnd = (code: number): boolean =>
  code === LF || code === CR || code === LINE_SEPARATOR || code === PARAGRAPH_SEPARATOR;

export const tokenEnd = (text: string, start: number): number => {
  const leading = codeUnit(text, start);
  const contentStart = start + CODE_UNIT_WIDTH;
  if (leading === QUOTE) {
    for (let offset = contentStart; offset < text.length; offset += CODE_UNIT_WIDTH) {
      const current = codeUnit(text, offset);
      if (current === QUOTE) {return offset + CODE_UNIT_WIDTH;}
      if (current === BACKSLASH) {
        offset += CODE_UNIT_WIDTH;
        if (offset >= text.length || isLineEnd(codeUnit(text, offset))) {return NO_TOKEN;}
      }
    }
    return NO_TOKEN;
  }
  const punct = PUNCT.get(leading);
  if (punct) {return text.startsWith(punct, start) ? start + punct.length : NO_TOKEN;}
  if (BRACKET[leading] || leading === COMMA) {return contentStart;}
  let offset = contentStart;
  if (leading === MINUS || isDigit(leading)) {
    while (isDigit(codeUnit(text, offset))) {offset += CODE_UNIT_WIDTH;}
    return leading === MINUS && offset === contentStart ? NO_TOKEN : offset;
  }
  if (!isWord(leading)) {return NO_TOKEN;}
  while (isWord(codeUnit(text, offset))) {offset += CODE_UNIT_WIDTH;}
  return offset;
};

export const unreadable = (text: string, position: number): Error =>
  new Error(`cannot read TLA+ value at "${text.slice(position, position + ERROR_PREVIEW_WIDTH)}"`);

const FIRST_TUPLE_KEY = 1;
const INT = /^-?\d+$/u;
const NAME = /^\w*[A-Za-z]\w*$/u;
const UNESCAPED: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  n: "\n",
  t: "\t",
  r: "\r",
  f: "\f",
};

const models = new Map<string, Value>();
const model = (name: string) => {
  const cached = models.get(name);
  if (!matchesUndefined(cached)) {return cached;}
  const value: Value = { kind: "model", name };
  models.set(name, value);
  return value;
};

export const parseValue = function parseValue(text: string): Value {
  const tokens: string[] = [];
  const starts: number[] = [];
  for (let offset = FIRST_OFFSET; ;) {
    while (offset < text.length && isSpace(codeUnit(text, offset))) {offset += CODE_UNIT_WIDTH;}
    if (offset === text.length) {break;}
    const end = tokenEnd(text, offset);
    if (end === NO_TOKEN) {throw unreadable(text, offset);}
    tokens.push(text.slice(offset, end));
    starts.push(offset);
    offset = end;
  }
  let tokenIndex = FIRST_OFFSET;
  const fail = (): never => {
    throw unreadable(text, tokenIndex < starts.length ? starts[Math.max(tokenIndex - CODE_UNIT_WIDTH, FIRST_OFFSET)] : text.length);
  };
  const next = (): string => {
    if (tokenIndex >= tokens.length) {return fail();}
    const token = tokens[tokenIndex];
    tokenIndex += CODE_UNIT_WIDTH;
    return token;
  };
  const eat = (expected: string): void => {
    if (next() !== expected) {fail();}
  };
  const items = <T>(close: string, item: () => T) => {
    const out: T[] = [];
    if (tokens[tokenIndex] === close) {
      tokenIndex += CODE_UNIT_WIDTH;
      return out;
    }
    for (;;) {
      out.push(item());
      const separator = next();
      if (separator === close) {return out;}
      if (separator !== ",") {fail();}
    }
  };
  const string = (token: string): string => {
    let decoded = "";
    for (let start = CODE_UNIT_WIDTH; ;) {
      const escape = token.indexOf("\\", start);
      if (escape === NO_TOKEN || escape >= token.length - CODE_UNIT_WIDTH) {return decoded + token.slice(start, -CODE_UNIT_WIDTH);}
      const character = UNESCAPED[token[escape + CODE_UNIT_WIDTH]];
      if (matchesUndefined(character)) {fail();}
      decoded += token.slice(start, escape) + character;
      start = escape + ESCAPE_WIDTH;
    }
  };
  const value = (): Value => {
    const token = next();
    switch (token) {
      case "TRUE": {
        return true;
      }
      case "FALSE": {
        return false;
      }
      case "{": {
        return { kind: "set", members: items("}", value) };
      }
      case "<<": {
        const values = items(">>", value);
        const keys = values.map((_value, index) => index + FIRST_TUPLE_KEY);
        return { kind: "function", printedAs: "tuple", keys, values };
      }
      case "[": {
        const keys: Value[] = [];
        const values: Value[] = [];
        items("]", () => {
          const name = next();
          if (!NAME.test(name)) {fail();}
          eat("|->");
          keys.push(name);
          values.push(value());
        });
        return { kind: "function", printedAs: "record", keys, values };
      }
      case "(": {
        const keys: Value[] = [];
        const values: Value[] = [];
        do {
          keys.push(value());
          eat(":>");
          values.push(value());
        } while (next() === "@@");
        if (tokens[tokenIndex - CODE_UNIT_WIDTH] !== ")") {fail();}
        return { kind: "function", printedAs: "pairs", keys, values };
      }
    }
    if (codeUnit(token, FIRST_OFFSET) === QUOTE) {return string(token);}
    if (INT.test(token)) {
      if (tokens[tokenIndex] !== "..") {return Number(token);}
      tokenIndex += CODE_UNIT_WIDTH;
      const hi = next();
      if (!INT.test(hi)) {fail();}
      return { kind: "interval", lo: Number(token), hi: Number(hi) };
    }
    if (NAME.test(token)) {return model(token);}
    return fail();
  };
  const out = value();
  if (tokenIndex < tokens.length) {
    tokenIndex += CODE_UNIT_WIDTH;
    fail();
  }
  return out;
};
