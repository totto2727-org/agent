import { CHECK_DEADLOCK, matchesUndefined, visitItems } from '#statechart/ir.ts';
import type { Config } from '#statechart/ir.ts';

type ListField = "invariants" | "properties" | "constraints" | "actionConstraints";
interface Section {
  key: string;
  plural?: string;
  field?:
    | ListField
    | "checkDeadlock"
    | "init"
    | "next"
    | "spec"
    | "view"
    | "symmetry"
    | "type"
    | "typeConstraint";
  undefinedNoun?: string;
}
const isListField = (field: Section["field"]): field is ListField =>
  field === "invariants" ||
  field === "properties" ||
  field === "constraints" ||
  field === "actionConstraints";

const SECTIONS = new Map<string, Section>();
visitItems([
  { key: "CONSTANT", plural: "CONSTANTS" },
  { key: CHECK_DEADLOCK, field: "checkDeadlock" },
  { key: "INIT", field: "init", undefinedNoun: "initial predicate" },
  { key: "NEXT", field: "next", undefinedNoun: "next state action" },
  { key: "SPECIFICATION", field: "spec", undefinedNoun: "name" },
  { key: "VIEW", field: "view", undefinedNoun: "view function" },
  { key: "SYMMETRY", field: "symmetry", undefinedNoun: "symmetry function" },
  { key: "TYPE", field: "type" },
  { key: "TYPE_CONSTRAINT", field: "typeConstraint" },
  { key: "INVARIANT", plural: "INVARIANTS", field: "invariants", undefinedNoun: "invariant" },
  { key: "PROPERTY", plural: "PROPERTIES", field: "properties", undefinedNoun: "property" },
  { key: "CONSTRAINT", plural: "CONSTRAINTS", field: "constraints", undefinedNoun: "constraint" },
  {
    key: "ACTION_CONSTRAINT",
    plural: "ACTION_CONSTRAINTS",
    field: "actionConstraints",
    undefinedNoun: "action constraint",
  },
] satisfies Section[], (section) => {
  SECTIONS.set(section.key, section);
  if (section.plural) {SECTIONS.set(section.plural, section);}
});
export const NAME = /^\w*[A-Za-z]\w*$/u;
const WORD = /\w+/uy;
const FIRST_CODE_UNIT = 0;
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

interface Token { image: string; line: number }

