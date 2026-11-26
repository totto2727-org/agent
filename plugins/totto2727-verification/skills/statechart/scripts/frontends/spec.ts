import type { Config, ConfigSection, Spec } from "#statechart/ir.ts";
import { NAME } from "./config.ts";
import { matchesUndefined, visitItems } from "#statechart/ir.ts";

export type Checks = Pick<Spec, "invariants" | "properties" | "deadlock" | "written">;

export const readChecks = function readChecks({ configFile, config }: { configFile: string; config: Config }): Checks {
  const refuse = (words: string): Error =>
    // oxlint-disable-next-line rules/require-tagged-error -- The standalone CLI reports TLC configuration refusals as native Error objects.
    new Error(`TLC refuses the config ${configFile}. ${words}`);
  const hasSpec = Boolean(config.spec);
  const hasInit = Boolean(config.init);
  if (hasSpec && (hasInit || Boolean(config.next)))
    {throw refuse("The configuration file cannot specify both INIT/NEXT and SPECIFICATION fields.");}
  if (!hasSpec && !hasInit)
    {throw refuse("The configuration file did not specify the initial state predicate.");}
  const written: ConfigSection[] = [];
  visitItems(config.sections, (section) => {if (!["INVARIANT", "PROPERTY", "CHECK_DEADLOCK"].includes(section.key)) {written.push(section);}});
  // oxlint-disable-next-line eslint/sort-keys -- Keep the check fields in their existing order in the serialized spec.
  return { invariants: config.invariants, properties: config.properties, deadlock: config.checkDeadlock !== false, written };
};

interface XmlNode { tag: string; text: string; children: XmlNode[] }

const ENTITIES: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

const DECIMAL_RADIX = 10;
const HEX_RADIX = 16;
const LAST_OPEN_NODE = -1;
const CONTEXT_SYMBOL_INDEX = 1;

const decode = (text: string): string =>
  text.replaceAll(/&(?<numeric>#x?)?(?<entity>\w+);/gu, (_match, numeric: string | undefined, entity: string) => {
    if (matchesUndefined(numeric)) {return ENTITIES[entity];}
    const code = numeric === "#x" ? Number.parseInt(entity, HEX_RADIX) : Number.parseInt(entity, DECIMAL_RADIX);
    return String.fromCodePoint(code);
  });

const xmlNode = (tag: string): XmlNode =>
  // oxlint-disable-next-line eslint/sort-keys -- XML nodes returned in the parsed definitions retain their serialized field order.
  ({ tag, text: "", children: [] });

const parseXml = (xml: string): XmlNode => {
  const document = xmlNode("");
  const open = [document];
  visitItems(xml.matchAll(
    /<(?<close>\/?)(?<tag>[^\s/>?!]+)[^>]*?(?<empty>\/?)>|<[?!][^>]*>|(?<text>[^<]+)/gu,
  ), (match) => {
    const { groups } = match;
    const parent = open[open.length + LAST_OPEN_NODE];
    if (!matchesUndefined(groups?.text)) {parent.text += decode(groups.text);}
    else if (groups?.close === "/") {open.pop();}
    else if (!matchesUndefined(groups?.tag)) {
      const node = xmlNode(groups.tag);
      parent.children.push(node);
      if (groups.empty !== "/") {open.push(node);}
    }
  });
  return document;
};

const child = (node: XmlNode | undefined, tag: string): XmlNode | undefined => node?.children.find((currentChild) => currentChild.tag === tag);
const textOf = (node: XmlNode | undefined, tag: string): string => child(node, tag)?.text ?? "";

// oxlint-disable-next-line typescript/consistent-type-definitions -- Keep the exported SANY result structurally assignable to record consumers.
export type Sany = {
  variables: string[];
  definitions: Map<string, XmlNode>;
};

const VARIABLE_KIND = "3";

const symbolsOf = (modules: XmlNode | undefined): Map<string, XmlNode> => {
  const symbols = new Map<string, XmlNode>();
  visitItems(child(modules, "context")?.children ?? [], (entry) => {
    symbols.set(textOf(entry, "UID"), entry.children[CONTEXT_SYMBOL_INDEX]);
  });
  return symbols;
};

const rootModule = (symbols: Map<string, XmlNode>, root: string): XmlNode | undefined => {
  const selected: { module?: XmlNode } = {};
  visitItems(symbols.values(), (node) => {
    if (node.tag === "ModuleNode" && textOf(node, "uniquename") === root) {selected.module = node;}
  });
  return selected.module;
};

export const readSany = function readSany(xml: string): Sany {
  const modules = child(parseXml(xml), "modules");
  const symbols = symbolsOf(modules);
  const module = rootModule(symbols, textOf(modules, "RootModule"));
  const definitions = new Map<string, XmlNode>();
  const variables: { name: string; uid: number }[] = [];
  visitItems(module?.children ?? [], (ref) => {
    if (ref.tag !== "OpDeclNodeRef" && ref.tag !== "UserDefinedOpKindRef") {return;}
    const uid = textOf(ref, "UID");
    const node = symbols.get(uid);
    if (!node) {return;}
    const name = textOf(node, "uniquename");
    definitions.set(name, node);
    if (node.tag === "OpDeclNode" && textOf(node, "kind") === VARIABLE_KIND)
      {variables.push({ name, uid: Number(uid) });}
  });
  const names = variables.toSorted((left, right) => left.uid - right.uid).map((variable) => variable.name);
  // oxlint-disable-next-line eslint/sort-keys -- Retain the established SANY result field order.
  return { variables: names, definitions };
};

export const readSpec = function readSpec({
  module,
  sany,
  checks,
}: {
  module: string;
  sany: Sany;
  checks: Checks;
}): Spec {
  return { module, variables: sany.variables, ...checks };
};

const STATE_LEVEL = 1;
const FIRST_SUBSTITUTION_TOKEN = 1;
const TOKEN_STEP = 1;

export const initialOnlyProperties = function initialOnlyProperties({ definitions }: Sany, { written, properties }: Spec): Set<string> {
  const replaced = new Map<string, string>();
  visitItems(written, ({ key, tokens }) => {
    if (key !== "CONSTANT") {return;}
    visitItems(tokens.keys(), (index) => {
      if (index < FIRST_SUBSTITUTION_TOKEN || index + TOKEN_STEP >= tokens.length || tokens[index] !== "<-") {return;}
      const operator = tokens[index + TOKEN_STEP];
      if (NAME.test(operator)) {replaced.set(tokens[index - TOKEN_STEP], operator);}
    });
  });
  const names = new Set<string>();
  visitItems(properties, (name) => {
    const definition = definitions.get(replaced.get(name) ?? name);
    if (definition && Number(textOf(definition, "level")) <= STATE_LEVEL) {names.add(name);}
  });
  return names;
};
