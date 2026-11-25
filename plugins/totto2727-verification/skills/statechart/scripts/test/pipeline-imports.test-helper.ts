// oxlint-disable-next-line rules/no-node-imports -- The architectural tests validate data emitted by a native Node child.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Give each loader-hook observation its own process.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Read the standalone skill exactly as it is laid out on the host.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve type imports using Node's actual package resolution.
import { createRequire } from "node:module";
// oxlint-disable-next-line rules/no-node-imports -- Construct filesystem paths for the native Node loader.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Supply file URLs to the native Node loader.
import { fileURLToPath, pathToFileURL } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Await Node's callback-based child process API.
import { promisify } from "node:util";
import { isString } from "#statechart/ir.ts";

const scripts = path.resolve(import.meta.dirname, "..");
const EMPTY_LIST = 0;

export const inOrder = async <Item, Result>(
  items: Readonly<Item[]>,
  visit: (item: Item) => Promise<Result>,
): Promise<Result[]> => {
  const results: Result[] = [];
  // oxlint-disable-next-line rules/no-for-loops -- File discovery and child probes run one at a time.
  for (const item of items) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish each native filesystem or process operation before starting the next.
    results.push(await visit(item));
  }
  return results;
};

export const sources = async (target: string): Promise<string[]> => {
  const full = path.join(scripts, target);
  const targetStats = await fs.stat(full);
  if (!targetStats.isDirectory()) {return [target];}
  const entries = await fs.readdir(full, { encoding: "utf8", recursive: true });
  const files = await inOrder(entries, async (entry) => {
    const file = path.join(target, entry);
    const stats = await fs.stat(path.join(scripts, file));
    return stats.isFile() ? file : undefined;
  });
  return files.filter((file) => isString(file));
};

export const assertHasEntries = (entries: Readonly<unknown[]>, label?: string): void => {
  assert.ok(entries.length > EMPTY_LIST, label);
};

const RECORD = `
import { registerHooks } from "node:module";
const edges = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (context.parentURL !== import.meta.url) edges.push([context.parentURL, resolved.url]);
    return resolved;
  },
});
for (const url of process.argv.slice(1)) await import(url);
console.log(JSON.stringify(edges));
`;

// oxlint-disable-next-line typescript/strict-void-return -- Node's promisify convention uses execFile's callback and ignores its immediate ChildProcess handle.
const execProbe = promisify(execFile);

const name = (url: string): string =>
  url.startsWith("file:") ? path.relative(scripts, fileURLToPath(url)) : url;

export const loads = async (...targets: string[]): Promise<[string, string][]> => {
  const groupedFiles = await inOrder(targets, sources);
  const files = groupedFiles.flat();
  const urls = files.map((file) => pathToFileURL(path.join(scripts, file)).href);
  const { stdout } = await execProbe(process.execPath, ["--input-type=module", "-e", RECORD, ...urls], {
    encoding: "utf8",
  });
  const encoded: unknown = JSON.parse(stdout);
  assert.ok(Array.isArray(encoded));
  return encoded.map((edge: unknown) => {
    assert.ok(Array.isArray(edge));
    const pair: unknown[] = edge;
    const [from, to] = pair;
    assert.ok(isString(from) && isString(to));
    return [name(from), name(to)];
  });
};

const COMMENT =
  /(?<literal>"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu;
const TYPE_IMPORT =
  /\b(?:import|export)\s+type\b\s*(?:[\w$]+|\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'](?<specifier>[^"']*)["']/gu;

export const codeOf = async (file: string): Promise<string> => {
  const source = await fs.readFile(path.join(scripts, file), "utf8");
  return source.replaceAll(COMMENT, (_match, literal: unknown) => isString(literal) ? literal : " ");
};

export const typeImports = async (file: string): Promise<string[]> => {
  const resolveFromFile = createRequire(path.join(scripts, file)).resolve;
  const text = await codeOf(file);
  return Array.from(text.matchAll(TYPE_IMPORT), ({ groups }) => {
    const specifier = groups?.specifier;
    assert.ok(isString(specifier));
    const resolved = resolveFromFile(specifier);
    return path.isAbsolute(resolved) ? path.relative(scripts, resolved) : resolved;
  });
};
