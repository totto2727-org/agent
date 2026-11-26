#!/usr/bin/env node
// oxlint-disable-next-line rules/no-node-imports -- The Node replay fixture starts the actual JVM when recording TLC output.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Keep the fixture result typed to the native JVM subprocess contract.
import type { SpawnSyncReturns } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- The standalone fixture records and replays the existing corpus files.
import { access, appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve test paths using the host platform's conventions.
import path from "node:path";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { hostEnvironment } from "#statechart/host-env.ts";
import { matchesNull, matchesUndefined } from "#statechart/ir.ts";

const ARGUMENT_START = 2;
const NEXT_ARGUMENT = 1;
const GRAPH_PATH_OFFSET = 2;
const FIRST_MATCH = 0;
const EMPTY = 0;
const SUCCESS = 0;
const FAILURE = 1;
const optionalPath = (value: string | undefined): string | undefined =>
  matchesUndefined(value) || value.length === EMPTY ? undefined : value;
const args = process.argv.slice(ARGUMENT_START);
const config = optionalPath(args.includes("-config") ? args[args.indexOf("-config") + NEXT_ARGUMENT] : undefined);
const name = matchesUndefined(config) ? "sany" : path.basename(config, ".cfg");
const dump = args.includes("-dump") ? `${args[args.indexOf("-dump") + GRAPH_PATH_OFFSET]}.dot` : undefined;
const environment = hostEnvironment();
const record = optionalPath(environment.STATECHART_RECORD);
const replay = optionalPath(environment.STATECHART_REPLAY);
const log = optionalPath(environment.STATECHART_LOG);
const plain = optionalPath(environment.STATECHART_PLAIN);
if (!matchesUndefined(log) && !matchesUndefined(config)) {
  const configText = await readFile(config, "utf8");
  await appendFile(log, `## ${name}\n${configText}\n`);
}

const TAG = /"chart-[0-9a-f]{32}"/gu;
const JAVA_OUTPUT_LIMIT = 1_073_741_824;

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

const java = async (folder: string, commandArgs: string[]): Promise<SpawnSyncReturns<string>> => {
  // oxlint-disable-next-line node/no-sync -- The fixture records the JVM's native stdout, stderr and exact exit status as one result.
  const commandResult = spawnSync(hostEnvironment().STATECHART_JAVA ?? "java", commandArgs, {
    encoding: "utf8",
    maxBuffer: JAVA_OUTPUT_LIMIT,
  });
  await writeFile(path.join(folder, `${name}.out`), (commandResult.stdout + commandResult.stderr).replaceAll(TAG, '"chart"'));
  const { status } = commandResult;
  if (!matchesNull(status) && status !== SUCCESS) {
    await writeFile(path.join(folder, `${name}.exit`), `${status}\n`);
  }
  return commandResult;
};

if (!matchesUndefined(record)) {
  const includePlain = !matchesUndefined(plain);
  const workerArgs = includePlain
    ? args.map((argument, index) => (args[index - NEXT_ARGUMENT] === "-workers" ? "1" : argument))
    : args;
  const wantsPlainText = workerArgs.includes("tlc2.TLC") && !workerArgs.includes("-tool");
  const tool = wantsPlainText
    ? workerArgs.flatMap((argument) => (argument === "tlc2.TLC" ? [argument, "-tool"] : [argument]))
    : workerArgs;
  const result = await java(record, tool);
  if (!matchesUndefined(dump) && (await exists(dump))) {await copyFile(dump, path.join(record, "graph.dot"));}
  if (includePlain && tool.includes("-tool"))
    {await java(
      plain,
      tool
        .filter((argument) => argument !== "-tool")
        .map((argument, index, all) =>
          all[index - NEXT_ARGUMENT] === "-metadir" || all[index - GRAPH_PATH_OFFSET] === "-dump" ? `${argument}-plain` : argument,
        ),
    );}
  const shown = (text: string): string =>
    wantsPlainText ? [...plainText(readMessages(text))].join("") : text;
  process.stdout.write(shown(result.stdout));
  process.stderr.write(shown(result.stderr));
  process.exit(result.status ?? FAILURE);
}

if (matchesUndefined(replay)) {
  // oxlint-disable-next-line rules/require-tagged-error -- The fixture reports a missing replay configuration through Node's normal CLI error.
  throw new Error("Set STATECHART_RECORD or STATECHART_REPLAY to a folder.");
}
const file = (ext: string): string => path.join(replay, `${name}${ext}`);
const savedGraph = path.join(replay, "graph.dot");
if (!matchesUndefined(dump) && (await exists(savedGraph))) {await copyFile(savedGraph, dump);}
const source = (await exists("ChartRun.tla")) ? await readFile("ChartRun.tla", "utf8") : undefined;
const tag = source?.match(TAG)?.[FIRST_MATCH];
const saved = await readFile(file(".out"), "utf8");
process.stdout.write(matchesUndefined(tag) ? saved : saved.replaceAll(/(?<prefix><<\s*)"chart"(?=,)/gu, `$<prefix>${tag}`));
const savedExit = file(".exit");
process.exit((await exists(savedExit)) ? Number(await readFile(savedExit, "utf8")) : SUCCESS);
