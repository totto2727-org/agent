#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";

const args = process.argv.slice(2);
const config = args.includes("-config") ? args[args.indexOf("-config") + 1] : undefined;
const name = config ? path.basename(config, ".cfg") : "sany";
const dump = args.includes("-dump") ? `${args[args.indexOf("-dump") + 2]}.dot` : undefined;
const {
  STATECHART_RECORD: record,
  STATECHART_REPLAY: replay,
  STATECHART_LOG: log,
  STATECHART_PLAIN: plain,
} = process.env;
if (log && config) {fs.appendFileSync(log, `## ${name}\n${fs.readFileSync(config, "utf8")}\n`);}

const TAG = /"chart-[0-9a-f]{32}"/g;

const java = (folder: string, args: string[]) => {
  const r = spawnSync(process.env.STATECHART_JAVA ?? "java", args, {
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  fs.writeFileSync(path.join(folder, `${name}.out`), (r.stdout + r.stderr).replaceAll(TAG, '"chart"'));
  if (r.status) {fs.writeFileSync(path.join(folder, `${name}.exit`), `${r.status}\n`);}
  return r;
};

if (record) {
  let tool = plain ? args.map((argument, index) => (args[index - 1] === "-workers" ? "1" : argument)) : args;
  const wantsPlainText = tool.includes("tlc2.TLC") && !tool.includes("-tool");
  if (wantsPlainText) {tool = tool.flatMap((a) => (a === "tlc2.TLC" ? [a, "-tool"] : [a]));}
  const r = java(record, tool);
  if (dump && fs.existsSync(dump)) {fs.copyFileSync(dump, path.join(record, "graph.dot"));}
  if (plain && tool.includes("-tool"))
    {java(
      plain,
      tool
        .filter((a) => a !== "-tool")
        .map((a, index, all) =>
          all[index - 1] === "-metadir" || all[index - 2] === "-dump" ? `${a}-plain` : a,
        ),
    );}
  const shown = (text: string): string =>
    wantsPlainText ? [...plainText(readMessages(text))].join("") : text;
  process.stdout.write(shown(r.stdout));
  process.stderr.write(shown(r.stderr));
  process.exit(r.status ?? 1);
}

if (!replay) {throw new Error("Set STATECHART_RECORD or STATECHART_REPLAY to a folder.");}
const file = (ext: string): string => path.join(replay, `${name}${ext}`);
if (dump && fs.existsSync(path.join(replay, "graph.dot")))
  {fs.copyFileSync(path.join(replay, "graph.dot"), dump);}
const tag = fs.existsSync("ChartRun.tla")
  ? fs.readFileSync("ChartRun.tla", "utf8").match(TAG)?.[0]
  : undefined;
const saved = fs.readFileSync(file(".out"), "utf8");
process.stdout.write(tag ? saved.replaceAll(/(<<\s*)"chart"(?=,)/g, `$1${tag}`) : saved);
process.exit(fs.existsSync(file(".exit")) ? Number(fs.readFileSync(file(".exit"), "utf8")) : 0);
