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

const quotedEnd = (text: string, start: number): number => {
  // oxlint-disable-next-line rules/no-let -- The native string scanner advances by one code unit or a full escape.
  let offset = start;
  while (offset < text.length) {
    const current = codeUnit(text, offset);
    if (current === QUOTE) {return offset + CODE_UNIT_WIDTH;}
    if (current === BACKSLASH && (offset + CODE_UNIT_WIDTH >= text.length || isLineEnd(codeUnit(text, offset + CODE_UNIT_WIDTH)))) {
      return NO_TOKEN;
    }
    offset += current === BACKSLASH ? ESCAPE_WIDTH : CODE_UNIT_WIDTH;
  }
  return NO_TOKEN;
};

const scanWhile = (text: string, start: number, matches: (code: number) => boolean): number => {
  // oxlint-disable-next-line rules/no-let -- Count native UTF-16 offsets directly without allocating a copy of the token.
  let offset = start;
  while (matches(codeUnit(text, offset))) {offset += CODE_UNIT_WIDTH;}
  return offset;
};

const numberEnd = (text: string, start: number, leading: number): number => {
  const end = scanWhile(text, start, isDigit);
  return leading === MINUS && end === start ? NO_TOKEN : end;
};

const wordEnd = (text: string, start: number, leading: number): number => {
  if (leading === MINUS || isDigit(leading)) {return numberEnd(text, start, leading);}
  return isWord(leading) ? scanWhile(text, start, isWord) : NO_TOKEN;
};

export const tokenEnd = (text: string, start: number): number => {
  const leading = codeUnit(text, start);
  const contentStart = start + CODE_UNIT_WIDTH;
  if (leading === QUOTE) {return quotedEnd(text, contentStart);}
  const punct = PUNCT.get(leading);
  if (!matchesUndefined(punct)) {return text.startsWith(punct, start) ? start + punct.length : NO_TOKEN;}
  if (BRACKET[leading] || leading === COMMA) {return contentStart;}
  return wordEnd(text, contentStart, leading);
};

export const unreadable = (text: string, position: number): Error =>
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone parser reports native errors without adding an Effect runtime dependency.
  new Error(`cannot read TLA+ value at "${text.slice(position, position + ERROR_PREVIEW_WIDTH)}"`);

const FIRST_TUPLE_KEY = 1;
const INT = /^-?\d+$/u;
const NAME = /^\w*[A-Za-z]\w*$/u;
const UNESCAPED: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

const models = new Map<string, Value>();
const model = (name: string): Value => {
  const cached = models.get(name);
  if (!matchesUndefined(cached)) {return cached;}
  const value: Value = { kind: "model", name };
  models.set(name, value);
  return value;
};

interface ValueTokens {
  starts: number[];
  tokens: string[];
}

const tokenizeValue = (text: string): ValueTokens => {
  const result: ValueTokens = { starts: [], tokens: [] };
  // oxlint-disable-next-line rules/no-let -- Each string or punctuation token ends at a computed native offset.
  let offset = scanWhile(text, FIRST_OFFSET, isSpace);
  while (offset < text.length) {
    const end = tokenEnd(text, offset);
    if (end === NO_TOKEN) {throw unreadable(text, offset);}
    result.tokens.push(text.slice(offset, end));
    result.starts.push(offset);
    offset = scanWhile(text, end, isSpace);
  }
  return result;
};

class ValueReader {
  #text: string;
  #tokens: string[];
  #starts: number[];
  #position = FIRST_OFFSET;

  public constructor(text: string) {
    this.#text = text;
    const { starts, tokens } = tokenizeValue(text);
    this.#starts = starts;
    this.#tokens = tokens;
  }

  public read(): Value {
    const value = this.#value();
    if (this.#position < this.#tokens.length) {
      this.#position += CODE_UNIT_WIDTH;
      this.#fail();
    }
    return value;
  }

  #fail(): never {
    const position = this.#position < this.#tokens.length
      ? this.#starts[Math.max(this.#position - CODE_UNIT_WIDTH, FIRST_OFFSET)]
      : this.#text.length;
    throw unreadable(this.#text, position);
  }

