import { matchesUndefined } from "#statechart/ir.ts";
import type { Config } from "#statechart/ir.ts";
import { isListField, sections } from "./config-sections.ts";
import type { ScalarField, Section } from "./config-sections.ts";
import { tokenizeConfig } from "./config-tokens.ts";
import type { Token } from "./config-tokens.ts";

export const NAME = /^\w*[A-Za-z]\w*$/u;
const FIRST_TOKEN = 0;
const TOKEN_STEP = 1;

const errorAt = function (prefix: string, line: number, words: string): Error {
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the host Error reported by the standalone native configuration parser.
  return new Error(`${prefix} at line ${line}. ${words}`);
};

class ConfigReader {
  #file: string;
  #tokens: Token[];
  #eof: Token;
  #offset = FIRST_TOKEN;
  #deferred: Error | undefined;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the published configuration record order.
  #config: Config = { sections: [], invariants: [], properties: [], constraints: [], actionConstraints: [] };

  public constructor(file: string, tokens: Token[], end: number) {
    this.#file = file;
    this.#tokens = tokens;
    this.#eof = { image: "", line: end };
  }

  public read(): Config {
    // oxlint-disable-next-line rules/no-let -- Carry the boundary token returned by each section to the next section.
    let keyword = this.#readToken();
    while (keyword !== this.#eof) {
      keyword = this.#section(keyword);
    }
    if (this.#deferred) {throw this.#deferred;}
    return this.#config;
  }

  #refuse(line: number, words: string): Error {
    return errorAt(`TLC refuses the config ${this.#file}`, line, words);
  }

