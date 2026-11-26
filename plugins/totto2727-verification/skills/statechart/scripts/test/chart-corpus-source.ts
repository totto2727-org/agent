// oxlint-disable-next-line rules/no-node-imports -- Read the native TLC and SANY fixtures from the test corpus.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve fixture paths within this test package.
import path from "node:path";
import { readConfig } from "#statechart/frontends/config.ts";
import { readChecks, readSany, readSpec } from "#statechart/frontends/spec.ts";
import type { Spec } from "#statechart/ir.ts";

const here = import.meta.dirname;
export const corpus = (name: string, file: string): string => path.join(here, "corpus", name, file);

export const readCorpusFixture = async (name: string, file: string): Promise<string> =>
  readFile(corpus(name, file), "utf8");

export const corpusSpec = async (name: string): Promise<Spec> => {
  const configFile = corpus(name, `${name}.cfg`);
  const config = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  const xml = await readCorpusFixture(name, "sany.out");
  const sany = readSany(xml);
  const checks = readChecks({ config, configFile });
  return readSpec({ checks, module: name, sany });
};
