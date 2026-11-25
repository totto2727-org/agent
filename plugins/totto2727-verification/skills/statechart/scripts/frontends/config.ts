import { CHECK_DEADLOCK, matchesUndefined, visitItems } from '#statechart/ir.ts';
import type { Config } from '#statechart/ir.ts';
import { tokenizeConfig } from "./config-tokens.ts";
import type { Token } from "./config-tokens.ts";

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
const FIRST_TOKEN = 0;
const TOKEN_STEP = 1;

export const readConfig = function readConfig({ file, text }: { file: string; text: string }): Config {
  const refuse = (line: number, words: string) =>
    new Error(`TLC refuses the config ${file} at line ${line}. ${words}`);
  const cannot = (line: number, words: string) =>
    new Error(`The command cannot read the config ${file} at line ${line}. ${words}`);
  const { tokens, end } = tokenizeConfig(text, cannot);
  const eof: Token = { image: "", line: end };
  let tokenOffset = FIRST_TOKEN;
  const readToken = (): Token => {
    const token = tokens[tokenOffset] ?? eof;
    tokenOffset += TOKEN_STEP;
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
    const sectionEnd = token === eof ? tokens.length : tokenOffset - TOKEN_STEP;
    const images = tokens.slice(begin, sectionEnd).map(({ image }) => image);
    config.sections.push({ key, line: keyword.line, tokens: images });
  }
  if (deferred) {throw deferred;}
  return config;
};