  #cannot(line: number, words: string): Error {
    return errorAt(`The command cannot read the config ${this.#file}`, line, words);
  }

  #readToken(): Token {
    const token = this.#tokens[this.#offset] ?? this.#eof;
    this.#offset += TOKEN_STEP;
    return token;
  }

  #defer(error: Error): void {
    this.#deferred ??= error;
  }

  #defined(token: Token, undefinedNoun: string | undefined): void {
    if (!NAME.test(token.image)) {
      this.#defer(this.#refuse(token.line, `The ${undefinedNoun} ${token.image} specified in the configuration file is not defined in the specification.`));
    }
  }

  #name(token: Token, what: string): void {
    if (sections.has(token.image)) {
      this.#defer(this.#cannot(token.line, `TLC would read the keyword ${token.image} as ${what}.`));
    } else if (!NAME.test(token.image)) {
      this.#defer(this.#cannot(token.line, `TLC would read ${token.image} as ${what}, and it is not a name.`));
    }
  }

  #literal(token: Token): void {
    if (token === this.#eof) {
      throw this.#refuse(token.line, "It was expecting a value, but did not find it.");
    }
    if (sections.has(token.image)) {
      this.#defer(this.#cannot(token.line, `TLC would read the keyword ${token.image} as a value.`));
    } else if (!NAME.test(token.image) && !/^(?:\d+|".*")$/u.test(token.image)) {
      this.#defer(this.#cannot(token.line, `TLC would read ${token.image} as a value. A value is a name, a number, a string, or a set in braces.`));
    }
  }

  #value(token: Token): void {
    if (token.image === "{") {
      const first = this.#readToken();
      if (first.image !== "}") {
        this.#value(first);
        const close = this.#remainingValues();
        if (close.image !== "}") {throw this.#refuse(close.line, "It was expecting }, but did not find it.");}
      }
    } else {
      this.#literal(token);
    }
  }

  #remainingValues(): Token {
    // oxlint-disable-next-line rules/no-let -- Keep the consumed closing token to diagnose the first non-comma delimiter.
    let delimiter = this.#readToken();
    while (delimiter.image === ",") {
      this.#value(this.#readToken());
      delimiter = this.#readToken();
    }
    return delimiter;
  }

  #qualifiedTail(): Token {
    // oxlint-disable-next-line rules/no-let -- Consume each native qualification in order and retain the first token after it.
    let token = this.#readToken();
    while (token.image === "!") {
      this.#name(this.#readToken(), "a constant name");
      token = this.#readToken();
    }
    return token;
  }

  #moduleSuffix(operator: "<-[" | "=["): Token {
    const module = this.#readToken();
    if (module === this.#eof) {throw this.#refuse(module.line, `Expected an identifier after ${operator}.`);}
    this.#name(module, "a module name");
    const close = this.#readToken();
    if (close.image !== "]") {throw this.#refuse(close.line, "It was expecting ], but did not find it.");}
    return this.#readToken();
  }

  #override(): void {
    const destination = this.#readToken();
    const hasModule = destination.image === "[";
    const target = hasModule ? this.#moduleSuffix("<-[") : destination;
    if (target === this.#eof) {
      throw this.#refuse(target.line, hasModule ? "Expected an identifier after <-[mod]." : "Expected an identifier after <-.");
    }
    this.#name(target, "the name after <-");
  }

  #arguments(line: number): Token {
    this.#value(this.#readToken());
    const close = this.#remainingValues();
    if (close.image !== ")") {
      throw this.#refuse(line, "TLC gives no reason here. An operator's arguments are one or more values in ( ), with commas between them.");
    }
    return this.#readToken();
  }

  #constant(token: Token, line: number): void {
    this.#name(token, "a constant name");
    const tail = this.#qualifiedTail();
    if (tail.image === "<-") {
      this.#override();
    } else {
      const operator = tail.image === "(" ? this.#arguments(line) : tail;
      if (operator.image !== "=") {throw this.#refuse(operator.line, "It was expecting = or <-, but did not find it.");}
      const value = this.#readToken();
      this.#value(value.image === "[" ? this.#moduleSuffix("=[") : value);
    }
  }

  #untilSection(consume: (token: Token) => void): Token {
    // oxlint-disable-next-line rules/no-let -- Keep the next unread section keyword while consuming its predecessor's items.
    let token = this.#readToken();
    while (token !== this.#eof && !sections.has(token.image)) {
      consume(token);
      token = this.#readToken();
    }
    return token;
  }

  #scalarValue(keyword: Token, token: Token, field: ScalarField): void {
    if (token === this.#eof) {
      throw this.#refuse(keyword.line, `The keyword ${keyword.image} was not followed by an identifier.`);
    }
    if (field === "checkDeadlock" && token.image !== "TRUE" && token.image !== "FALSE") {
      throw this.#refuse(token.line, "It was expecting TRUE or FALSE, but did not find it.");
    }
    if (!matchesUndefined(this.#config[field])) {
      throw this.#refuse(keyword.line, `The keyword ${keyword.image} appeared twice.`);
    }
  }

  #readScalar(keyword: Token, field: ScalarField, { key, undefinedNoun }: Section): Token {
    const token = this.#readToken();
    this.#scalarValue(keyword, token, field);
    if (field === "checkDeadlock") {
      this.#config[field] = token.image === "TRUE";
    } else {
      this.#config[field] = token.image;
      if (sections.has(token.image)) {
        this.#defer(this.#cannot(token.line, `TLC would read the keyword ${token.image} as the name after ${key}.`));
      } else if (!matchesUndefined(undefinedNoun)) {
        this.#defined(token, undefinedNoun);
      }
    }
    return this.#readToken();
  }

  #contents(keyword: Token, section: Section): Token {
    const { field, undefinedNoun } = section;
    if (matchesUndefined(field)) {
      return this.#untilSection((token) => {this.#constant(token, keyword.line);});
    }
    if (isListField(field)) {
      return this.#untilSection((token) => {
        this.#config[field].push(token.image);
        this.#defined(token, undefinedNoun);
      });
    }
    return this.#readScalar(keyword, field, section);
  }

  #section(keyword: Token): Token {
    const section = sections.get(keyword.image);
    if (!section) {
      throw this.#refuse(keyword.line, "It was expecting a keyword, but did not find it.");
    }
    const begin = this.#offset;
    const next = this.#contents(keyword, section);
    const end = next === this.#eof ? this.#tokens.length : this.#offset - TOKEN_STEP;
    const tokens = this.#tokens.slice(begin, end).map(({ image }) => image);
    this.#config.sections.push({ key: section.key, line: keyword.line, tokens });
    return next;
  }
}

export const readConfig = function readConfig({ file, text }: { file: string; text: string }): Config {
  const { end, tokens } = tokenizeConfig(text, (line, words) => errorAt(`The command cannot read the config ${file}`, line, words));
  return new ConfigReader(file, tokens, end).read();
};
