// oxlint-disable-next-line rules/no-node-imports -- Install the renderer versions used by the native integration test.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Read the chart fixtures and documented renderer theme through the filesystem.
import { readdir, readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve dependencies installed in the renderer fixture cache.
import { createRequire } from "node:module";
// oxlint-disable-next-line rules/no-node-imports -- Use the host's default cache directory when it is not configured.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve cache and fixture paths with native path handling.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Load isolated renderer modules by file URL.
import { pathToFileURL } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Wait for the native npm child process.
import { promisify } from "node:util";
import { hostEnvironment } from "#statechart/host-env.ts";
import type { Html, Mermaid, Render } from "./labels.ts";

const directory = import.meta.dirname;
const cache = path.join(hostEnvironment().XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "statechart");

interface DocumentWindow {
  DOMParser: unknown;
  document: { createElement: (type: "template") => { content: { textContent: string | null }; innerHTML: string } };
}

export interface RenderTools { html: Html; mermaid: Mermaid; render: Render }

// oxlint-disable-next-line typescript/strict-void-return -- Node provides a custom Promise overload for execFile.
const execute = promisify(execFile);

const install = async (name: string, ...packages: string[]): Promise<NodeJS.Require> => {
  const dir = path.join(cache, name);
  await execute("npm", ["install", "--prefix", dir, "--no-audit", "--no-fund", "--save-exact", ...packages]);
  return createRequire(path.join(dir, "package.json"));
};

const rendererFrom = async <Module>(require: NodeJS.Require, specifier: string): Promise<Module> => {
  const runtime: unknown = await import(pathToFileURL(require.resolve(specifier)).href);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fixture pins these renderer packages and only uses their tested public exports.
  return runtime as Module;
};

const windowFrom = (require: NodeJS.Require): DocumentWindow => {
  const runtime: unknown = require("jsdom");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- jsdom is installed in the fixture cache and exposes the pinned JSDOM constructor.
  const { JSDOM } = runtime as { JSDOM: new (source: string) => { window: DocumentWindow } };
  return new JSDOM("").window;
};

export const loadRenderTools = async (): Promise<RenderTools> => {
  const pele = await install("test-pele-1.9.0", "pele@1.9.0");
  const { render } = await rendererFrom<{ render: Render }>(pele, "pele");
  const parser = await install("test-mermaid-11.16.0", "mermaid@11.16.0", "jsdom@26.1.0");
  const window = windowFrom(parser);
  Object.assign(globalThis, { DOMParser: window.DOMParser, document: window.document, window });
  const { default: mermaid } = await rendererFrom<{ default: Mermaid }>(parser, "mermaid");
  const html = (markup: string): string => {
    const template = window.document.createElement("template");
    template.innerHTML = markup;
    return template.content.textContent ?? "";
  };
  return { html, mermaid, render };
};

export const chartFixtures = async (): Promise<{ name: string; text: string }[]> => {
  const chartsDir = path.join(directory, "charts");
  const corpusDir = path.join(directory, "corpus");
  const chartFiles = await readdir(chartsDir);
  const corpusFolders = await readdir(corpusDir);
  const charts = chartFiles.map((file) => path.join(chartsDir, file));
  const corpus = corpusFolders.map((folder) => path.join(corpusDir, folder, "chart.mmd"));
  return Array.fromAsync([...charts, ...corpus], async (file) =>
    ({ name: path.relative(directory, file), text: await readFile(file, "utf8") }));
};

export const themeFixture = async (): Promise<string | undefined> => {
  const guide = await readFile(path.join(directory, "../../references/render.md"), "utf8");
  return /```css\n(?<theme>[\s\S]*?)```/u.exec(guide)?.groups?.theme;
};
