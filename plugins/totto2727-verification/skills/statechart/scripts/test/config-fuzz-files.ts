// oxlint-disable-next-line rules/no-node-imports -- These fixtures are written for the independent Java parser.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The filenames passed to the oracle use native paths.
import path from "node:path";
import { configText } from "#statechart/backends/cfg.ts";
import { readConfig } from "#statechart/frontends/config.ts";
import { readChecks } from "#statechart/frontends/spec.ts";
import type { Checks } from "#statechart/frontends/spec.ts";
import { generate, mulberry32 } from "./config-fuzz-generator.ts";
import type { Sample } from "./config-fuzz-generator.ts";
import { inOrder } from "./serial-test-io.ts";

export interface ConfigCase {
  file: string;
  index: number;
  output: string;
  sample: Sample;
  skill: Checks | Error;
}

const readCase = async (file: string, text: string, output: string): Promise<Checks | Error> => {
  try {
    const skill = readChecks({ config: readConfig({ file, text }), configFile: file });
    await fs.writeFile(output, configText(skill.written, []));
    return skill;
  } catch (error) {
    // oxlint-disable-next-line rules/no-instanceof-error -- The independent native differential must report the skill's original Error and rethrow other values.
    if (!(error instanceof Error)) {throw error;}
    return error;
  }
};

const writeCase = async (directory: string, index: number, sample: Sample): Promise<ConfigCase> => {
  const file = path.join(directory, `${index}.cfg`);
  await fs.writeFile(file, sample.text);
  const output = path.join(directory, `${index}-written.cfg`);
  return { file, index, output, sample, skill: await readCase(file, sample.text, output) };
};

export const inputsForOracle = ({ file, output, skill }: ConfigCase): string[] =>
  // oxlint-disable-next-line rules/no-instanceof-error -- A failed native case does not produce a second fixture for TLC to read.
  skill instanceof Error ? [file] : [file, output];

export const writeCases = async (directory: string, seed: number, count: number): Promise<ConfigCase[]> => {
  const next = mulberry32(seed);
  const samples = Array.from({ length: count }, (_unused, index) => ({ index, sample: generate(next) }));
  return inOrder(samples, async ({ index, sample }) => writeCase(directory, index, sample));
};