const tokenizeConfig = function (text: string, cannot: (line: number, words: string) => Error) {
  if (text.startsWith("\uFEFF"))
    {throw cannot(FIRST_LINE, "The file starts with a byte order mark. Save it as UTF-8 without one.");}
  const tokens: Token[] = [];
  let line = FIRST_LINE;
  let last = FIRST_LINE;
  let position = FIRST_CODE_UNIT;
  const skip = (end: number): void => {
    while (position < end) {
      last = line;
      if (text[position] === "\n" || (text[position] === "\r" && text[position + CODE_UNIT_WIDTH] !== "\n")) {line += LINE_STEP;}
      position += CODE_UNIT_WIDTH;
    }
  };
  const push = (image: string): void => {
    tokens.push({ image, line });
    skip(position + image.length);
  };
  while (position < text.length) {
    const character = text[position];
    const two = text.slice(position, position + PAIR_WIDTH);
    const start = line;
    if (character === " " || character === "\t" || character === "\n" || character === "\r") {skip(position + CODE_UNIT_WIDTH);}
    else if (two === String.raw`\*`) {
      const end = text.slice(position).search(/[\n\r]/u);
      skip(end < 0 ? text.length : position + end);
    } else if (two === "(*") {
      const marks = /\(\*|\*\)/gu;
      let depth = NO_COMMENT_DEPTH;
      do {
        marks.lastIndex = position;
        const regexMatch = marks.exec(text);
        if (!regexMatch) {throw cannot(start, "A comment starts here and does not end.");}
        const [marker] = regexMatch;
        depth += marker === "(*" ? COMMENT_DEPTH_STEP : -COMMENT_DEPTH_STEP;
        skip(regexMatch.index + PAIR_WIDTH);
      } while (depth !== NO_COMMENT_DEPTH);
    } else if (character === '"') {
      let stringPosition = position + CODE_UNIT_WIDTH;
      while (text[stringPosition] !== '"') {
        const current = text[stringPosition];
        if (matchesUndefined(current)) {throw cannot(start, "A string starts here and does not end.");}
        if (current === "\n" || current === "\r")
          {throw cannot(
            start,
            String.raw`A string starts here and does not end on its line. Write \n for a line break in a string.`,
          );}
        if (current === "\0") {throw cannot(start, "A string has the character U+0000.");}
        if (current === "\\" && !matchesUndefined(text[stringPosition + CODE_UNIT_WIDTH]) && !String.raw`"\ntrf`.includes(text[stringPosition + CODE_UNIT_WIDTH]))
          {throw cannot(
            start,
            `A string has a backslash before ${shown(text[stringPosition + CODE_UNIT_WIDTH])}. A string can use only the escapes \\" \\\\ \\n \\t \\r \\f.`,
          );}
        stringPosition += current === "\\" ? PAIR_WIDTH : CODE_UNIT_WIDTH;
      }
      push(text.slice(position, stringPosition + CODE_UNIT_WIDTH));
    } else if (/\w/u.test(character)) {
      WORD.lastIndex = position;
      const word = WORD.exec(text)?.[FIRST_CODE_UNIT] ?? character;
      if (/^[WS]F_/u.test(word))
        {throw cannot(
          start,
          `TLC reads ${word.slice(FIRST_CODE_UNIT, FAIRNESS_PREFIX_LENGTH)} at the start of a word as a TLA+ keyword, so it cannot read ${word} as a name.`,
        );}
      if (!/[A-Za-z]/u.test(word) && word !== "_") {
        if (/\D/u.test(word))
          {throw cannot(
            start,
            `TLC splits ${word} into ${word.match(/\d+|_/gu)?.join(" ")}, because a name needs a letter.`,
          );}
        if (Number(word) > TLC_INTEGER_MAX)
          {throw cannot(start, `TLC cannot read a number above ${TLC_INTEGER_MAX}, such as ${word}.`);}
      }
      push(word);
    } else if (two === "<-") {push(two);}
    else if (["[]", "]_", "==", "=<", "!!"].includes(two))
      {throw cannot(start, `TLC reads ${two} as one TLA+ symbol, and a config cannot hold it.`);}
    else if ("{}()[],=!".includes(character)) {push(character);}
    else {
      const current = String.fromCodePoint(text.codePointAt(position) ?? NUL_CODE_POINT);
      const where = current > String.fromCodePoint(ASCII_DELETE) ? " outside a string" : "";
      throw cannot(start, `It cannot read the character ${shown(current)}${where}. ${CONFIG_HOLDS}`);
    }
  }
  return { tokens, end: last };
};

