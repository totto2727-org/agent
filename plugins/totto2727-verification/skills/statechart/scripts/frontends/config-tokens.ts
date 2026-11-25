import { matchesUndefined } from "#statechart/ir.ts";

const WORD = /\w+/uy;
const FIRST_CODE_UNIT = 0;
const MATCHED_TEXT = 0;
const CODE_UNIT_WIDTH = 1;
const PAIR_WIDTH = 2;
const FIRST_LINE = 1;
const LINE_STEP = 1;
const NO_COMMENT_DEPTH = 0;
const COMMENT_DEPTH_STEP = 1;
const HEX_RADIX = 16;
const HEX_CODE_POINT_WIDTH = 4;
const NUL_CODE_POINT = 0;
const FIRST_PRINTABLE_ASCII = 0x20;
const ASCII_DELETE = 0x7F;
const FAIRNESS_PREFIX_LENGTH = 3;
const TLC_INTEGER_MAX = 2_147_483_647;

const CONFIG_HOLDS =
  "A config can hold only names, numbers, strings, comments, and the symbols { } ( ) [ ] , = ! <-.";
const shown = (character: string): string => {
  const code = character.codePointAt(FIRST_CODE_UNIT) ?? NUL_CODE_POINT;
  const hex = `U+${code.toString(HEX_RADIX).toUpperCase().padStart(HEX_CODE_POINT_WIDTH, "0")}`;
  if (code < FIRST_PRINTABLE_ASCII || code === ASCII_DELETE) {return hex;}
  return code < ASCII_DELETE ? `"${character}"` : `"${character}" (${hex})`;
};

export interface Token {
  image: string;
  line: number;
}

interface TokenizedConfig {
  end: number;
  tokens: Token[];
}

type ConfigError = (line: number, words: string) => Error;

const NOT_FOUND = -1;
const FORBIDDEN_SYMBOLS = new Set(["[]", "]_", "==", "=<", "!!"]);

class ConfigTokenizer {
  #text: string;
  #cannot: ConfigError;
  #position = FIRST_CODE_UNIT;
  #line = FIRST_LINE;
  #last = FIRST_LINE;
  #tokens: Token[] = [];

  public constructor(text: string, cannot: ConfigError) {
    this.#text = text;
    this.#cannot = cannot;
  }

  public read(): TokenizedConfig {
    if (this.#text.startsWith("\uFEFF")) {
      throw this.#cannot(FIRST_LINE, "The file starts with a byte order mark. Save it as UTF-8 without one.");
    }
    while (this.#position < this.#text.length) {
      this.#token();
    }
    return { end: this.#last, tokens: this.#tokens };
  }

  #skip(end: number): void {
    while (this.#position < end) {
      const character = this.#text[this.#position];
      this.#last = this.#line;
      if (character === "\n" || (character === "\r" && this.#text[this.#position + CODE_UNIT_WIDTH] !== "\n")) {
        this.#line += LINE_STEP;
      }
      this.#position += CODE_UNIT_WIDTH;
    }
  }

  #push(image: string): void {
    this.#tokens.push({ image, line: this.#line });
    this.#skip(this.#position + image.length);
  }

