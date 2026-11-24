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
const WORD = /\w+/y;
const CONFIG_HOLDS =
  "A config can hold only names, numbers, strings, comments, and the symbols { } ( ) [ ] , = ! <-.";
const shown = (c: string): string => {
  const code = c.codePointAt(0) ?? 0;
  const hex = `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
  if (code < 0x20 || code === 0x7F) {return hex;}
  return code < 0x7F ? `"${c}"` : `"${c}" (${hex})`;
};

interface Token { image: string; line: number }

const tokenizeConfig = function (text: string, cannot: (line: number, words: string) => Error) {
  if (text.startsWith("\uFEFF"))
    {throw cannot(1, "The file starts with a byte order mark. Save it as UTF-8 without one.");}
  const tokens: Token[] = [];
  let line = 1;
  let last = 1;
  let i = 0;
  const skip = (to: number): void => {
    for (; i < to; i++) {
      last = line;
      if (text[i] === "\n" || (text[i] === "\r" && text[i + 1] !== "\n")) {line++;}
    }
  };
  const push = (image: string): void => {
    tokens.push({ image, line });
    skip(i + image.length);
  };
  while (i < text.length) {
    const c = text[i];
    const two = text.slice(i, i + 2);
    const start = line;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {skip(i + 1);}
    else if (two === String.raw`\*`) {
      const end = text.slice(i).search(/[\n\r]/u);
      skip(end < 0 ? text.length : i + end);
    } else if (two === "(*") {
      const marks = /\(\*|\*\)/g;
      let depth = 0;
      do {
        marks.lastIndex = i;
        const regexMatch = marks.exec(text);
        if (!regexMatch) {throw cannot(start, "A comment starts here and does not end.");}
        depth += regexMatch[0] === "(*" ? 1 : -1;
        skip(regexMatch.index + 2);
      } while (depth);
    } else if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') {
        const ch = text[j];
        if (matchesUndefined(ch)) {throw cannot(start, "A string starts here and does not end.");}
        if (ch === "\n" || ch === "\r")
          {throw cannot(
            start,
            String.raw`A string starts here and does not end on its line. Write \n for a line break in a string.`,
          );}
        if (ch === "\0") {throw cannot(start, "A string has the character U+0000.");}
        if (ch === "\\" && !matchesUndefined(text[j + 1]) && !String.raw`"\ntrf`.includes(text[j + 1]))
          {throw cannot(
            start,
            `A string has a backslash before ${shown(text[j + 1])}. A string can use only the escapes \\" \\\\ \\n \\t \\r \\f.`,
          );}
        j += ch === "\\" ? 2 : 1;
      }
      push(text.slice(i, j + 1));
    } else if (/\w/u.test(c)) {
      WORD.lastIndex = i;
      const word = WORD.exec(text)?.[0] ?? c;
      if (/^[WS]F_/u.test(word))
        {throw cannot(
          start,
          `TLC reads ${word.slice(0, 3)} at the start of a word as a TLA+ keyword, so it cannot read ${word} as a name.`,
        );}
      if (!/[A-Za-z]/u.test(word) && word !== "_") {
        if (/\D/.test(word))
          {throw cannot(
            start,
            `TLC splits ${word} into ${word.match(/\d+|_/g)?.join(" ")}, because a name needs a letter.`,
          );}
        if (Number(word) > 2_147_483_647)
          {throw cannot(start, `TLC cannot read a number above 2147483647, such as ${word}.`);}
      }
      push(word);
    } else if (two === "<-") {push(two);}
    else if (["[]", "]_", "==", "=<", "!!"].includes(two))
      {throw cannot(start, `TLC reads ${two} as one TLA+ symbol, and a config cannot hold it.`);}
    else if ("{}()[],=!".includes(c)) {push(c);}
    else {
      const ch = String.fromCodePoint(text.codePointAt(i) ?? 0);
      const where = ch > "\x7F" ? " outside a string" : "";
      throw cannot(start, `It cannot read the character ${shown(ch)}${where}. ${CONFIG_HOLDS}`);
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
  let at = 0;
  const next = () => tokens[at++] ?? eof;
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
      token = next();
      if (token.image === "}") {return;}
      value(token);
      while ((token = next()).image === ",") {value(next());}
      if (token.image !== "}") {throw refuse(token.line, "It was expecting }, but did not find it.");}
    } else if (SECTIONS.has(token.image))
      {defer(cannot(token.line, `TLC would read the keyword ${token.image} as a value.`));}
    else if (!NAME.test(token.image) && !/^(?:\d+|".*")$/.test(token.image))
      {defer(
        cannot(
          token.line,
          `TLC would read ${token.image} as a value. A value is a name, a number, a string, or a set in braces.`,
        ),
      );}
  };
  const constant = (token: Token, loc: number): void => {
    name(token, "a constant name");
    for (token = next(); token.image === "!"; token = next()) {name((token = next()), "a constant name");}
    if (token.image === "<-") {
      token = next();
      if (token.image === "[") {
        token = next();
        if (token === eof) {throw refuse(token.line, "Expected an identifier after <-[.");}
        name(token, "a module name");
        token = next();
        if (token.image !== "]") {throw refuse(token.line, "It was expecting ], but did not find it.");}
        token = next();
        if (token === eof) {throw refuse(token.line, "Expected an identifier after <-[mod].");}
      } else if (token === eof) {throw refuse(token.line, "Expected an identifier after <-.");}
      name(token, "the name after <-");
      return;
    }
    if (token.image === "(") {
      value(next());
      while ((token = next()).image === ",") {value(next());}
      if (token.image !== ")")
        {throw refuse(
          loc,
          "TLC gives no reason here. An operator's arguments are one or more values in ( ), with commas between them.",
        );}
      token = next();
    }
    if (token.image !== "=") {throw refuse(token.line, "It was expecting = or <-, but did not find it.");}
    token = next();
    if (token.image === "[") {
      token = next();
      if (token === eof) {throw refuse(token.line, "Expected an identifier after =[.");}
      name(token, "a module name");
      token = next();
      if (token.image !== "]") {throw refuse(token.line, "It was expecting ], but did not find it.");}
      token = next();
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
  for (let token = next(); token !== eof;) {
    const keyword = token;
    const section = SECTIONS.get(keyword.image);
    if (!section) {throw refuse(token.line, "It was expecting a keyword, but did not find it.");}
    const { key, field, undefinedNoun } = section;
    const begin = at;
    if (matchesUndefined(field)) {
      for (token = next(); token !== eof && !SECTIONS.has(token.image); token = next()) {constant(token, keyword.line);}
    } else if (isListField(field)) {
      for (token = next(); token !== eof && !SECTIONS.has(token.image); token = next()) {
        config[field].push(token.image);
        defined(token, undefinedNoun);
      }
    } else {
      token = next();
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
      token = next();
    }
    const images: string[] = [];
    for (let k = begin; k < (token === eof ? tokens.length : at - 1); k++) {images.push(tokens[k].image);}
    config.sections.push({ key, line: keyword.line, tokens: images });
  }
  if (deferred) {throw deferred;}
  return config;
};