  #readToken(): string {
    const token = this.#tokens[this.#position];
    if (matchesUndefined(token)) {return this.#fail();}
    this.#position += CODE_UNIT_WIDTH;
    return token;
  }

  #eat(expected: string): void {
    if (this.#readToken() !== expected) {this.#fail();}
  }

  #hasMore(close: string): boolean {
    const separator = this.#readToken();
    if (separator === close) {return false;}
    if (separator !== ",") {this.#fail();}
    return true;
  }

  #items<T>(close: string, item: () => T): T[] {
    const out: T[] = [];
    if (this.#tokens[this.#position] === close) {
      this.#position += CODE_UNIT_WIDTH;
      return out;
    }
    do {out.push(item());} while (this.#hasMore(close));
    return out;
  }

  #escaped(code: string): string {
    const character = UNESCAPED[code];
    if (matchesUndefined(character)) {this.#fail();}
    return character;
  }

  #string(token: string): string {
    const segments: string[] = [];
    const close = token.length - CODE_UNIT_WIDTH;
    // oxlint-disable-next-line rules/no-let -- Continue at each literal escape's next UTF-16 offset.
    let start = CODE_UNIT_WIDTH;
    while (start < close) {
      const escape = token.indexOf("\\", start);
      if (escape === NO_TOKEN || escape >= close) {break;}
      segments.push(token.slice(start, escape), this.#escaped(token[escape + CODE_UNIT_WIDTH]));
      start = escape + ESCAPE_WIDTH;
    }
    return segments.join("") + token.slice(start, close);
  }

  #tuple(): Value {
    const values = this.#items(">>", () => this.#value());
    const keys = values.map((_value, index) => index + FIRST_TUPLE_KEY);
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized tuple field order in Statechart's IR.
    return { kind: "function", printedAs: "tuple", keys, values };
  }

  #record(): Value {
    const keys: Value[] = [];
    const values: Value[] = [];
    this.#items("]", () => {
      const name = this.#readToken();
      if (!NAME.test(name)) {this.#fail();}
      this.#eat("|->");
      keys.push(name);
      values.push(this.#value());
    });
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized record field order in Statechart's IR.
    return { kind: "function", printedAs: "record", keys, values };
  }

  #pairs(): Value {
    const keys: Value[] = [];
    const values: Value[] = [];
    do {
      keys.push(this.#value());
      this.#eat(":>");
      values.push(this.#value());
    } while (this.#readToken() === "@@");
    if (this.#tokens[this.#position - CODE_UNIT_WIDTH] !== ")") {this.#fail();}
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized function field order in Statechart's IR.
    return { kind: "function", printedAs: "pairs", keys, values };
  }

  #number(token: string): Value {
    if (this.#tokens[this.#position] !== "..") {return Number(token);}
    this.#position += CODE_UNIT_WIDTH;
    const hi = this.#readToken();
    if (!INT.test(hi)) {this.#fail();}
    // oxlint-disable-next-line eslint/sort-keys -- Retain lower-bound-first field order in the serialized interval.
    return { kind: "interval", lo: Number(token), hi: Number(hi) };
  }

  #atom(token: string): Value {
    if (codeUnit(token, FIRST_OFFSET) === QUOTE) {return this.#string(token);}
    if (INT.test(token)) {return this.#number(token);}
    if (NAME.test(token)) {return model(token);}
    return this.#fail();
  }

  #value(): Value {
    const token = this.#readToken();
    switch (token) {
      case "TRUE": {return true;}
      case "FALSE": {return false;}
      case "{": {return { kind: "set", members: this.#items("}", () => this.#value()) };}
      case "<<": {return this.#tuple();}
      case "[": {return this.#record();}
      case "(": {return this.#pairs();}
      default: {return this.#atom(token);}
    }
  }
}

export const parseValue = function parseValue(text: string): Value {
  return new ValueReader(text).read();
};