  #lineComment(): void {
    const end = this.#text.slice(this.#position).search(/[\n\r]/u);
    this.#skip(end === NOT_FOUND ? this.#text.length : this.#position + end);
  }

  #blockComment(): void {
    const marks = /\(\*|\*\)/gu;
    const start = this.#line;
    // oxlint-disable-next-line rules/no-let -- Preserve nested comment depth without recursing on the input.
    let depth = NO_COMMENT_DEPTH;
    do {
      marks.lastIndex = this.#position;
      const regexMatch = marks.exec(this.#text);
      if (!regexMatch) {throw this.#cannot(start, "A comment starts here and does not end.");}
      depth += regexMatch[MATCHED_TEXT] === "(*" ? COMMENT_DEPTH_STEP : -COMMENT_DEPTH_STEP;
      this.#skip(regexMatch.index + PAIR_WIDTH);
    } while (depth !== NO_COMMENT_DEPTH);
  }

  #string(): void {
    // oxlint-disable-next-line rules/no-let -- Advance through the native string under its exact escape widths.
    let stringPosition = this.#position + CODE_UNIT_WIDTH;
    while (this.#text[stringPosition] !== '"') {
      const current = this.#text[stringPosition];
      if (matchesUndefined(current)) {throw this.#cannot(this.#line, "A string starts here and does not end.");}
      this.#checkStringCharacter(current, this.#text[stringPosition + CODE_UNIT_WIDTH]);
      stringPosition += current === "\\" ? PAIR_WIDTH : CODE_UNIT_WIDTH;
    }
    this.#push(this.#text.slice(this.#position, stringPosition + CODE_UNIT_WIDTH));
  }

  #checkStringCharacter(current: string, following: string | undefined): void {
    if (current === "\n" || current === "\r")
      {throw this.#cannot(
        this.#line,
        String.raw`A string starts here and does not end on its line. Write \n for a line break in a string.`,
      );}
    if (current === "\0") {throw this.#cannot(this.#line, "A string has the character U+0000.");}
    if (current === "\\" && !matchesUndefined(following) && !String.raw`"\ntrf`.includes(following))
      {throw this.#cannot(
        this.#line,
        `A string has a backslash before ${shown(following)}. A string can use only the escapes \\" \\\\ \\n \\t \\r \\f.`,
      );}
  }

  #word(character: string): void {
    WORD.lastIndex = this.#position;
    const word = WORD.exec(this.#text)?.[MATCHED_TEXT] ?? character;
    // oxlint-disable-next-line rules/prefer-schema-format-validation -- TLC recognizes these fairness prefixes before accepting a standalone identifier.
    if (/^[WS]F_/u.test(word))
      {throw this.#cannot(
        this.#line,
        `TLC reads ${word.slice(FIRST_CODE_UNIT, FAIRNESS_PREFIX_LENGTH)} at the start of a word as a TLA+ keyword, so it cannot read ${word} as a name.`,
      );}
    if (!/[A-Za-z]/u.test(word) && word !== "_") {
      // oxlint-disable-next-line rules/prefer-schema-format-validation -- Preserve TLC's mixed digit/underscore diagnostic at this lexical decision.
      if (/\D/u.test(word))
        {throw this.#cannot(
          this.#line,
          `TLC splits ${word} into ${word.match(/\d+|_/gu)?.join(" ")}, because a name needs a letter.`,
        );}
      if (Number(word) > TLC_INTEGER_MAX)
        {throw this.#cannot(this.#line, `TLC cannot read a number above ${TLC_INTEGER_MAX}, such as ${word}.`);}
    }
    this.#push(word);
  }

  #symbol(character: string, pair: string): void {
    if (pair === "<-") {
      this.#push(pair);
    } else if (FORBIDDEN_SYMBOLS.has(pair)) {
      throw this.#cannot(this.#line, `TLC reads ${pair} as one TLA+ symbol, and a config cannot hold it.`);
    } else if ("{}()[],=!".includes(character)) {
      this.#push(character);
    } else {
      const current = String.fromCodePoint(this.#text.codePointAt(this.#position) ?? NUL_CODE_POINT);
      const where = current > String.fromCodePoint(ASCII_DELETE) ? " outside a string" : "";
      throw this.#cannot(this.#line, `It cannot read the character ${shown(current)}${where}. ${CONFIG_HOLDS}`);
    }
  }

  #token(): void {
    const character = this.#text[this.#position];
    const pair = this.#text.slice(this.#position, this.#position + PAIR_WIDTH);
    if (character === " " || character === "\t" || character === "\n" || character === "\r") {
      this.#skip(this.#position + CODE_UNIT_WIDTH);
    } else if (pair === String.raw`\*`) {
      this.#lineComment();
    } else if (pair === "(*") {
      this.#blockComment();
    } else if (character === '"') {
      this.#string();
    } else if (/\w/u.test(character)) {
      this.#word(character);
    } else {
      this.#symbol(character, pair);
    }
  }
}

export const tokenizeConfig = (text: string, cannot: ConfigError): TokenizedConfig => new ConfigTokenizer(text, cannot).read();