export const readConfig = function readConfig({ file, text }: { file: string; text: string }): Config {
  const refuse = (line: number, words: string) =>
    new Error(`TLC refuses the config ${file} at line ${line}. ${words}`);
  const cannot = (line: number, words: string) =>
    new Error(`The command cannot read the config ${file} at line ${line}. ${words}`);
  const { tokens, end } = tokenizeConfig(text, cannot);
  const eof: Token = { image: "", line: end };
  let tokenOffset = FIRST_CODE_UNIT;
  const readToken = (): Token => {
    const token = tokens[tokenOffset] ?? eof;
    tokenOffset += CODE_UNIT_WIDTH;
    return token;
  };
  let deferred: Error | undefined;
  const defer = (error: Error) => (deferred ??= error);
  const defined = (token: Token, undefinedNoun: string | undefined): void => {
    if (!NAME.test(token.image))
      {defer(
        refuse(
          token.line,
          `The ${undefinedNoun} ${token.image} specified in the configuration file is not defined in the specification.`,
        ),
      );}
  };
  const name = (token: Token, what: string): void => {
    if (SECTIONS.has(token.image))
      {defer(cannot(token.line, `TLC would read the keyword ${token.image} as ${what}.`));}
    else if (!NAME.test(token.image))
      {defer(cannot(token.line, `TLC would read ${token.image} as ${what}, and it is not a name.`));}
  };
  const value = (token: Token): void => {
    if (token === eof) {throw refuse(token.line, "It was expecting a value, but did not find it.");}
    if (token.image === "{") {
      token = readToken();
      if (token.image === "}") {return;}
      value(token);
      while ((token = readToken()).image === ",") {value(readToken());}
      if (token.image !== "}") {throw refuse(token.line, "It was expecting }, but did not find it.");}
    } else if (SECTIONS.has(token.image))
      {defer(cannot(token.line, `TLC would read the keyword ${token.image} as a value.`));}
    else if (!NAME.test(token.image) && !/^(?:\d+|".*")$/u.test(token.image))
      {defer(
        cannot(
          token.line,
          `TLC would read ${token.image} as a value. A value is a name, a number, a string, or a set in braces.`,
        ),
      );}
  };
  const constant = (token: Token, loc: number): void => {
    name(token, "a constant name");
    for (token = readToken(); token.image === "!"; token = readToken()) {name((token = readToken()), "a constant name");}
    if (token.image === "<-") {
      token = readToken();
      if (token.image === "[") {
        token = readToken();
        if (token === eof) {throw refuse(token.line, "Expected an identifier after <-[.");}
        name(token, "a module name");
        token = readToken();
        if (token.image !== "]") {throw refuse(token.line, "It was expecting ], but did not find it.");}
        token = readToken();
        if (token === eof) {throw refuse(token.line, "Expected an identifier after <-[mod].");}
      } else if (token === eof) {throw refuse(token.line, "Expected an identifier after <-.");}
      name(token, "the name after <-");
      return;
    }
    if (token.image === "(") {
      value(readToken());
      while ((token = readToken()).image === ",") {value(readToken());}
      if (token.image !== ")")
        {throw refuse(
          loc,
          "TLC gives no reason here. An operator's arguments are one or more values in ( ), with commas between them.",
        );}
      token = readToken();
    }
    if (token.image !== "=") {throw refuse(token.line, "It was expecting = or <-, but did not find it.");}
    token = readToken();
    if (token.image === "[") {
      token = readToken();
      if (token === eof) {throw refuse(token.line, "Expected an identifier after =[.");}
      name(token, "a module name");
      token = readToken();
      if (token.image !== "]") {throw refuse(token.line, "It was expecting ], but did not find it.");}
      token = readToken();
    }
    value(token);
  };
  const config: Config = {
    sections: [],
    invariants: [],
    properties: [],
    constraints: [],
    actionConstraints: [],
  };
  for (let token = readToken(); token !== eof;) {
    const keyword = token;
    const section = SECTIONS.get(keyword.image);
    if (!section) {throw refuse(token.line, "It was expecting a keyword, but did not find it.");}
    const { key, field, undefinedNoun } = section;
    const begin = tokenOffset;
    if (matchesUndefined(field)) {
      for (token = readToken(); token !== eof && !SECTIONS.has(token.image); token = readToken()) {constant(token, keyword.line);}
    } else if (isListField(field)) {
      for (token = readToken(); token !== eof && !SECTIONS.has(token.image); token = readToken()) {
        config[field].push(token.image);
        defined(token, undefinedNoun);
      }
    } else {
      token = readToken();
      if (token === eof)
        {throw refuse(
          keyword.line,
          `The keyword ${keyword.image} was not followed by an identifier.`,
        );}
      if (field === "checkDeadlock" && token.image !== "TRUE" && token.image !== "FALSE")
        {throw refuse(token.line, "It was expecting TRUE or FALSE, but did not find it.");}
      if (!matchesUndefined(config[field]))
        {throw refuse(keyword.line, `The keyword ${keyword.image} appeared twice.`);}
      if (field === "checkDeadlock") {config[field] = token.image === "TRUE";}
      else {
        config[field] = token.image;
        if (SECTIONS.has(token.image))
          {defer(cannot(token.line, `TLC would read the keyword ${token.image} as the name after ${key}.`));}
        else if (undefinedNoun) {defined(token, undefinedNoun);}
      }
      token = readToken();
    }
    const sectionEnd = token === eof ? tokens.length : tokenOffset - CODE_UNIT_WIDTH;
    const images = tokens.slice(begin, sectionEnd).map(({ image }) => image);
    config.sections.push({ key, line: keyword.line, tokens: images });
  }
  if (deferred) {throw deferred;}
  return config;
};
